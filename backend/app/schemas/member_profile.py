from datetime import datetime
from pydantic import BaseModel, Field

from app.schemas.common import NonEmptyStr


class MemberProfileCreate(BaseModel):
    user_id: NonEmptyStr
    workspace_id: NonEmptyStr
    skills: list[str | dict] = Field(default_factory=list)
    available_hours_per_week: float = Field(default=0.0, ge=0)
    role_preference: str = ""
    interests: str = ""
    constraints: str = ""
    collaboration_preference: str | None = None


class MemberProfileUpdate(BaseModel):
    skills: list[str | dict] | None = None
    available_hours_per_week: float | None = Field(default=None, ge=0)
    role_preference: str | None = None
    interests: str | None = None
    constraints: str | None = None
    collaboration_preference: str | None = None


class MemberProfileRead(BaseModel):
    id: str
    user_id: str
    workspace_id: str
    skills: list[str | dict]
    available_hours_per_week: float
    role_preference: str
    interests: str
    constraints: str
    collaboration_preference: str | None
    created_at: datetime
    updated_at: datetime
