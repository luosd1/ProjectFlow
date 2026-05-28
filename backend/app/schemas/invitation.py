from datetime import datetime
from pydantic import BaseModel

from app.models.enums import InvitationStatus


class InvitationCreate(BaseModel):
    workspace_id: str
    invited_name: str
    invited_email: str | None = None


class InvitationRead(BaseModel):
    id: str
    workspace_id: str
    invited_name: str
    invited_email: str | None
    token: str
    status: InvitationStatus
    created_at: datetime
    accepted_at: datetime | None


class InvitationAccept(BaseModel):
    token: str
