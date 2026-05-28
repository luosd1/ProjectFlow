from datetime import datetime
from pydantic import BaseModel

from app.models.enums import WorkspaceRole


class WorkspaceCreate(BaseModel):
    name: str
    description: str | None = None


class WorkspaceRead(BaseModel):
    id: str
    name: str
    owner_user_id: str
    description: str | None
    created_at: datetime
    updated_at: datetime


class WorkspaceMembershipRead(BaseModel):
    id: str
    workspace_id: str
    user_id: str
    role: WorkspaceRole
    joined_at: datetime


class AddMemberRequest(BaseModel):
    user_id: str
    role: WorkspaceRole = WorkspaceRole.member
