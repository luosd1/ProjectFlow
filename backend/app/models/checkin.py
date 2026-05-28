import uuid
from datetime import date, datetime, UTC

from sqlmodel import SQLModel, Field
from sqlalchemy import Column, String, Text

from app.models.enums import CheckInCycleStatus, MoodOrConfidence


class CheckInCycle(SQLModel, table=True):
    __tablename__ = "checkin_cycles"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    project_id: str = Field(foreign_key="projects.id")
    stage_id: str = Field(foreign_key="stages.id")
    cadence_days: int = Field(default=2)
    start_date: date
    next_due_date: date
    status: CheckInCycleStatus = Field(default=CheckInCycleStatus.active)
    created_by_user_id: str = Field(foreign_key="users.id")
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))


class CheckInResponse(SQLModel, table=True):
    __tablename__ = "checkin_responses"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    cycle_id: str = Field(foreign_key="checkin_cycles.id")
    project_id: str = Field(foreign_key="projects.id")
    stage_id: str = Field(foreign_key="stages.id")
    user_id: str = Field(foreign_key="users.id")
    task_id: str | None = Field(default=None, sa_column=Column(String, nullable=True))
    what_done: str = Field(sa_column=Column(Text, nullable=False))
    blocker: str | None = Field(default=None, sa_column=Column(Text, nullable=True))
    available_hours_next_cycle: float | None = Field(default=None)
    mood_or_confidence: MoodOrConfidence | None = Field(default=None)
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
