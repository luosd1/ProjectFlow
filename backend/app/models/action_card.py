import uuid
from datetime import datetime, timezone

from sqlmodel import SQLModel, Field


class ActionCard(SQLModel, table=True):
    __tablename__ = "action_cards"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    project_id: str = Field(foreign_key="projects.id")
    stage_id: str | None = Field(default=None, foreign_key="stages.id")
    user_id: str | None = Field(default=None, foreign_key="users.id")
    task_id: str | None = Field(default=None, foreign_key="tasks.id")
    type: str  # "personal_task" | "team_next_step" | "reminder" | "risk_action" | "kickoff_tip" | "checkin_prompt" | "assignment_request"
    title: str
    content: str
    reason: str
    due_date: str | None = Field(default=None)  # ISO date string
    status: str = Field(default="active")  # "active" | "done" | "dismissed"
    created_by_agent: bool = Field(default=False)
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc)
    )
