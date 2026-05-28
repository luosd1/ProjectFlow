import type {
  User,
  CreateUserRequest,
  Workspace,
  CreateWorkspaceRequest,
  WorkspaceState,
  Invitation,
  CreateInvitationRequest,
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
  return request<User>("/users", { method: "POST", body: JSON.stringify(data) });
}

export async function listUsers(): Promise<User[]> {
  return request<User[]>("/users");
}

export async function selectDemoUser(userId: string): Promise<void> {
  await request("/users/select-demo-user", {
    method: "POST",
    body: JSON.stringify({ user_id: userId }),
  });
}

// --- Workspaces ---
export async function createWorkspace(data: CreateWorkspaceRequest): Promise<Workspace> {
  return request<Workspace>("/workspaces", { method: "POST", body: JSON.stringify(data) });
}

export async function getWorkspaceState(workspaceId: string): Promise<WorkspaceState> {
  return request<WorkspaceState>(`/workspaces/${workspaceId}/state`);
}

// --- Invitations ---
export async function createInvitation(
  workspaceId: string,
  data: CreateInvitationRequest,
): Promise<Invitation> {
  return request<Invitation>(`/workspaces/${workspaceId}/invitations`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function acceptInvitation(token: string, userId: string): Promise<void> {
  await request(`/invitations/${token}/accept`, {
    method: "POST",
    body: JSON.stringify({ user_id: userId }),
  });
}

// --- Member Profile ---
export async function upsertMemberProfile(
  workspaceId: string,
  userId: string,
  data: UpsertMemberProfileRequest,
): Promise<MemberProfile> {
  return request<MemberProfile>(`/workspaces/${workspaceId}/members/${userId}/profile`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

// --- Projects ---
export async function createProject(
  workspaceId: string,
  data: CreateProjectRequest,
): Promise<Project> {
  return request<Project>(`/workspaces/${workspaceId}/projects`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function getProjectState(projectId: string): Promise<ProjectState> {
  return request<ProjectState>(`/projects/${projectId}/state`);
}

// --- Project Resources ---
export async function addResource(
  projectId: string,
  data: AddResourceRequest,
): Promise<ProjectResource> {
  return request<ProjectResource>(`/projects/${projectId}/resources`, {
    method: "POST",
    body: JSON.stringify(data),
  });
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
  await request(`/tasks/${taskId}/status`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

// --- Export ---
export async function exportReviewSummary(projectId: string): Promise<{ markdown: string }> {
  return request<{ markdown: string }>(`/projects/${projectId}/export/review-summary`, {
    method: "POST",
  });
}
