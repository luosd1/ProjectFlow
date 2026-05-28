# ProjectFlow

ProjectFlow is a local-first active project agent MVP for college project teams. The demo target is a full loop from workspace setup through planning, assignment, active push, check-in, risk analysis, replanning, and review export.

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
```

## Runtime Files

Keep secrets and local data out of git:

- `.env`
- `backend/data/`
- SQLite files
- `.venv/`
- `node_modules/`
- `.next/`
