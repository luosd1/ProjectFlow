import uuid
from datetime import datetime, UTC

from sqlmodel import SQLModel, Field
from sqlalchemy import Column, String


class User(SQLModel, table=True):
    __tablename__ = "users"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    display_name: str
    email: str | None = Field(default=None, sa_column=Column(String, nullable=True))
    avatar_url: str | None = Field(default=None, sa_column=Column(String, nullable=True))
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
