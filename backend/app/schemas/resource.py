from datetime import datetime
from pydantic import BaseModel

from app.models.enums import ResourceType
from app.schemas.common import NonEmptyStr


class ResourceCreate(BaseModel):
    project_id: NonEmptyStr
    type: ResourceType
    title: NonEmptyStr
    content_text: NonEmptyStr | None = None
    file_name: NonEmptyStr | None = None
    url: NonEmptyStr | None = None


class ResourceRead(BaseModel):
    id: str
    project_id: str
    type: ResourceType
    title: str
    content_text: str | None
    file_name: str | None
    url: str | None
    created_at: datetime
