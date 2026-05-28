import uuid
from datetime import datetime, UTC

from sqlmodel import SQLModel, Field
from sqlalchemy import Column, Text, JSON

from app.models.enums import WorkspaceRole


class MemberProfile(SQLModel, table=True):
    __tablename__ = "member_profiles"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    user_id: str = Field(foreign_key="users.id")
    workspace_id: str = Field(foreign_key="workspaces.id")
    skills: dict | list = Field(default=[], sa_column=Column(JSON, nullable=False))
    available_hours_per_week: float = Field(default=0.0)
    role_preference: str = Field(default="")
    interests: str = Field(default="", sa_column=Column(Text, nullable=False))
    constraints: str = Field(default="", sa_column=Column(Text, nullable=False))
    collaboration_preference: str | None = Field(default=None, sa_column=Column(Text, nullable=True))
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
