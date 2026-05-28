import uuid
from datetime import date, datetime, UTC

from sqlmodel import SQLModel, Field
from sqlalchemy import Column, String, Text, Boolean

from app.models.enums import ActionCardType, ActionCardStatus


class ActionCard(SQLModel, table=True):
    __tablename__ = "action_cards"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    project_id: str = Field(foreign_key="projects.id")
    stage_id: str | None = Field(default=None, sa_column=Column(String, nullable=True))
    user_id: str | None = Field(default=None, sa_column=Column(String, nullable=True))
    task_id: str | None = Field(default=None, sa_column=Column(String, nullable=True))
    type: ActionCardType
    title: str
    content: str = Field(sa_column=Column(Text, nullable=False))
    reason: str = Field(sa_column=Column(Text, nullable=False))
    due_date: date | None = Field(default=None)
    status: ActionCardStatus = Field(default=ActionCardStatus.active)
    created_by_agent: bool = Field(default=False)
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
