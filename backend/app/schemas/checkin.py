from datetime import date, datetime

from pydantic import BaseModel, Field

from app.models.enums import CheckInCycleStatus, MoodOrConfidence
from app.schemas.common import NonEmptyStr


class CheckInCycleCreate(BaseModel):
    project_id: NonEmptyStr
    stage_id: NonEmptyStr
    cadence_days: int = Field(default=2, gt=0)
    start_date: date
    created_by_user_id: NonEmptyStr


class CheckInCycleRead(BaseModel):
    id: str
    project_id: str
    stage_id: str
    cadence_days: int
    start_date: date
    next_due_date: date
    status: CheckInCycleStatus
    created_by_user_id: str
    created_at: datetime


class CheckInResponseCreate(BaseModel):
    project_id: NonEmptyStr
    stage_id: NonEmptyStr
    user_id: NonEmptyStr
    task_id: NonEmptyStr | None = None
    what_done: NonEmptyStr
    blocker: NonEmptyStr | None = None
    available_hours_next_cycle: float | None = Field(default=None, ge=0)
    mood_or_confidence: MoodOrConfidence | None = None


class CheckInResponseRead(BaseModel):
    id: str
    cycle_id: str
    project_id: str
    stage_id: str
    user_id: str
    task_id: str | None
    what_done: str
    blocker: str | None
    available_hours_next_cycle: float | None
    mood_or_confidence: MoodOrConfidence | None
    created_at: datetime
