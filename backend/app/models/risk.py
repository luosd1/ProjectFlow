import uuid
from datetime import datetime, UTC

from sqlmodel import SQLModel, Field
from sqlalchemy import Column, String, Text, JSON, Boolean

from app.models.enums import RiskType, RiskSeverity, RiskStatus


class Risk(SQLModel, table=True):
    __tablename__ = "risks"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    project_id: str = Field(foreign_key="projects.id")
    stage_id: str | None = Field(default=None, sa_column=Column(String, nullable=True))
    task_id: str | None = Field(default=None, sa_column=Column(String, nullable=True))
    type: RiskType
    severity: RiskSeverity
    title: str
    description: str = Field(sa_column=Column(Text, nullable=False))
    evidence: dict | list = Field(default=[], sa_column=Column(JSON, nullable=False))
    recommendation: str = Field(sa_column=Column(Text, nullable=False))
    status: RiskStatus = Field(default=RiskStatus.open)
    created_by_agent: bool = Field(default=False)
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
