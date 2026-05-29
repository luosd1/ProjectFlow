import type {
  User,
  CreateUserRequest,
  Workspace,
  CreateWorkspaceRequest,
  WorkspaceState,
  Invitation,
  CreateInvitationRequest,
  Skill,
  MemberProfile,
  UpsertMemberProfileRequest,
  Project,
  CreateProjectRequest,
  ProjectState,
  ProjectResource,
  AddResourceRequest,
  AssignmentProposal,
  AssignmentResponse,
  AssignmentNegotiation,
  CheckInCycle,
  CheckInResponse,
  Risk,
  ActionCard,
  AgentEvent,
} from "./types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api";

type BackendUser = Omit<User, "user_id"> & { id: string; user_id?: string };
type BackendWorkspace = Omit<Workspace, "workspace_id"> & { id: string; workspace_id?: string };
type BackendInvitation = Omit<Invitation, "invitation_id"> & { id: string; invitation_id?: string };
type BackendWorkspaceMember = {
  user_id: string;
  display_name: string;
  skills?: Skill[];
  available_hours_per_week?: number;
  role_preference?: string;
  interests?: string;
  constraints?: string;
};
type BackendWorkspaceState = {
  workspace_id: string;
  workspace_name: string;
  members: BackendWorkspaceMember[];
};

function normalizeUser(user: BackendUser): User {
  return {
    ...user,
    user_id: user.user_id ?? user.id,
  };
}

function normalizeWorkspace(workspace: BackendWorkspace): Workspace {
  return {
    ...workspace,
    workspace_id: workspace.workspace_id ?? workspace.id,
  };
}

function normalizeInvitation(invitation: BackendInvitation): Invitation {
  return {
    ...invitation,
    invitation_id: invitation.invitation_id ?? invitation.id,
  };
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Request failed: ${response.status} ${body}`);
  }

  return response.json() as Promise<T>;
}

export async function apiGet<T>(path: string): Promise<T> {
  return request<T>(path);
}

// --- Users ---
export async function createUser(data: CreateUserRequest): Promise<User> {
  const user = await request<BackendUser>("/users", { method: "POST", body: JSON.stringify(data) });
  return normalizeUser(user);
}

export async function listUsers(): Promise<User[]> {
  const users = await request<BackendUser[]>("/users");
  return users.map(normalizeUser);
}

export async function selectDemoUser(userId: string): Promise<void> {
  await request("/users/select-demo-user", {
    method: "POST",
    body: JSON.stringify({ user_id: userId }),
  });
}

// --- Workspaces ---
export async function createWorkspace(data: CreateWorkspaceRequest): Promise<Workspace> {
  const workspace = await request<BackendWorkspace>(
    `/workspaces?owner_user_id=${encodeURIComponent(data.owner_user_id)}`,
    {
      method: "POST",
      body: JSON.stringify({
        name: data.name,
        description: data.description ?? null,
      }),
    },
  );
  return normalizeWorkspace(workspace);
}

export async function getWorkspaceState(workspaceId: string): Promise<WorkspaceState> {
  const [workspace, agentState, profiles, projects] = await Promise.all([
    getWorkspace(workspaceId),
    request<BackendWorkspaceState>(`/workspaces/${workspaceId}/state`),
    listMemberProfilesByWorkspace(workspaceId),
    listProjectsByWorkspace(workspaceId),
  ]);

  const members = agentState.members.map((member) => ({
    user_id: member.user_id,
    display_name: member.display_name,
    email: null,
    avatar_url: null,
    created_at: workspace.created_at,
  }));

  const memberships = members.map((member) => ({
    id: `${workspaceId}-${member.user_id}`,
    workspace_id: workspaceId,
    user_id: member.user_id,
    role: member.user_id === workspace.owner_user_id ? "owner" as const : "member" as const,
    joined_at: workspace.created_at,
  }));

  return {
    workspace,
    users: members,
    memberships,
    member_profiles: profiles,
    projects,
  };
}

export async function getWorkspace(workspaceId: string): Promise<Workspace> {
  const workspace = await request<BackendWorkspace>(`/workspaces/${workspaceId}`);
  return normalizeWorkspace(workspace);
}

// --- Invitations ---
export async function createInvitation(
  workspaceId: string,
  data: CreateInvitationRequest,
): Promise<Invitation> {
  const invitation = await request<BackendInvitation>("/invitations", {
    method: "POST",
    body: JSON.stringify({
      workspace_id: workspaceId,
      invited_name: data.invited_name,
      invited_email: data.invited_email ?? null,
    }),
  });
  return normalizeInvitation(invitation);
}

export async function acceptInvitation(token: string, userId: string): Promise<void> {
  void userId;
  await request("/invitations/accept", {
    method: "POST",
    body: JSON.stringify({ token }),
  });
}

// --- Member Profile ---
export async function upsertMemberProfile(
  workspaceId: string,
  userId: string,
  data: UpsertMemberProfileRequest,
): Promise<MemberProfile> {
  const profiles = await listMemberProfilesByWorkspace(workspaceId);
  const existing = profiles.find((profile) => profile.user_id === userId);
  if (existing) {
    return request<MemberProfile>(`/member-profiles/${existing.id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }

  return request<MemberProfile>("/member-profiles", {
    method: "POST",
    body: JSON.stringify({
      ...data,
      user_id: userId,
      workspace_id: workspaceId,
    }),
  });
}

export async function listMemberProfilesByWorkspace(workspaceId: string): Promise<MemberProfile[]> {
  return request<MemberProfile[]>(`/workspaces/${workspaceId}/profiles`);
}

// --- Projects ---
export async function createProject(
  workspaceId: string,
  data: CreateProjectRequest,
): Promise<Project> {
  return request<Project>("/projects", {
    method: "POST",
    body: JSON.stringify({
      ...data,
      workspace_id: workspaceId,
    }),
  });
}

export async function getProjectState(projectId: string): Promise<ProjectState> {
  const project = await request<Project>(`/projects/${projectId}`);
  const [workspace, resources, stages, tasks, allUsers, memberProfiles] = await Promise.all([
    getWorkspace(project.workspace_id),
    listResourcesByProject(projectId),
    listStagesByProject(projectId),
    listTasksByProject(projectId),
    listUsers(),
    listMemberProfilesByWorkspace(project.workspace_id),
  ]);
  const workspaceMemberIds = new Set([
    workspace.owner_user_id,
    ...memberProfiles.map((profile) => profile.user_id),
  ]);
  const members = allUsers.filter((user) => workspaceMemberIds.has(user.user_id));

  return {
    workspace,
    project,
    resources,
    members,
    member_profiles: memberProfiles,
    stages,
    tasks,
    assignment_proposals: [],
    assignment_responses: [],
    assignment_negotiations: [],
    checkins: [],
    risks: [],
    action_cards: [],
    timeline: [],
  };
}

export async function listProjectsByWorkspace(workspaceId: string): Promise<Project[]> {
  return request<Project[]>(`/workspaces/${workspaceId}/projects`);
}

// --- Project Resources ---
export async function addResource(
  projectId: string,
  data: AddResourceRequest,
): Promise<ProjectResource> {
  return request<ProjectResource>("/resources", {
    method: "POST",
    body: JSON.stringify({
      ...data,
      project_id: projectId,
    }),
  });
}

export async function listResourcesByProject(projectId: string): Promise<ProjectResource[]> {
  return request<ProjectResource[]>(`/projects/${projectId}/resources`);
}

export async function listStagesByProject(projectId: string): Promise<ProjectState["stages"]> {
  return request<ProjectState["stages"]>(`/projects/${projectId}/stages`);
}

export async function listTasksByProject(projectId: string): Promise<ProjectState["tasks"]> {
  return request<ProjectState["tasks"]>(`/projects/${projectId}/tasks`);
}

// --- Agent ---
export async function runClarification(projectId: string): Promise<AgentEvent> {
  return request<AgentEvent>(`/projects/${projectId}/agent/clarify`, { method: "POST" });
}

export async function runPlanning(projectId: string): Promise<AgentEvent> {
  return request<AgentEvent>(`/projects/${projectId}/agent/plan`, { method: "POST" });
}

export async function runBreakdown(projectId: string): Promise<AgentEvent> {
  return request<AgentEvent>(`/projects/${projectId}/agent/breakdown`, { method: "POST" });
}

export async function runAssignment(projectId: string): Promise<AgentEvent> {
  return request<AgentEvent>(`/projects/${projectId}/agent/assign`, { method: "POST" });
}

export async function runActivePush(projectId: string): Promise<AgentEvent> {
  return request<AgentEvent>(`/projects/${projectId}/agent/push`, { method: "POST" });
}

export async function runCheckinAnalysis(projectId: string): Promise<AgentEvent> {
  return request<AgentEvent>(`/projects/${projectId}/agent/analyze-checkins`, { method: "POST" });
}

export async function runRiskAnalysis(projectId: string): Promise<AgentEvent> {
  return request<AgentEvent>(`/projects/${projectId}/agent/risk-analysis`, { method: "POST" });
}

export async function runReplan(projectId: string): Promise<AgentEvent> {
  return request<AgentEvent>(`/projects/${projectId}/agent/replan`, { method: "POST" });
}

// --- Confirmation ---
export async function confirmAgentOutput(
  projectId: string,
  timelineEventId: string,
  confirmType: string,
  accepted: boolean,
  confirmedBy: string,
): Promise<void> {
  await request(`/projects/${projectId}/confirm`, {
    method: "POST",
    body: JSON.stringify({
      timeline_event_id: timelineEventId,
      confirm_type: confirmType,
      accepted,
      confirmed_by: confirmedBy,
    }),
  });
}

// --- Assignment ---
export async function respondToAssignment(
  proposalId: string,
  userId: string,
  response: "accept" | "reject",
  preferredTaskId?: string,
  reason?: string,
): Promise<AssignmentResponse> {
  return request<AssignmentResponse>(`/assignment-proposals/${proposalId}/response`, {
    method: "POST",
    body: JSON.stringify({
      user_id: userId,
      response,
      preferred_task_id: preferredTaskId,
      reason,
    }),
  });
}

export async function startNegotiation(
  projectId: string,
  proposalId: string,
  fromUserId: string,
  desiredTaskId: string,
): Promise<AssignmentNegotiation> {
  return request<AssignmentNegotiation>(`/projects/${projectId}/assignments/negotiate`, {
    method: "POST",
    body: JSON.stringify({
      proposal_id: proposalId,
      from_user_id: fromUserId,
      desired_task_id: desiredTaskId,
    }),
  });
}

export async function resolveNegotiation(
  negotiationId: string,
  accepted: boolean,
  resolvedBy: string,
): Promise<void> {
  await request(`/assignment-negotiations/${negotiationId}/resolve`, {
    method: "POST",
    body: JSON.stringify({ accepted, resolved_by: resolvedBy }),
  });
}

export async function finalizeAssignments(stageId: string, finalizedBy: string): Promise<void> {
  await request(`/stages/${stageId}/assignments/finalize`, {
    method: "POST",
    body: JSON.stringify({ finalized_by: finalizedBy }),
  });
}

// --- Check-in ---
export async function createCheckinCycle(
  projectId: string,
  stageId: string,
  cadenceDays: number,
  startDate: string,
  createdByUserId: string,
): Promise<CheckInCycle> {
  return request<CheckInCycle>(`/projects/${projectId}/checkin-cycles`, {
    method: "POST",
    body: JSON.stringify({
      stage_id: stageId,
      cadence_days: cadenceDays,
      start_date: startDate,
      created_by_user_id: createdByUserId,
    }),
  });
}

export async function submitCheckinResponse(
  cycleId: string,
  data: {
    user_id: string;
    task_id?: string;
    what_done: string;
    blocker?: string;
    available_hours_next_cycle?: number;
    mood_or_confidence?: "low" | "medium" | "high";
  },
): Promise<CheckInResponse> {
  return request<CheckInResponse>(`/checkin-cycles/${cycleId}/responses`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

// --- Task ---
export async function updateTaskStatus(
  taskId: string,
  data: {
    user_id: string;
    status: "not_started" | "in_progress" | "done" | "blocked";
    progress_note?: string;
    blocker?: string;
    available_hours_change?: number;
  },
): Promise<void> {
  await request(`/tasks/${taskId}/status-updates`, {
    method: "POST",
    body: JSON.stringify({
      task_id: taskId,
      user_id: data.user_id,
      status: data.status,
      progress_note: data.progress_note,
      blocker: data.blocker,
    }),
  });
}

// --- Export ---
export async function exportReviewSummary(projectId: string): Promise<{ markdown: string }> {
  return request<{ markdown: string }>(`/projects/${projectId}/export/review-summary`, {
    method: "POST",
  });
}
