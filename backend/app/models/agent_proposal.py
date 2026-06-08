import uuid
from datetime import datetime, UTC

from sqlalchemy import Index
from sqlmodel import SQLModel, Field

from app.models.enums import AgentProposalStatus


class AgentProposal(SQLModel, table=True):
    __tablename__ = "agent_proposals"
    __table_args__ = (Index("ix_agent_proposals_project_type_status", "project_id", "proposal_type", "status"),)

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    project_id: str = Field(foreign_key="projects.id", index=True)
    workspace_id: str = Field(foreign_key="workspaces.id", index=True)
    proposal_type: str = Field(index=True)  # "clarify" | "plan" | "breakdown" | "replan"
    status: AgentProposalStatus = Field(default=AgentProposalStatus.pending, index=True)
    agent_event_id: str = Field(foreign_key="agent_events.id", index=True)
    payload: str = Field(default="{}")  # JSON string
    confirmed_by: str | None = Field(default=None, foreign_key="users.id", index=True)
    confirmed_at: datetime | None = Field(default=None)
    rejection_reason: str | None = Field(default=None)
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
