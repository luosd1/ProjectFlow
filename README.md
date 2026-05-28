# ProjectFlow

ProjectFlow is a local-first active project agent MVP for college project teams. The demo target is a full loop from workspace setup through planning, assignment, active push, check-in, risk analysis, replanning, and review export.

## Current Status

- Phase 0 / GitHub issue #2 completed on 2026-05-28.
- Phase 1 (models) / GitHub issue #3 completed on 2026-05-29.
- Implemented: FastAPI health API, all 18 domain models with SQLite persistence, Next.js first screen, tests (13 backend), lint/build commands, and runtime ignore rules.
- Next implementation target: core workspace and project APIs (issue #4), agent infrastructure (issue #5), frontend shell (issue #6).

## Stack

- Frontend: Next.js, React, TypeScript, Tailwind CSS
- Backend: FastAPI, SQLModel, Pydantic
- Database: SQLite for local demo data
- Agent: single Coordinator Agent with structured output validation

## Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -e ".[dev]"
uvicorn app.main:app --reload --port 8000
```

Health check:

```bash
curl http://localhost:8000/api/health
```

Backend tests:

```bash
cd backend
.venv\Scripts\python -m pytest app/tests/ -v
```

## Frontend

```bash
cd frontend
npm install
npm run dev
```

Open:

```text
http://localhost:3000
```

Frontend verification:

```bash
cd frontend
npm run test
npm run lint
npm run build
npm audit --omit=dev
```

## Project Docs

- [Technical design](docs/TECH-DESIGN.md)
- [API contract](docs/api-contract.md)
- [Runbook](docs/runbook.md)
- [Current handoff](docs/handoff.md)

## Runtime Files

Keep secrets and local data out of git:

- `.env`
- `backend/data/`
- SQLite files
- `.venv/`
- `node_modules/`
- `frontend/.next/`
