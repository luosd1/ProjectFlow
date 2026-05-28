import uuid
from datetime import datetime, UTC

from sqlmodel import SQLModel, Field
from sqlalchemy import Column, String, Text

from app.models.enums import InvitationStatus


class Invitation(SQLModel, table=True):
    __tablename__ = "invitations"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    workspace_id: str = Field(foreign_key="workspaces.id")
    invited_name: str
    invited_email: str | None = Field(default=None, sa_column=Column(String, nullable=True))
    token: str = Field(default_factory=lambda: str(uuid.uuid4()))
    status: InvitationStatus = Field(default=InvitationStatus.pending)
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    accepted_at: datetime | None = Field(default=None)
