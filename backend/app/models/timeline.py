import uuid
from datetime import datetime, timezone

from sqlmodel import SQLModel, Field


class AgentEvent(SQLModel, table=True):
    __tablename__ = "agent_events"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    project_id: str = Field(foreign_key="projects.id")
    workspace_id: str = Field(foreign_key="workspaces.id")
    event_type: str  # "clarify" | "plan" | "breakdown" | "assign" | "negotiate" | "push" | "checkin" | "risk" | "replan" | "export"
    input_snapshot: str = Field(default="{}")  # JSON string
    output_snapshot: str = Field(default="{}")  # JSON string
    reasoning_summary: str = Field(default="")
    user_confirmed: bool = Field(default=False)
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc)
    )
