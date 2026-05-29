import uuid
from datetime import datetime, timezone

from sqlmodel import SQLModel, Field


class CheckInCycle(SQLModel, table=True):
    __tablename__ = "checkin_cycles"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    project_id: str = Field(foreign_key="projects.id")
    stage_id: str = Field(foreign_key="stages.id")
    cadence_days: int = Field(default=2)
    start_date: str  # ISO date string
    next_due_date: str  # ISO date string
    status: str = Field(default="active")  # "active" | "paused" | "completed"
    created_by_user_id: str = Field(foreign_key="users.id")
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc)
    )


class CheckInResponse(SQLModel, table=True):
    __tablename__ = "checkin_responses"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    cycle_id: str = Field(foreign_key="checkin_cycles.id")
    project_id: str = Field(foreign_key="projects.id")
    stage_id: str = Field(foreign_key="stages.id")
    user_id: str = Field(foreign_key="users.id")
    task_id: str | None = Field(default=None, foreign_key="tasks.id")
    what_done: str
    blocker: str | None = Field(default=None)
    available_hours_next_cycle: float | None = Field(default=None)
    mood_or_confidence: str | None = Field(default=None)  # "low" | "medium" | "high"
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc)
    )
