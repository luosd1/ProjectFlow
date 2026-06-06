import uuid
from datetime import datetime, timezone

from sqlmodel import SQLModel, Field


class Task(SQLModel, table=True):
    __tablename__ = "tasks"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    project_id: str = Field(foreign_key="projects.id")
    stage_id: str = Field(foreign_key="stages.id")
    title: str
    description: str = Field(default="")
    priority: str = Field(default="P1")  # "P0" | "P1" | "P2"
    status: str = Field(default="not_started")  # "not_started" | "in_progress" | "done" | "blocked"
    owner_user_id: str | None = Field(default=None, foreign_key="users.id")
    backup_owner_user_id: str | None = Field(default=None, foreign_key="users.id")
    due_date: str = Field(default="")  # ISO date string
    estimated_hours: float = Field(default=0.0)
    dependency_ids: str = Field(default="[]")  # JSON string: ["task_id1", ...]
    acceptance_criteria: str = Field(default="[]")  # JSON string: ["criterion1", ...]
    can_cut: bool = Field(default=False)
    assignment_reason: str | None = Field(default=None)
    order_index: int = Field(default=0)
    created_by_agent: bool = Field(default=False)
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc)
    )


class TaskStatusUpdate(SQLModel, table=True):
    __tablename__ = "task_status_updates"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    task_id: str = Field(foreign_key="tasks.id")
    user_id: str = Field(foreign_key="users.id")
    status: str  # "not_started" | "in_progress" | "done" | "blocked"
    progress_note: str | None = Field(default=None)
    blocker: str | None = Field(default=None)
    available_hours_change: float | None = Field(default=None)
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc)
    )
