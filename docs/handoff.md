# ProjectFlow Handoff

Status: current as of 2026-05-29.

## Completed

Phase 0 / GitHub issue #2 is complete and closed.
Phase 1 (models) / GitHub issue #3 is complete and closed.

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

## Verification Baseline

Commands run successfully on 2026-05-28:

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

- Backend: 13 tests passed.
- Frontend: 1 test passed.
- Frontend lint passed.
- Frontend build passed.
- Frontend production dependency audit reported 0 vulnerabilities.

## Current Implementation Surface

Backend:

- Implemented route: `GET /api/health`.
- Current response: `{"status":"ok","service":"projectflow-backend"}`.
- Domain models implemented (18 models, all enums).
- Service layer and API routes are not implemented yet.

Frontend:

- Implemented route: `/`.
- API base URL comes from `NEXT_PUBLIC_API_BASE_URL` or defaults to `http://localhost:8000/api`.
- Product workflow screens are not implemented yet.

## Next Work

Recommended next implementation target:

1. Core Workspace and Project APIs (issue #4) — schemas, services, routes for workspace/account/member/project/resource/stage/task.
2. Agent Infrastructure and Structured Outputs (issue #5) — can run in parallel with #4.
3. Frontend Shell, Onboarding, Workspace, and Intake (issue #6) — can run in parallel with #4.

Dependency note:

- #4 and #5 depend on #3 (domain models) which is now complete.
- #6 (frontend) can run in parallel with backend work.

## Local Cleanup Notes

Ignored install/build artifacts may exist locally after verification:

- `backend/.venv/`
- `backend/.pytest_cache/`
- Python `__pycache__/`
- `frontend/node_modules/`
- `frontend/.next/`

They are intentionally ignored and must not be committed. Delete them only after explicit approval, because repository guidance treats file and directory deletion as a red-line operation.
