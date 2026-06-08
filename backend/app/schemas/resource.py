import os
from datetime import datetime
from pydantic import BaseModel, field_validator

from app.models.enums import ResourceType
from app.schemas.common import NonEmptyStr


class ResourceCreate(BaseModel):
    project_id: NonEmptyStr
    type: ResourceType
    title: str = "未命名资源"
    content_text: str | None = None
    file_name: str | None = None
    url: str | None = None

    @field_validator("title", mode="before")
    @classmethod
    def ensure_title(cls, v: object) -> str:
        if not isinstance(v, str) or v.strip() == "":
            return "未命名资源"
        return v

    @field_validator("content_text", "file_name", "url", mode="before")
    @classmethod
    def empty_str_to_none(cls, v: object) -> str | None:
        if not isinstance(v, str) or v.strip() == "":
            return None
        return v

    @field_validator("file_name", mode="after")
    @classmethod
    def validate_file_name_path(cls, v: str | None) -> str | None:
        if v is None:
            return None
        if os.path.sep in v or (os.path.altsep and os.path.altsep in v) or ".." in v:
            raise ValueError("file_name 不能包含路径分隔符或父目录引用")
        return v


class ResourceRead(BaseModel):
    id: str
    project_id: str
    type: ResourceType
    title: str
    content_text: str | None
    file_name: str | None
    url: str | None
    created_at: datetime
