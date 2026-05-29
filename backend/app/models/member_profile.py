import uuid
from datetime import datetime, timezone

from sqlmodel import SQLModel, Field


class MemberProfile(SQLModel, table=True):
    __tablename__ = "member_profiles"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    user_id: str = Field(foreign_key="users.id")
    workspace_id: str = Field(foreign_key="workspaces.id")
    skills: str = Field(default="[]")  # JSON string: [{"name": "frontend", "level": 3}]
    available_hours_per_week: int = Field(default=0)
    role_preference: str = Field(default="")
    interests: str = Field(default="")
    constraints: str = Field(default="")
    collaboration_preference: str | None = Field(default=None)
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc)
    )
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc)
    )
