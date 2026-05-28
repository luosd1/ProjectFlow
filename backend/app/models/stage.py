import uuid
from datetime import date, datetime

from sqlmodel import SQLModel, Field
from sqlalchemy import Column, Text, JSON

from app.models.enums import StageStatus


class Stage(SQLModel, table=True):
    __tablename__ = "stages"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    project_id: str = Field(foreign_key="projects.id")
    name: str
    goal: str = Field(sa_column=Column(Text, nullable=False))
    start_date: date
    end_date: date
    deliverable: str = Field(sa_column=Column(Text, nullable=False))
    done_criteria: dict | list = Field(default=[], sa_column=Column(JSON, nullable=False))
    status: StageStatus = Field(default=StageStatus.pending)
    order_index: int = Field(default=0)
