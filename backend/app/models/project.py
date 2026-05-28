import uuid
from datetime import date, datetime, UTC

from sqlmodel import SQLModel, Field
from sqlalchemy import Column, Text, JSON, String

from app.models.enums import ProjectStatus


class Project(SQLModel, table=True):
    __tablename__ = "projects"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    workspace_id: str = Field(foreign_key="workspaces.id")
    name: str
    idea: str = Field(sa_column=Column(Text, nullable=False))
    deadline: date
    deliverables: str = Field(sa_column=Column(Text, nullable=False))
    status: ProjectStatus = Field(default=ProjectStatus.draft)
    current_stage_id: str | None = Field(default=None, sa_column=Column(String, nullable=True))
    direction_card: dict | None = Field(default=None, sa_column=Column(JSON, nullable=True))
    created_by: str = Field(foreign_key="users.id")
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
