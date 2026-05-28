import uuid
from datetime import datetime, UTC

from sqlmodel import SQLModel, Field
from sqlalchemy import Column, String, Text

from app.models.enums import ResourceType


class ProjectResource(SQLModel, table=True):
    __tablename__ = "project_resources"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    project_id: str = Field(foreign_key="projects.id")
    type: ResourceType
    title: str
    content_text: str | None = Field(default=None, sa_column=Column(Text, nullable=True))
    file_name: str | None = Field(default=None, sa_column=Column(String, nullable=True))
    url: str | None = Field(default=None, sa_column=Column(String, nullable=True))
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
