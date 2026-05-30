from datetime import datetime
from pydantic import BaseModel

from app.models.enums import InvitationStatus
from app.schemas.common import EmailText, NonEmptyStr


class InvitationCreate(BaseModel):
    workspace_id: NonEmptyStr
    invited_name: NonEmptyStr
    invited_email: EmailText | None = None


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
    token: NonEmptyStr
    user_id: NonEmptyStr | None = None
