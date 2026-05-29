import uuid
from datetime import datetime, timezone

from sqlmodel import SQLModel, Field


class Invitation(SQLModel, table=True):
    __tablename__ = "invitations"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    workspace_id: str = Field(foreign_key="workspaces.id")
    invited_name: str
    invited_email: str | None = Field(default=None)
    token: str = Field(default_factory=lambda: str(uuid.uuid4()))
    status: str = Field(default="pending")  # "pending" | "accepted" | "expired"
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc)
    )
    accepted_at: datetime | None = Field(default=None)
