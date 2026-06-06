import json
import uuid
from datetime import UTC, datetime

from sqlalchemy import Column, Text, UniqueConstraint
from sqlmodel import Field, SQLModel


class AgentConversation(SQLModel, table=True):
    __tablename__ = "agent_conversations"
    __table_args__ = (UniqueConstraint("project_id", name="uq_agent_conversations_project_id"),)

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    workspace_id: str = Field(foreign_key="workspaces.id")
    project_id: str = Field(foreign_key="projects.id")
    status: str = Field(default="active")
    summary: str = Field(default="")
    current_focus: str = Field(default="")
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))


class AgentMessage(SQLModel, table=True):
    __tablename__ = "agent_messages"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    conversation_id: str = Field(foreign_key="agent_conversations.id")
    role: str
    content: str = Field(sa_column=Column(Text, nullable=False))
    structured_payload: str = Field(default="{}", sa_column=Column(Text, nullable=False))
    linked_event_id: str | None = Field(default=None, foreign_key="agent_events.id")
    linked_proposal_id: str | None = Field(default=None, foreign_key="agent_proposals.id")
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))

    def get_structured_payload(self) -> dict:
        try:
            parsed = json.loads(self.structured_payload)
        except json.JSONDecodeError:
            return {}
        return parsed if isinstance(parsed, dict) else {}

    def set_structured_payload(self, value: dict) -> None:
        self.structured_payload = json.dumps(value, ensure_ascii=False)


class AgentRun(SQLModel, table=True):
    __tablename__ = "agent_runs"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    conversation_id: str = Field(foreign_key="agent_conversations.id")
    project_id: str = Field(foreign_key="projects.id")
    user_instruction: str = Field(default="", sa_column=Column(Text, nullable=False))
    selected_module: str
    status: str
    model: str = Field(default="")
    attempts: int = Field(default=0)
    verifier_status: str = Field(default="not_run")
    agent_event_id: str | None = Field(default=None, foreign_key="agent_events.id")
    proposal_id: str | None = Field(default=None, foreign_key="agent_proposals.id")
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    completed_at: datetime | None = Field(default=None)
