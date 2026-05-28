# ProjectFlow Handoff

Status: current as of 2026-05-28.

## Completed

Phase 0 / GitHub issue #2 is complete and closed.

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

- Backend: 1 test passed.
- Frontend: 1 test passed.
- Frontend lint passed.
- Frontend build passed.
- Frontend production dependency audit reported 0 vulnerabilities.

## Current Implementation Surface

Backend:

- Implemented route: `GET /api/health`.
- Current response: `{"status":"ok","service":"projectflow-backend"}`.
- Domain models and service layer are not implemented yet.

Frontend:

- Implemented route: `/`.
- API base URL comes from `NEXT_PUBLIC_API_BASE_URL` or defaults to `http://localhost:8000/api`.
- Product workflow screens are not implemented yet.

## Next Work

Recommended next implementation target:

1. Add backend domain models for User, Workspace, WorkspaceMembership, Invitation, and MemberProfile.
2. Add matching Pydantic schemas and service functions.
3. Add route-level smoke tests for account/workspace/member profile flow.
4. Keep `docs/api-contract.md` updated as each endpoint lands.

Dependency note:

- Project and resource APIs should wait until workspace/member profile persistence exists.
- Frontend workflow screens can start in parallel only after stable backend contracts or explicit mocks are defined.

## Local Cleanup Notes

Ignored install/build artifacts may exist locally after verification:

- `backend/.venv/`
- `backend/.pytest_cache/`
- Python `__pycache__/`
- `frontend/node_modules/`
- `frontend/.next/`

They are intentionally ignored and must not be committed. Delete them only after explicit approval, because repository guidance treats file and directory deletion as a red-line operation.
