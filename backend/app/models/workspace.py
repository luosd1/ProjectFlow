import uuid
from datetime import datetime, UTC

from sqlmodel import SQLModel, Field
from sqlalchemy import Column, String, Text

from app.models.enums import WorkspaceRole


class Workspace(SQLModel, table=True):
    __tablename__ = "workspaces"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    name: str
    owner_user_id: str = Field(foreign_key="users.id")
    description: str | None = Field(default=None, sa_column=Column(Text, nullable=True))
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))


class WorkspaceMembership(SQLModel, table=True):
    __tablename__ = "workspace_memberships"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    workspace_id: str = Field(foreign_key="workspaces.id")
    user_id: str = Field(foreign_key="users.id")
    role: WorkspaceRole = Field(default=WorkspaceRole.member)
    joined_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
