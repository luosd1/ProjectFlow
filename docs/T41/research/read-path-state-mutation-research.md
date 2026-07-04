# Read Path State Mutation Research

Date: 2026-07-04

Scope: This note audits ProjectFlow read paths for `ProjectState`, `WorkspaceState`, timeline, and dashboard aggregate state. It uses only first-party repo sources: backend routes/services/models/tests and existing docs.

Decision: Option B is accepted. ProjectFlow read paths must stay pure; stage/project catch-up belongs in explicit command/job paths, not `get_project_state()` or any `read_only` Agent tool.

## Core Conclusion

Yes, there is one read-path state mutation candidate: `GET /api/projects/{project_id}/state` calls `get_project_state()`, which calls `_catch_up_stage_progress()`, which can call `try_advance_stage()` and then `session.flush()` (backend/app/api/routes_projects.py:58, backend/app/api/routes_projects.py:63, backend/app/services/project_state_service.py:212, backend/app/services/project_state_service.py:244, backend/app/services/project_state_service.py:245, backend/app/services/project_state_service.py:248, backend/app/services/project_state_service.py:258).

That mutation targets Primary Project State. `try_advance_stage()` can set the current stage to `completed`, activate the next pending stage, update `Project.current_stage_id`, or mark the project `completed` and update `Project.updated_at` (backend/app/services/stage_service.py:84, backend/app/services/stage_service.py:85, backend/app/services/stage_service.py:99, backend/app/services/stage_service.py:100, backend/app/services/stage_service.py:101, backend/app/services/stage_service.py:107, backend/app/services/stage_service.py:108, backend/app/services/stage_service.py:109).

This behavior should not remain in a GET/read path. The recommended direction is: keep deterministic stage advancement on explicit command paths such as human task status updates, move stale-state repair to an explicit maintenance command/job, and route Agent-inferred task/stage changes through human-confirmed replan proposals.

Important nuance: the current FastAPI session dependency does not explicitly commit after successful GET handlers; it only yields a session and rolls back on exception (backend/app/core/database.py:73, backend/app/core/database.py:76, backend/app/core/database.py:77, backend/app/core/database.py:78). So the current HTTP GET path has no visible route-level `commit()`. But the service still mutates ORM objects and flushes inside the read call. That is enough to make the response reflect a write-side effect, and it can become persistent if the same service is reused inside a longer transaction that later commits.

## Working Definitions

Use the accepted T41 ownership model:

- Primary Project State: Project/Stage/Task/finalized owner/status/date are FastAPI/DB-owned main facts (docs/T41/ProjectFlow_Agent_Runtime_Foundation_Design.md:520, docs/T41/ProjectFlow_Agent_Runtime_Foundation_Design.md:524).
- Advisory Project Record: Risk/ActionCard are persistent advisory records and do not directly change main facts (docs/T41/ProjectFlow_Agent_Runtime_Foundation_Design.md:525).
- Reviewable Draft Record: AgentProposal/AssignmentProposal are pending/confirmed/rejected or domain-confirmed draft flows (docs/T41/ProjectFlow_Agent_Runtime_Foundation_Design.md:526).
- AgentEvent is timeline/runtime metadata, not Primary Project State (docs/T41/ProjectFlow_Agent_Runtime_Foundation_Design.md:531).

The model fields match that boundary:

- `Project` contains `status`, `current_stage_id`, `direction_card`, and `updated_at` (backend/app/models/project.py:16, backend/app/models/project.py:17, backend/app/models/project.py:18, backend/app/models/project.py:23).
- `Stage` contains stage plan/status fields (backend/app/models/stage.py:10, backend/app/models/stage.py:11, backend/app/models/stage.py:13, backend/app/models/stage.py:14, backend/app/models/stage.py:17).
- `Task` contains task status/owner/due/cut fields (backend/app/models/task.py:16, backend/app/models/task.py:17, backend/app/models/task.py:19, backend/app/models/task.py:23).
- `Risk` and `ActionCard` are project-linked advisory records with their own statuses (backend/app/models/risk.py:11, backend/app/models/risk.py:20, backend/app/models/action_card.py:11, backend/app/models/action_card.py:23).
- `AgentEvent` stores timeline snapshots and confirmation flag (backend/app/models/timeline.py:11, backend/app/models/timeline.py:20, backend/app/models/timeline.py:21, backend/app/models/timeline.py:23).

## Read Path Inventory

| Read path | Route / caller | Service path | commit/flush/write? | Object class affected | Judgment |
|---|---|---|---|---|---|
| ProjectState aggregate | `GET /api/projects/{project_id}/state` calls `get_project_state()` (backend/app/api/routes_projects.py:58, backend/app/api/routes_projects.py:63). | `get_project_state()` calls `_catch_up_stage_progress()` before assembling the response (backend/app/services/project_state_service.py:248, backend/app/services/project_state_service.py:257, backend/app/services/project_state_service.py:258). | Yes: `_catch_up_stage_progress()` calls `try_advance_stage()` and `session.flush()` when all tasks in an active/at_risk stage are done (backend/app/services/project_state_service.py:238, backend/app/services/project_state_service.py:243, backend/app/services/project_state_service.py:244, backend/app/services/project_state_service.py:245). | `Stage` and `Project` via `try_advance_stage()` (backend/app/services/stage_service.py:85, backend/app/services/stage_service.py:100, backend/app/services/stage_service.py:101, backend/app/services/stage_service.py:107, backend/app/services/stage_service.py:108). | Violates read purity. It changes Primary Project State semantics even if the route does not explicitly commit. |
| WorkspaceState aggregate | `GET /api/workspaces/{workspace_id}/state` calls `get_workspace_state()` (backend/app/api/routes_workspace_state.py:11, backend/app/api/routes_workspace_state.py:16). | `get_workspace_state()` selects workspace, members, profiles, project, stages, tasks, check-ins, assignments, negotiations, resources, and returns a response (backend/app/services/workspace_state_service.py:56, backend/app/services/workspace_state_service.py:62, backend/app/services/workspace_state_service.py:67, backend/app/services/workspace_state_service.py:116, backend/app/services/workspace_state_service.py:131, backend/app/services/workspace_state_service.py:151, backend/app/services/workspace_state_service.py:177, backend/app/services/workspace_state_service.py:213, backend/app/services/workspace_state_service.py:255). | No direct `commit()`, `flush()`, `session.add()`, or `try_advance_stage()` in this service body. | None. Reads Project/Stage/Task/Assignment/CheckIn/Resource state. | Should remain read-only. It is also the intended read-only T41 tool (docs/T41/ProjectFlow_Agent_Tools_Skills_Design.md:201, docs/T41/ProjectFlow_Agent_Tools_Skills_Design.md:211, docs/T41/ProjectFlow_Agent_Tools_Skills_Design.md:213, docs/T41/ProjectFlow_Agent_Tools_Skills_Design.md:221, docs/T41/ProjectFlow_Agent_Tools_Skills_Design.md:222). |
| Timeline | `GET /api/projects/{project_id}/timeline` calls `list_timeline_by_project()` (backend/app/api/routes_timeline.py:27, backend/app/api/routes_timeline.py:32). | `list_timeline_by_project()` performs a `select(AgentEvent)` ordered by `created_at` (backend/app/services/timeline_service.py:6, backend/app/services/timeline_service.py:8, backend/app/services/timeline_service.py:9, backend/app/services/timeline_service.py:10, backend/app/services/timeline_service.py:11). | No. | None. Reads AgentEvent timeline metadata. | Should remain read-only. T41 says timeline slice is read-only and bounded (docs/T41/ProjectFlow_Agent_Tools_Skills_Design.md:266, docs/T41/ProjectFlow_Agent_Tools_Skills_Design.md:270, docs/T41/ProjectFlow_Agent_Tools_Skills_Design.md:272, docs/T41/ProjectFlow_Agent_Tools_Skills_Design.md:273). |
| Dashboard normal load | Workspace page imports `getProjectState()` and calls it on initial project load, project switch, and reload (frontend/src/app/workspaces/[workspaceId]/page.tsx:18, frontend/src/app/workspaces/[workspaceId]/page.tsx:144, frontend/src/app/workspaces/[workspaceId]/page.tsx:154, frontend/src/app/workspaces/[workspaceId]/page.tsx:208, frontend/src/app/workspaces/[workspaceId]/page.tsx:260, frontend/src/app/workspaces/[workspaceId]/page.tsx:261). | `getProjectState()` first requests `/projects/${projectId}/state` and only falls back on 404 (frontend/src/lib/api.ts:337, frontend/src/lib/api.ts:339, frontend/src/lib/api.ts:341, frontend/src/lib/api.ts:342, frontend/src/lib/api.ts:346). | Inherits ProjectState aggregate behavior. | Potentially Stage/Project if aggregate endpoint catches up. | This makes the mutation user-facing because dashboard refresh is a common read path. |
| Dashboard split fallback | On aggregate 404, frontend calls split endpoints for project, workspace, resources, stages, tasks, users, profiles, projects, proposals, assignments, checkins, risks, action cards, and timeline (frontend/src/lib/api.ts:349, frontend/src/lib/api.ts:350, frontend/src/lib/api.ts:351, frontend/src/lib/api.ts:367, frontend/src/lib/api.ts:382). | The backend list/get services for these paths are simple selects/session.get in the inspected files: Project (backend/app/services/project_service.py:26, backend/app/services/project_service.py:30), Stage (backend/app/services/stage_service.py:30, backend/app/services/stage_service.py:34), Task (backend/app/services/task_service.py:27, backend/app/services/task_service.py:37), Risk (backend/app/services/risk_service.py:54), ActionCard (backend/app/services/action_card_service.py:35), AgentProposal (backend/app/services/agent_proposal_service.py:47, backend/app/services/agent_proposal_service.py:51), Assignment (backend/app/services/assignment_service.py:128, backend/app/services/assignment_service.py:132, backend/app/services/assignment_service.py:140, backend/app/services/assignment_service.py:153), CheckIn (backend/app/services/checkin_service.py:31, backend/app/services/checkin_service.py:66), Resource (backend/app/services/resource_service.py:46), Workspace/User/Profile (backend/app/services/workspace_service.py:30, backend/app/services/workspace_service.py:34, backend/app/services/user_service.py:19, backend/app/services/user_service.py:23, backend/app/services/member_profile_service.py:27, backend/app/services/member_profile_service.py:51). | No read-side commit/flush found. | None. | Split fallback is cleaner than aggregate for write purity, but it is only used when aggregate endpoint 404s. |

There is no separate `routes_project_state.py` file in the current tree. ProjectState is exposed from `backend/app/api/routes_projects.py` (backend/app/api/routes_projects.py:16, backend/app/api/routes_projects.py:58).

## GET Endpoint Checklist

| Route file | GET / read endpoints checked | Calls commit/flush/write Project/Stage/Task/Risk/ActionCard/AgentEvent? | Notes |
|---|---|---:|---|
| `backend/app/api/routes_projects.py` | `GET /projects/{project_id}`, `GET /projects/{project_id}/state`, `GET /workspaces/{workspace_id}/projects` (backend/app/api/routes_projects.py:47, backend/app/api/routes_projects.py:58, backend/app/api/routes_projects.py:69). | Only `GET /projects/{project_id}/state` calls a mutating service path (backend/app/api/routes_projects.py:63, backend/app/services/project_state_service.py:258). | Plain project get/list use `get_project()` / `list_projects_by_workspace()`, which are `session.get` / `select` only (backend/app/services/project_service.py:26, backend/app/services/project_service.py:30). |
| `backend/app/api/routes_workspace_state.py` | `GET /workspaces/{workspace_id}/state` (backend/app/api/routes_workspace_state.py:11). | No. | Calls `get_workspace_state()` only (backend/app/api/routes_workspace_state.py:16); inspected service body is query/response assembly only (backend/app/services/workspace_state_service.py:56, backend/app/services/workspace_state_service.py:255). |
| `backend/app/api/routes_timeline.py` | `GET /projects/{project_id}/timeline` (backend/app/api/routes_timeline.py:27). | No. | Calls `list_timeline_by_project()` and maps existing `AgentEvent` rows (backend/app/api/routes_timeline.py:32, backend/app/services/timeline_service.py:6). |
| `backend/app/api/routes_stages.py` | `GET /stages/{stage_id}`, `GET /projects/{project_id}/stages` (backend/app/api/routes_stages.py:44, backend/app/api/routes_stages.py:55). | No. | Calls `get_stage()` / `list_stages_by_project()`, both read-only (backend/app/services/stage_service.py:30, backend/app/services/stage_service.py:34). The mutator `try_advance_stage()` is in the same service file but is not called by these GET routes (backend/app/services/stage_service.py:57). |
| `backend/app/api/routes_tasks.py` | `GET /tasks/{task_id}`, `GET /stages/{stage_id}/tasks`, `GET /projects/{project_id}/tasks` (backend/app/api/routes_tasks.py:61, backend/app/api/routes_tasks.py:72, backend/app/api/routes_tasks.py:81). | No. | Calls `get_task()` / list task services, which are read-only (backend/app/services/task_service.py:27, backend/app/services/task_service.py:31, backend/app/services/task_service.py:37). The mutator `create_status_update()` is POST-only (backend/app/api/routes_tasks.py:103, backend/app/services/task_service.py:59). |
| `backend/app/api/routes_risks.py` | `GET /projects/{project_id}/risks` (backend/app/api/routes_risks.py:45). | No. | Calls `list_risks_by_project()` only (backend/app/api/routes_risks.py:50, backend/app/services/risk_service.py:54). |
| `backend/app/api/routes_action_cards.py` | `GET /projects/{project_id}/action-cards` (backend/app/api/routes_action_cards.py:26). | No. | Calls `list_action_cards_by_project()` only (backend/app/api/routes_action_cards.py:31, backend/app/services/action_card_service.py:35). |
| Dashboard support routes | Assignment, check-in, agent-proposal, resource, workspace, user, and profile GETs used by split fallback or adjacent dashboard reads (backend/app/api/routes_assignments.py:42, backend/app/api/routes_assignments.py:53, backend/app/api/routes_assignments.py:61, backend/app/api/routes_assignments.py:69, backend/app/api/routes_checkins.py:33, backend/app/api/routes_checkins.py:58, backend/app/api/routes_agent_proposals.py:43, backend/app/api/routes_agent_proposals.py:53, backend/app/api/routes_resources.py:19, backend/app/api/routes_workspaces.py:26, backend/app/api/routes_workspaces.py:31, backend/app/api/routes_users.py:17, backend/app/api/routes_users.py:22, backend/app/api/routes_member_profiles.py:41, backend/app/api/routes_member_profiles.py:60). | No Project/Stage/Task/Risk/ActionCard/AgentEvent writes found in these GET routes. | The corresponding read services are `session.get` / `select` helpers, while writes are on POST/PATCH/DELETE services (backend/app/services/assignment_service.py:128, backend/app/services/assignment_service.py:132, backend/app/services/assignment_service.py:140, backend/app/services/assignment_service.py:153, backend/app/services/checkin_service.py:31, backend/app/services/checkin_service.py:66, backend/app/services/agent_proposal_service.py:47, backend/app/services/agent_proposal_service.py:51, backend/app/services/resource_service.py:46, backend/app/services/workspace_service.py:30, backend/app/services/workspace_service.py:34, backend/app/services/user_service.py:19, backend/app/services/user_service.py:23, backend/app/services/member_profile_service.py:27, backend/app/services/member_profile_service.py:51). |

## Detailed Findings

### 1. `_catch_up_stage_progress()` is the only confirmed read-path mutator

`_catch_up_stage_progress()` is documented as a safety net for stages stuck after seed data, direct DB edits, or historical code before `try_advance_stage()` existed (backend/app/services/project_state_service.py:212, backend/app/services/project_state_service.py:213, backend/app/services/project_state_service.py:215, backend/app/services/project_state_service.py:216). It selects active/at_risk stages, batches their tasks, and if a stage has done tasks and no pending tasks, it calls `try_advance_stage()` and flushes (backend/app/services/project_state_service.py:220, backend/app/services/project_state_service.py:230, backend/app/services/project_state_service.py:238, backend/app/services/project_state_service.py:243, backend/app/services/project_state_service.py:244, backend/app/services/project_state_service.py:245).

The safety-net intent is understandable, but the location is wrong. A read API should not repair persistent state as a side effect.

### 2. `try_advance_stage()` changes Primary Project State

`try_advance_stage()` checks the task's stage, returns early unless all tasks in an active/at_risk stage are done, then mutates the stage and possibly the project (backend/app/services/stage_service.py:57, backend/app/services/stage_service.py:69, backend/app/services/stage_service.py:79, backend/app/services/stage_service.py:80, backend/app/services/stage_service.py:84). The concrete writes are:

- `stage.status = "completed"` (backend/app/services/stage_service.py:85).
- next stage `status = "active"` (backend/app/services/stage_service.py:99, backend/app/services/stage_service.py:100).
- `project.current_stage_id = next_stage.id` (backend/app/services/stage_service.py:101).
- when no next stage exists, `project.current_stage_id = None`, `project.status = "completed"`, and `project.updated_at = datetime.now(UTC)` (backend/app/services/stage_service.py:105, backend/app/services/stage_service.py:107, backend/app/services/stage_service.py:108, backend/app/services/stage_service.py:109).

Those fields are exactly the project/stage status and current-stage facts that T41 classifies as Primary Project State (docs/T41/ProjectFlow_Agent_Runtime_Foundation_Design.md:524).

### 3. Task status update is a valid command path, not a GET path

`create_status_update()` creates a history row, updates `Task.status`, and calls `try_advance_stage()` when the new task status is `done` (backend/app/services/task_service.py:59, backend/app/services/task_service.py:61, backend/app/services/task_service.py:71, backend/app/services/task_service.py:74, backend/app/services/task_service.py:78, backend/app/services/task_service.py:81). It commits by default, or flushes if `auto_commit=False` (backend/app/services/task_service.py:83, backend/app/services/task_service.py:84, backend/app/services/task_service.py:87).

That service is exposed through `POST /tasks/{task_id}/status-updates`, not GET (backend/app/api/routes_tasks.py:103, backend/app/api/routes_tasks.py:108, backend/app/api/routes_tasks.py:113). Keeping `try_advance_stage()` there is consistent with a deterministic command after a human/task-status update. The problem is reusing the same advancement from `get_project_state()`.

### 4. WorkspaceState is read-only in current code

`get_workspace_state()` builds a workspace/project snapshot from queries and schema objects. It has no `session.add()`, no `commit()`, no `flush()`, and no call to `_catch_up_stage_progress()` or `try_advance_stage()` in the inspected service body (backend/app/services/workspace_state_service.py:56, backend/app/services/workspace_state_service.py:62, backend/app/services/workspace_state_service.py:67, backend/app/services/workspace_state_service.py:116, backend/app/services/workspace_state_service.py:131, backend/app/services/workspace_state_service.py:227, backend/app/services/workspace_state_service.py:255).

This matches the T41 read-only tool contract: `get_workspace_state` has `risk_category: read_only`, `read_only: true`, and `effects.effect_type: none` (docs/T41/ProjectFlow_Agent_Tools_Skills_Design.md:209, docs/T41/ProjectFlow_Agent_Tools_Skills_Design.md:211, docs/T41/ProjectFlow_Agent_Tools_Skills_Design.md:213, docs/T41/ProjectFlow_Agent_Tools_Skills_Design.md:221, docs/T41/ProjectFlow_Agent_Tools_Skills_Design.md:222).

### 5. Timeline reads do not write AgentEvent

`GET /projects/{project_id}/timeline` maps rows to `AgentEventRead` and calls a read service (backend/app/api/routes_timeline.py:12, backend/app/api/routes_timeline.py:27, backend/app/api/routes_timeline.py:32). The service only selects `AgentEvent` rows and orders by `created_at.desc()` (backend/app/services/timeline_service.py:6, backend/app/services/timeline_service.py:8, backend/app/services/timeline_service.py:9, backend/app/services/timeline_service.py:10, backend/app/services/timeline_service.py:11).

Other code can create AgentEvent as runtime/timeline metadata, but that is outside the audited GET path. Reading timeline does not append or mutate events.

### 6. Tests cover shape/performance, not read purity

Current backend project-state tests verify the aggregate endpoint payload shape and 404 behavior (backend/app/tests/test_project_state_endpoint.py:6, backend/app/tests/test_project_state_endpoint.py:9, backend/app/tests/test_project_state_endpoint.py:13, backend/app/tests/test_project_state_endpoint.py:42, backend/app/tests/test_project_state_endpoint.py:45, backend/app/tests/test_project_state_endpoint.py:48). They do not assert that GET leaves `Project`/`Stage` unchanged.

WorkspaceState tests focus on bounded query count for member loading around `get_workspace_state()` (backend/app/tests/test_nplus1_workspace_state.py:65, backend/app/tests/test_nplus1_workspace_state.py:75, backend/app/tests/test_nplus1_workspace_state.py:77, backend/app/tests/test_nplus1_workspace_state.py:85, backend/app/tests/test_nplus1_workspace_state.py:96). They do not need a mutation regression today because the inspected service is query-only.

Frontend API tests assert the dashboard loads from the aggregate endpoint first and falls back to split endpoints only when aggregate returns 404 (frontend/src/lib/api.test.ts:525, frontend/src/lib/api.test.ts:528, frontend/src/lib/api.test.ts:609, frontend/src/lib/api.test.ts:611, frontend/src/lib/api.test.ts:620, frontend/src/lib/api.test.ts:623, frontend/src/lib/api.test.ts:752). That test locks in the dashboard's exposure to the aggregate endpoint behavior.

## Primary vs Runtime/Advisory Classification

| Write or record type | Current read-path write? | Primary Project State? | Classification |
|---|---:|---:|---|
| `Project.current_stage_id`, `Project.status`, `Project.updated_at` | Yes, via aggregate ProjectState catch-up if stage completes (backend/app/services/stage_service.py:101, backend/app/services/stage_service.py:107, backend/app/services/stage_service.py:108, backend/app/services/stage_service.py:109). | Yes. | Must not be mutated from GET/read path. |
| `Stage.status` | Yes, via aggregate ProjectState catch-up (backend/app/services/stage_service.py:85, backend/app/services/stage_service.py:100). | Yes. | Must not be mutated from GET/read path. |
| `Task.status` | Not from GET in inspected code; command path mutates it through status update (backend/app/services/task_service.py:71, backend/app/services/task_service.py:74, backend/app/api/routes_tasks.py:103). | Yes. | Keep human command direct; Agent-inferred changes should use replan proposal per ADR (docs/adr/0003-use-replan-proposals-for-agent-inferred-task-state-changes.md:5, docs/adr/0003-use-replan-proposals-for-agent-inferred-task-state-changes.md:7). |
| `Risk` | Not from GET; list path only reads (backend/app/api/routes_risks.py:45, backend/app/api/routes_risks.py:50, backend/app/services/risk_service.py:54). | No, if no mitigation changes task/stage/project facts. | Advisory Project Record; direct creation may be allowed outside read paths (docs/adr/0002-tiered-agent-write-boundary.md:5, docs/adr/0002-tiered-agent-write-boundary.md:9). |
| `ActionCard` | Not from GET; list path only reads (backend/app/api/routes_action_cards.py:26, backend/app/api/routes_action_cards.py:31, backend/app/services/action_card_service.py:35). | No, if treated as guidance and not task mutation. | Advisory Project Record; direct creation may be allowed outside read paths (docs/T41/ProjectFlow_Agent_Runtime_Team_TDD.md:546, docs/T41/ProjectFlow_Agent_Runtime_Team_TDD.md:556). |
| `AgentEvent` | Not from timeline GET; list path only reads (backend/app/api/routes_timeline.py:27, backend/app/api/routes_timeline.py:32, backend/app/services/timeline_service.py:6). | No. | Runtime/timeline metadata. |

## Options

### Option A: Keep the current read-path safety net and document it as an exception

Rule: Keep `_catch_up_stage_progress()` inside `get_project_state()`, and document that ProjectState GET may repair stuck stages.

Pros:

- Lowest short-term cost.
- Preserves current dashboard behavior when seed data or manual DB edits leave all tasks done but stage still active.
- Avoids adding a maintenance command/job.

Cons:

- Violates the T41 `read_only` mental model and makes GET non-repeatable in semantics.
- The side effect changes Primary Project State, not just advisory metadata.
- The route has no explicit commit, so persistence semantics are accidental and session-dependent.
- Dashboard refresh can appear to "decide" stage/project advancement without a command or user action.
- Future reuse of `get_project_state()` inside a transaction that commits could persist the catch-up silently.

Cost: Low now, higher later because tests/docs/tool manifests must carry a special-case exception.

UX/consistency impact: Convenient for stale demos, but confusing. Two reads of the same project can produce different stage/project state, and split fallback behaves differently from aggregate GET.

### Option B: Remove read-path mutation; keep advancement on explicit command paths and add a maintenance job

Rule: Make `get_project_state()` pure read. Keep `try_advance_stage()` in human/command paths such as `POST /tasks/{task_id}/status-updates`, where task status is explicitly changed. For stale data caused by seed/import/direct DB edits, add an explicit repair command/job such as `catch_up_stage_progress(project_id)` that can be invoked by seed reset, admin maintenance, migration, or a scheduled/internal job.

Pros:

- Aligns with T41: read-only tools have `effects.effect_type: none` and no side effects (docs/T41/ProjectFlow_Agent_Tools_Skills_Design.md:221, docs/T41/ProjectFlow_Agent_Tools_Skills_Design.md:222).
- Preserves the deterministic state-machine behavior after actual task-status commands.
- Removes the aggregate-vs-split inconsistency.
- Keeps Primary Project State commits in explicit command/job paths.
- Easy to regression-test: a GET should not dirty/flush/mutate `Project` or `Stage`.

Cons:

- Stale projects from old seed data/direct DB edits will stay stale until the repair command/job runs.
- Requires choosing where repair runs: seed reset, migration, admin script, internal endpoint, or scheduled job.
- If users expect automatic advancement just by opening the dashboard, that behavior changes.

Cost: Medium-low. Move the catch-up call out of `get_project_state()`, expose or reuse a service-level repair command, add tests for GET purity and repair command behavior, and update docs.

UX/consistency impact: Most consistent. Normal user task completion still advances stages; passive dashboard refresh no longer mutates state. Stale-state repair becomes explicit and auditable.

### Option C: Convert stage advancement into a human-confirmed proposal

Rule: When all tasks are done, the system creates a proposal to complete the current stage and activate the next one. A human must confirm before `Project.current_stage_id` or `Stage.status` changes.

Pros:

- Strongest safety boundary for Primary Project State.
- Fits the accepted confirmation principle that models may create proposals but not commit direct project facts (docs/adr/0001-agent-runtime-confirmation-boundary.md:5).
- Gives users a chance to reject accidental advancement when "done" tasks are incorrect.

Cons:

- Too much friction for a deterministic state-machine transition after a human marks every task done.
- Requires a new proposal payload/commit handler or reusing replan proposals for simple advancement.
- Adds UI work and more test matrix.
- Can leave projects visually stuck even after users intentionally completed all tasks.

Cost: Medium-high. Needs proposal type, confirmation UI copy, commit handler, tests, and possibly migration from current auto-advance semantics.

UX/consistency impact: Safest but noisy. Better for Agent-inferred status/stage changes than for deterministic human task completion.

### Option D: Return derived catch-up advice from read paths, but do not write

Rule: ProjectState GET computes that a stage is catch-up eligible and returns an advisory marker such as `repair_needed` or a runtime warning. A separate command/job performs the actual mutation.

Pros:

- Read remains pure.
- Dashboard can explain stale state instead of silently changing it.
- Helps operators discover data drift.

Cons:

- Requires schema/UI changes unless kept out-of-band.
- Users may see warnings without a clear action unless the repair command is also built.
- Still needs Option B's explicit mutation path to resolve the drift.

Cost: Medium. Backend response schema, frontend state display, and command path all need work.

UX/consistency impact: Transparent but potentially cluttered. Useful as an add-on to Option B, not as the only fix.

## Recommended Option

Use Option B as the baseline, with Option D only if the product wants visible stale-state diagnostics.

Concrete recommendation:

1. Remove `_catch_up_stage_progress(session, project_id)` from `get_project_state()`.
2. Keep `try_advance_stage()` in `create_status_update()` because `POST /tasks/{task_id}/status-updates` is an explicit command path (backend/app/services/task_service.py:78, backend/app/services/task_service.py:81, backend/app/api/routes_tasks.py:103).
3. Move stale repair to a named command/job path. Good candidates are seed/reset repair, migration/maintenance script, or internal admin endpoint that is not model-callable read.
4. Keep Agent-inferred task/status/stage changes behind replan proposal confirmation, following ADR 0003 (docs/adr/0003-use-replan-proposals-for-agent-inferred-task-state-changes.md:5, docs/adr/0003-use-replan-proposals-for-agent-inferred-task-state-changes.md:7).

Why not human-confirm every deterministic stage advancement? Because a human already triggered the current command by marking tasks done. The system can deterministically maintain the stage machine in that command transaction. Human confirmation is necessary when the system or Agent infers a Primary Project State change, not when it is a direct consequence of a human task-status command.

## T41 Documentation Rules To Update

Add or tighten these rules in T41 docs:

1. `read_only` means no `session.add()`, no `session.delete()`, no ORM attribute mutation, no `flush()`, no `commit()`, and no call to services that may do any of those. This should apply to both public GET routes and internal read-only tools.
2. `get_workspace_state`, `get_project_state`, and `get_timeline_slice` must have `effects.effect_type: none` and must be repeatable. They may compute derived values, but cannot repair or commit Primary Project State.
3. Primary Project State catch-up is a command/job concern, not a read concern. Deterministic catch-up after a task-status command may commit in that command transaction; stale-data repair from seed/import/direct DB edits must run through an explicit maintenance path.
4. Agent-inferred task status, stage progression, dates, owner changes, or mitigation changes must become replan proposals, not direct writes from read/analysis paths.
5. Advisory writes are limited to Risk/ActionCard creation through declared `advisory_write` tools; they must never be hidden inside read-only ProjectState/WorkspaceState/timeline tools.
6. Regression tests should assert that `GET /api/projects/{project_id}/state` does not change persisted or in-session `Project.status`, `Project.current_stage_id`, or `Stage.status`, and that the explicit repair command/job does perform the catch-up when invoked.

## Highest-Risk Misread

The highest-risk misread is treating the current route-level lack of `commit()` as proof that the behavior is harmless. It is not harmless: `get_project_state()` mutates ORM objects and flushes during a read. Even if the current HTTP route does not explicitly commit, the returned state can reflect the mutation, and future reuse inside a committing transaction can persist it. The architectural problem is the side effect in a read service, not only whether today's GET request commits.
