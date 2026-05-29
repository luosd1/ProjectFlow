from datetime import date, datetime

from pydantic import BaseModel

from app.models.enums import ActionCardStatus, ActionCardType


class ActionCardCreate(BaseModel):
    project_id: str
    stage_id: str | None = None
    user_id: str | None = None
    task_id: str | None = None
    type: ActionCardType
    title: str
    content: str
    reason: str
    goal: str | None = None
    start_suggestion: str | None = None
    completion_standard: str | None = None
    due_date: date | None = None
    created_by_agent: bool = False


class ActionCardRead(BaseModel):
    id: str
    project_id: str
    stage_id: str | None
    user_id: str | None
    task_id: str | None
    type: ActionCardType
    title: str
    content: str
    reason: str
    goal: str | None
    start_suggestion: str | None
    completion_standard: str | None
    due_date: date | None
    status: ActionCardStatus
    created_by_agent: bool
    created_at: datetime


class ActionCardUpdate(BaseModel):
    status: ActionCardStatus
