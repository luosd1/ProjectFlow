import uuid
from datetime import date, datetime, UTC

from sqlmodel import SQLModel, Field
from sqlalchemy import Column, String, Text, JSON, Boolean

from app.models.enums import TaskPriority, TaskStatus


class Task(SQLModel, table=True):
    __tablename__ = "tasks"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    project_id: str = Field(foreign_key="projects.id")
    stage_id: str = Field(foreign_key="stages.id")
    title: str
    description: str = Field(sa_column=Column(Text, nullable=False))
    priority: TaskPriority = Field(default=TaskPriority.P1)
    status: TaskStatus = Field(default=TaskStatus.not_started)
    owner_user_id: str | None = Field(default=None, sa_column=Column(String, nullable=True))
    backup_owner_user_id: str | None = Field(default=None, sa_column=Column(String, nullable=True))
    due_date: date
    estimated_hours: float = Field(default=0.0)
    dependency_ids: dict | list = Field(default=[], sa_column=Column(JSON, nullable=False))
    acceptance_criteria: dict | list = Field(default=[], sa_column=Column(JSON, nullable=False))
    can_cut: bool = Field(default=False)
    assignment_reason: str | None = Field(default=None, sa_column=Column(Text, nullable=True))
    created_by_agent: bool = Field(default=False)
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))


class TaskStatusUpdate(SQLModel, table=True):
    __tablename__ = "task_status_updates"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    task_id: str = Field(foreign_key="tasks.id")
    user_id: str = Field(foreign_key="users.id")
    status: TaskStatus
    progress_note: str | None = Field(default=None, sa_column=Column(Text, nullable=True))
    blocker: str | None = Field(default=None, sa_column=Column(Text, nullable=True))
    available_hours_change: float | None = Field(default=None)
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
