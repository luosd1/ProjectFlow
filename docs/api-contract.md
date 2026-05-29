# ProjectFlow API Contract

Status: current as of 2026-05-29.

This document records the implemented API surface first, then the planned MVP surface. Treat planned endpoints as design targets until code and tests exist.

The frontend API layer (`frontend/src/lib/api.ts`) uses implemented backend endpoints where they exist. Agent, assignment, check-in, risk, replan, and export methods remain typed design-target wrappers until the matching backend routes and tests exist.

## Base URL

```text
http://localhost:8000/api
```

## Implemented Endpoints

### Health

```http
GET /api/health
```

Response:

```json
{
  "status": "ok",
  "service": "projectflow-backend"
}
```

### Users

```http
POST /api/users
GET /api/users
GET /api/users/{user_id}
```

### Workspaces

```http
POST /api/workspaces?owner_user_id=...
GET /api/workspaces
GET /api/workspaces/{workspace_id}
POST /api/workspaces/{workspace_id}/members
```

### Invitations

```http
POST /api/invitations
POST /api/invitations/accept
```

### Member Profiles

```http
POST /api/member-profiles
GET /api/member-profiles/{profile_id}
PATCH /api/member-profiles/{profile_id}
GET /api/workspaces/{workspace_id}/profiles
```

### Projects

```http
POST /api/projects
GET /api/projects/{project_id}
GET /api/workspaces/{workspace_id}/projects
PATCH /api/projects/{project_id}
```

### Resources

```http
POST /api/resources
GET /api/projects/{project_id}/resources
```

### Stages

```http
POST /api/stages
GET /api/stages/{stage_id}
GET /api/projects/{project_id}/stages
PATCH /api/stages/{stage_id}
```

### Tasks

```http
POST /api/tasks
GET /api/tasks/{task_id}
GET /api/stages/{stage_id}/tasks
GET /api/projects/{project_id}/tasks
PATCH /api/tasks/{task_id}
POST /api/tasks/{task_id}/status-updates
```

### Workspace State

```http
GET /api/workspaces/{workspace_id}/state
```

Returns the full workspace state (members, project, stages, tasks) needed by the Coordinator Agent.

### Frontend Project State Composition

The project dashboard currently composes its `ProjectState` from implemented endpoints instead of relying on a dedicated project-state route:

- `GET /api/projects/{project_id}`
- `GET /api/workspaces/{workspace_id}`
- `GET /api/projects/{project_id}/resources`
- `GET /api/projects/{project_id}/stages`
- `GET /api/projects/{project_id}/tasks`
- `GET /api/users`
- `GET /api/workspaces/{workspace_id}/profiles`

Assignment responses and negotiations are represented in frontend types and UI, but their backend persistence routes are still planned.

## Planned MVP Endpoints

These routes come from the MVP technical design and are not implemented as of 2026-05-29.

### Agent

```http
POST /api/projects/{project_id}/agent/clarify
POST /api/projects/{project_id}/agent/plan
POST /api/projects/{project_id}/agent/breakdown
POST /api/projects/{project_id}/agent/assign
POST /api/projects/{project_id}/agent/push
POST /api/projects/{project_id}/agent/analyze-checkins
POST /api/projects/{project_id}/agent/risk-analysis
POST /api/projects/{project_id}/agent/replan
```

All planned Agent responses must include structured data, a timeline event id, and whether human confirmation is required.

### Confirmation

```http
POST /api/projects/{project_id}/confirm
```

### Assignments

```http
POST /api/assignment-proposals/{proposal_id}/response
POST /api/projects/{project_id}/assignments/negotiate
POST /api/assignment-negotiations/{negotiation_id}/resolve
POST /api/stages/{stage_id}/assignments/finalize
```

### Check-ins

```http
POST /api/projects/{project_id}/checkin-cycles
POST /api/checkin-cycles/{cycle_id}/responses
```

### Export

```http
POST /api/projects/{project_id}/export/review-summary
```

## Contract Rules

- API route handlers only handle request and response wiring.
- Business behavior belongs in `backend/app/services`.
- Request and response bodies must go through Pydantic schemas in `backend/app/schemas`.
- Agent output must be structured and validated before a service persists it.
- High-impact Agent suggestions must return proposals and wait for explicit confirmation before final state changes.
