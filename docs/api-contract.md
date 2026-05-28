# ProjectFlow API Contract

Status: current as of 2026-05-28.

This document records the implemented API surface first, then the planned MVP surface. Treat planned endpoints as design targets until code and tests exist.

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

Verification:

```bash
curl http://localhost:8000/api/health
```

Notes:

- No authentication.
- No request body.
- Used by backend smoke tests and frontend health checks.

## Planned MVP Endpoints

These routes come from the MVP technical design and are not implemented as of 2026-05-28.

### Users

```http
POST /api/users
GET /api/users/{user_id}
```

### Workspaces

```http
POST /api/workspaces
POST /api/workspaces/{workspace_id}/invitations
POST /api/invitations/{token}/accept
GET /api/workspaces/{workspace_id}/state
```

### Member Profiles

```http
POST /api/workspaces/{workspace_id}/members/{user_id}/profile
GET /api/workspaces/{workspace_id}/members
```

### Projects And Resources

```http
POST /api/workspaces/{workspace_id}/projects
GET /api/projects/{project_id}/state
POST /api/projects/{project_id}/resources
```

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

### Check-ins And Tasks

```http
POST /api/projects/{project_id}/checkin-cycles
POST /api/checkin-cycles/{cycle_id}/responses
POST /api/tasks/{task_id}/status
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
