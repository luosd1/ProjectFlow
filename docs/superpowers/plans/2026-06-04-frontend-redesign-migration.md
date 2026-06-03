# Frontend Redesign Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the current ProjectFlow frontend to the `D:\Flowors\ProjectFlow_Frontend_Redesign` look while preserving the current backend-backed MVP flows.

**Architecture:** Treat the redesign repo as the visual and layout source, not as an overwrite source. Keep the current project's freshest API/type behavior as the functional baseline, then graft in the redesign tokens, shell, project three-column layout, and domain component styling. Workspace access follows the redesign: the workspace view lives in the project left sidebar, and `/workspaces/[workspaceId]` becomes a transition route into an existing project or project creation.

**Tech Stack:** Next.js 16 App Router, React 18, TypeScript, Tailwind CSS v3, shadcn-style local components, Base UI primitives, Framer Motion, Vitest, ESLint.

---

### Task 1: Preserve Current Functional Baseline

**Files:**
- Read: `frontend/src/lib/api.ts`
- Read: `frontend/src/lib/types.ts`
- Read: `D:\Flowors\ProjectFlow_Frontend_Redesign\src/lib/api.ts`
- Read: `D:\Flowors\ProjectFlow_Frontend_Redesign\src/lib/types.ts`
- Modify: `frontend/src/lib/api.ts`
- Modify: `frontend/src/lib/types.ts`

- [ ] Keep current-only API behavior:

```ts
export async function runAssignment(projectId: string, stageId?: string): Promise<AgentFlowResult> {
  return runAgentFlow(projectId, "assign", stageId ? { stage_id: stageId } : undefined);
}

export async function runAgentNegotiate(projectId: string): Promise<AgentFlowResult> {
  return runAgentFlow(projectId, "negotiate");
}
```

- [ ] Keep current risk evidence normalization that converts structured evidence into Chinese-readable fields instead of raw JSON strings.

- [ ] Keep current proposal support:

```ts
export type AgentProposal = {
  proposal_type: "clarify" | "plan" | "breakdown" | "replan";
  rejection_reason?: string | null;
};
```

- [ ] Add any redesign layout fields required by `ProjectSidebar` and `WorkspaceContent` without removing existing fields:

```ts
export type ProjectState = {
  memberships: WorkspaceMembership[];
  projects: Project[];
};
```

- [ ] Run:

```powershell
cd frontend
npm run test -- src/lib/api.test.ts
```

Expected: API tests pass.

### Task 2: Migrate Visual Foundation

**Files:**
- Modify: `frontend/src/styles/globals.css`
- Modify: `frontend/tailwind.config.ts`
- Modify: `frontend/src/app/layout.tsx`
- Copy/merge: `D:\Flowors\ProjectFlow_Frontend_Redesign\src/components/ui/compact-stat.tsx`

- [ ] Replace current warm green token set with redesign blue/gold/cool-canvas tokens from the redesign repo.

- [ ] Use `Instrument_Serif` for display text and `Inter` for UI/body text:

```ts
const display = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-brand",
});

const body = Inter({
  subsets: ["latin"],
  variable: "--font-body",
});
```

- [ ] Preserve current metadata details that are still better than redesign, including the favicon declaration if the file exists:

```ts
export const metadata: Metadata = {
  title: "ProjectFlow",
  description: "面向大学生项目小队的主动推进型 AI Agent",
  icons: {
    icon: "/favicon.svg",
  },
};
```

- [ ] Run:

```powershell
cd frontend
npm run lint
```

Expected: no lint errors from token/font migration.

### Task 3: Migrate App Shell And Workspace Navigation

**Files:**
- Modify: `frontend/src/components/app-shell.tsx`
- Modify: `frontend/src/app/workspaces/[workspaceId]/page.tsx`
- Copy/merge: `D:\Flowors\ProjectFlow_Frontend_Redesign\src/components/workspace/new-workspace-dialog.tsx`

- [ ] Migrate redesign AppShell visual treatment and project-dashboard full-height behavior.

- [ ] Preserve current `setLastWorkspaceId`, `setCurrentUserId`, `setWorkspaceMembers`, and storage event dispatch behavior so navigation/user switching stays reactive.

- [ ] Change `/workspaces/[workspaceId]` to the redesign transition behavior:

```ts
getWorkspaceState(workspaceId)
  .then((data) => {
    if (data.projects.length > 0) {
      router.replace(`/projects/${data.projects[0].id}`);
    } else {
      router.replace(
        `/projects/new?workspaceId=${workspaceId}&createdBy=${data.workspace.owner_user_id}`
      );
    }
  })
  .catch(() => router.replace("/"));
```

- [ ] Do not keep a separate standalone workspace dashboard page. The workspace view is exposed from the left project sidebar.

- [ ] Run:

```powershell
cd frontend
npm run test -- src/components/app-shell.test.tsx
```

Expected: AppShell tests pass or are updated to reflect the new full-height shell behavior.

### Task 4: Migrate Project Three-Column Layout

**Files:**
- Copy/merge: `frontend/src/components/project/project-layout.tsx`
- Copy/merge: `frontend/src/components/project/project-sidebar.tsx`
- Copy/merge: `frontend/src/components/project/project-content.tsx`
- Copy/merge: `frontend/src/components/project/agent-sidebar.tsx`
- Modify: `frontend/src/app/projects/[projectId]/page.tsx`
- Modify: `frontend/src/components/project/project-dashboard.tsx`

- [ ] Use redesign's `ProjectLayout`, `ProjectSidebar`, `ProjectContent`, and `AgentSidebar` as the layout source.

- [ ] Keep current page-level behavior from `frontend/src/app/projects/[projectId]/page.tsx`:

```ts
function resolveValidCurrentUserId(nextState: ProjectState, storedUserId: string | null) {
  const memberIds = new Set(nextState.members.map((member) => member.user_id));
  if (storedUserId && memberIds.has(storedUserId)) return storedUserId;
  if (memberIds.has(nextState.project.created_by)) return nextState.project.created_by;
  return nextState.members[0]?.user_id ?? null;
}
```

- [ ] Preserve current Agent result feedback for `fallback`, `repaired`, and `failed` statuses.

- [ ] Pass the active stage ID into assignment generation:

```ts
const AGENT_RUNNERS: Record<AgentAction, (projectId: string, state?: ProjectState) => Promise<unknown>> = {
  assign: (projectId, state) => runAssignment(projectId, resolveActiveStageId(state)),
};
```

- [ ] Keep resource addition support by passing `onAddResource` into whichever content view renders resources.

- [ ] Run:

```powershell
cd frontend
npm run test -- src/components/project/project-dashboard.test.tsx
```

Expected: dashboard tests pass or are updated for the new layout and exported helpers.

### Task 5: Restore Functional Surfaces Inside Redesigned Views

**Files:**
- Modify: `frontend/src/components/project/project-content.tsx`
- Modify: `frontend/src/components/project/project-sidebar.tsx`
- Copy/merge: `frontend/src/components/project/workspace-content.tsx`
- Copy/merge: `frontend/src/components/project/new-project-dialog.tsx`
- Preserve or merge: `frontend/src/components/project/project-resources-panel.tsx`
- Modify: `frontend/src/components/risk/replan-diff.tsx`
- Modify: `frontend/src/components/assignment/assignment-flow-panel.tsx`
- Modify: `frontend/src/components/agent/team-actions-panel.tsx`

- [ ] Add a resources view or overview section so existing project resources can still be viewed and added.

- [ ] Ensure `ReplanDiff` receives pending replan proposals:

```ts
const latestPendingReplan = state.agent_proposals
  .filter((p) => p.proposal_type === "replan" && p.status === "pending")
  .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0] ?? null;
```

- [ ] Keep proposal confirmation and rejection callbacks wired for replan.

- [ ] Keep assignment response, negotiation, and finalization callbacks wired in the team task view.

- [ ] Keep action card complete/dismiss behavior and any creator-only restrictions that are still required by current components.

- [ ] Run:

```powershell
cd frontend
npm run test -- src/components/assignment/assignment-flow-panel.test.tsx src/components/agent/agent-proposal-panel.test.tsx
```

Expected: assignment and proposal tests pass.

### Task 6: Migrate Remaining Redesigned Domain Components

**Files:**
- Merge: `frontend/src/components/agent/*`
- Merge: `frontend/src/components/assignment/*`
- Merge: `frontend/src/components/checkin/*`
- Merge: `frontend/src/components/member/*`
- Merge: `frontend/src/components/onboarding/*`
- Merge: `frontend/src/components/risk/*`
- Merge: `frontend/src/components/stage/*`
- Merge: `frontend/src/components/task/*`
- Merge: `frontend/src/components/workspace/*`
- Merge: `frontend/src/components/projectflow-home.tsx`
- Preserve current tests unless intentionally updated.

- [ ] Prefer redesign visuals for component structure and styling.

- [ ] Preserve current current-project behavior where redesign is older:
  - structured risk evidence rendering
  - replan proposal support
  - rejection reason display
  - valid current user fallback
  - workspace member storage updates
  - frontend timeout/error transparency

- [ ] Run:

```powershell
cd frontend
npm run test
```

Expected: full frontend test suite passes.

### Task 7: Full Verification And Manual Smoke

**Files:**
- No code changes expected unless verification reveals defects.

- [ ] Run:

```powershell
cd frontend
npm run lint
npm run build
```

Expected: both commands pass.

- [ ] Start backend if needed:

```powershell
cd backend
.venv\Scripts\python -m uvicorn app.main:app --reload --port 8000
```

- [ ] Start frontend:

```powershell
cd frontend
npm run dev
```

- [ ] Smoke these routes:
  - `/`
  - `/onboarding`
  - `/onboarding/profile`
  - `/workspaces/<id>` redirects to first project or new project
  - `/projects/<id>` shows left workspace/project menu, center content, right Agent sidebar
  - project sidebar workspace entry opens the workspace view
  - Agent clarify/plan/breakdown/assign/push/risk/replan buttons still call backend
  - resource add, assignment response, check-in, risk status, replan confirm/reject, export still work

Expected: redesigned UI is visible and existing MVP workflows remain backend-backed.

---

## Self-Review

- Spec coverage: covers visual foundation, AppShell, workspace navigation change, project layout, preserved API/types, restored resource/replan/assignment/action-card surfaces, verification.
- Placeholder scan: no `TBD`, `TODO`, or unassigned requirements.
- Type consistency: `AgentAction`, `ProjectState`, `AgentProposal`, `WorkspaceMembership`, and API names match the current project and redesign code discovered during exploration.
