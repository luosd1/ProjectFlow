# ProjectFlow Handoff

Status: current as of 2026-05-29.

## Completed

Phase 0 / GitHub issue #2 is complete and closed.
Phase 1 (models) / GitHub issue #3 is complete and closed.
Phase 2 (core APIs) / GitHub issue #4 is complete and closed.

Implemented scope:

- Repository guardrails in `AGENTS.md` and `CLAUDE.md`.
- Root `README.md` with local setup and verification commands.
- Backend FastAPI scaffold with `GET /api/health`.
- Backend config and SQLite engine skeleton.
- Backend smoke test for health API.
- Frontend Next.js scaffold with a first ProjectFlow screen.
- Frontend API helper and type placeholders.
- Frontend test, lint, and production build setup.
- Runtime ignore rules for secrets, local databases, dependency folders, and generated caches.
- All 18 domain models in `backend/app/models/` with full enum alignment.
- Database auto-creates tables on FastAPI startup via lifespan.
- 12 model smoke tests covering insert/read for every model.
- Full CRUD APIs: users, workspaces, invitations, member-profiles, projects, resources, stages, tasks.
- WorkspaceState assembly endpoint: `GET /api/workspaces/{id}/state`.
- Service layer for all CRUD domains in `backend/app/services/`.
- Pydantic schemas for all CRUD domains in `backend/app/schemas/`.
- 9 API smoke tests covering full demo path and list endpoints.

## Verification Baseline

Commands run successfully on 2026-05-29:

```bash
cd backend
.venv\Scripts\python -m pytest app/tests/ -v
```

```bash
cd frontend
npm run test
npm run lint
npm run build
npm audit --omit=dev
```

Results:

- Backend: 21 tests passed.
- Frontend: 1 test passed.
- Frontend lint passed.
- Frontend build passed.
- Frontend production dependency audit reported 0 vulnerabilities.

## Current Implementation Surface

Backend:

- Implemented routes: health, users (3), workspaces (4), invitations (2), member-profiles (4), projects (4), resources (2), stages (4), tasks (6), workspace-state (1). Total: 30 endpoints.
- Domain models implemented (18 models, all enums).
- Service layer implemented for all CRUD domains.
- Pydantic schemas implemented for all CRUD domains.
- WorkspaceState endpoint returns members, project, stages, tasks for Agent consumption.

Frontend:

- Implemented route: `/`.
- API base URL comes from `NEXT_PUBLIC_API_BASE_URL` or defaults to `http://localhost:8000/api`.
- Product workflow screens are not implemented yet.

## Next Work

Recommended next implementation target:

1. Agent Infrastructure and Structured Outputs (issue #5) — LLM client, coordinator, output schemas, fallback pipeline.
2. Frontend Shell, Onboarding, Workspace, and Intake (issue #6, in progress) — can run in parallel with #5.
3. Planning and Assignment Dashboard UI (issue #7) — depends on #5 and #6.

Dependency note:

- #5 depends on #3 (domain models) which is complete.
- #6 (frontend) is running in parallel.
- #7 depends on both #5 and #6.

## Local Cleanup Notes

Ignored install/build artifacts may exist locally after verification:

- `backend/.venv/`
- `backend/.pytest_cache/`
- Python `__pycache__/`
- `frontend/node_modules/`
- `frontend/.next/`

They are intentionally ignored and must not be committed. Delete them only after explicit approval, because repository guidance treats file and directory deletion as a red-line operation.
