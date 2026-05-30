from datetime import datetime
from pydantic import BaseModel

from app.schemas.common import EmailText, NonEmptyStr


class UserCreate(BaseModel):
    display_name: NonEmptyStr
    email: EmailText | None = None
    avatar_url: str | None = None


class UserRead(BaseModel):
    id: str
    display_name: str
    email: str | None
    avatar_url: str | None
    created_at: datetime
