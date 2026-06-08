import json
import uuid
from datetime import datetime, timezone

from sqlmodel import SQLModel, Field
from sqlalchemy import Column, Index, Text

from app.models.enums import AgentEventStatus, AgentEventType


class AgentEvent(SQLModel, table=True):
    __tablename__ = "agent_events"
    __table_args__ = (Index("ix_agent_events_project_type_created", "project_id", "event_type", "created_at"),)

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    project_id: str = Field(foreign_key="projects.id", index=True)
    workspace_id: str = Field(foreign_key="workspaces.id", index=True)
    event_type: AgentEventType = Field(index=True)
    status: AgentEventStatus = Field(default=AgentEventStatus.success, index=True)
    input_snapshot: str = Field(default="{}", sa_column=Column(Text, nullable=False))
    output_snapshot: str = Field(default="{}", sa_column=Column(Text, nullable=False))
    reasoning_summary: str = Field(sa_column=Column(Text, nullable=False))
    user_confirmed: bool = Field(default=False)
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc)
    )

    # -- helpers for JSON round-trip ----------------------------------------

    def get_input_snapshot(self) -> dict | list:
        """Deserialize ``input_snapshot`` from its stored JSON string."""
        return json.loads(self.input_snapshot)

    def set_input_snapshot(self, value: dict | list) -> None:
        """Serialize *value* and store as a JSON string."""
        self.input_snapshot = json.dumps(value, ensure_ascii=False)

    def get_output_snapshot(self) -> dict | list:
        """Deserialize ``output_snapshot`` from its stored JSON string."""
        return json.loads(self.output_snapshot)

    def set_output_snapshot(self, value: dict | list) -> None:
        """Serialize *value* and store as a JSON string."""
        self.output_snapshot = json.dumps(value, ensure_ascii=False)
