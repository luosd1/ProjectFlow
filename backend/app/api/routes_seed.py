"""Seed and reset API endpoints for demo management."""

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlmodel import Session

from app.core.database import get_session
from app.core.security import require_demo_admin_access
from app.seed.demo_projectflow import seed_demo_data
from app.seed.reset import reset_demo_data

router = APIRouter(tags=["seed"], dependencies=[Depends(require_demo_admin_access)])


class SeedResponse(BaseModel):
    status: str
    summary: dict


class ResetResponse(BaseModel):
    status: str
    deleted: dict


@router.post("/seed/demo", response_model=SeedResponse)
def load_demo_seed(session: Session = Depends(get_session)):
    """Load demo seed data into the database.

    Creates a realistic 5-6 member student team with full project data.
    Resets existing data first to ensure a clean, deterministic state.
    """
    reset_demo_data(session)
    summary = seed_demo_data(session)
    return SeedResponse(status="ok", summary=summary)


@router.post("/seed/reset", response_model=ResetResponse)
def reset_demo(session: Session = Depends(get_session)):
    """Reset the database to empty state.

    Deletes all rows from all tables. Use before re-seeding for a clean demo.
    """
    result = reset_demo_data(session)
    return ResetResponse(status="ok", deleted=result["deleted"])
