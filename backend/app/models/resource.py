import uuid
from datetime import datetime, timezone

from sqlmodel import SQLModel, Field


class ProjectResource(SQLModel, table=True):
    __tablename__ = "project_resources"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    project_id: str = Field(foreign_key="projects.id")
    type: str  # "text_note" | "file_stub" | "link"
    title: str
    content_text: str | None = Field(default=None)
    file_name: str | None = Field(default=None)
    url: str | None = Field(default=None)
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc)
    )
