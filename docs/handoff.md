# ProjectFlow Handoff

Status: current as of 2026-05-29.

## Completed

### Phase 0 / GitHub issue #2 (2026-05-28)

- Repository guardrails in `AGENTS.md` and `CLAUDE.md`.
- Root `README.md` with local setup and verification commands.
- Backend FastAPI scaffold with `GET /api/health`.
- Backend config and SQLite engine skeleton.
- Backend smoke test for health API.
- Frontend Next.js scaffold with a first ProjectFlow screen.
- Frontend API helper and type placeholders.
- Frontend test, lint, and production build setup.
- Runtime ignore rules for secrets, local databases, dependency folders, and generated caches.

### GitHub issue #6 (2026-05-29)

- App shell with responsive navigation (desktop links + mobile hamburger sheet).
- Onboarding flow: account setup form (create/select demo identity) and member profile wizard (3-step: skills, availability, preferences).
- Workspace flow: create workspace form, invite member panel with copy-link, workspace dashboard.
- Project intake: project idea/deadline/deliverables form, resource input panel (text notes, links, file references), project dashboard.
- Full domain types in `frontend/src/lib/types.ts` (User, Workspace, MemberProfile, Project, Stage, Task, Assignment, CheckIn, Risk, ActionCard, AgentEvent, etc.).
- Full API layer in `frontend/src/lib/api.ts` (users, workspaces, invitations, profiles, projects, resources, agent, assignments, checkins, tasks, export).
- shadcn/ui installed with 16 components (button, card, input, label, select, textarea, badge, separator, avatar, dialog, dropdown-menu, sheet, tabs, tooltip, progress).
- Tailwind config updated with CSS variable colors for shadcn/ui compatibility.

## Verification Baseline

Commands run successfully on 2026-05-29:

```bash
cd frontend
npm run test
npm run lint
npm run build
```

Results:

- Frontend: 1 test passed.
- Frontend lint passed.
- Frontend build passed (7 routes generated).

## Current Implementation Surface

Backend:

- Implemented route: `GET /api/health`.
- Current response: `{"status":"ok","service":"projectflow-backend"}`.
- Domain models and service layer are not implemented yet.

Frontend:

- Implemented routes: `/`, `/onboarding`, `/onboarding/profile`, `/workspaces/new`, `/workspaces/[workspaceId]`, `/projects/new`, `/projects/[projectId]`.
- API base URL comes from `NEXT_PUBLIC_API_BASE_URL` or defaults to `http://localhost:8000/api`.
- All API calls go through `frontend/src/lib/api.ts`.
- All types defined in `frontend/src/lib/types.ts`.
- UI components use shadcn/ui (base-nova style) with project color tokens (ink, paper, moss, citron, coral, harbor).

## Next Work

Recommended next implementation target:

1. Backend domain models (#3): User, Workspace, WorkspaceMembership, Invitation, MemberProfile.
2. Core workspace/project APIs (#4): CRUD endpoints matching the frontend API layer.
3. Agent infrastructure (#5): LLM client, coordinator, structured output schemas.

Dependency note:

- Frontend pages are built against the API contract. They will work with mock data until backend endpoints are ready.
- Backend issue #3 is currently in progress.

## Local Cleanup Notes

Ignored install/build artifacts may exist locally after verification:

- `backend/.venv/`
- `backend/.pytest_cache/`
- Python `__pycache__/`
- `frontend/node_modules/`
- `frontend/.next/`

They are intentionally ignored and must not be committed.
