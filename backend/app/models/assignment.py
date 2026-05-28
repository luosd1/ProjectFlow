import uuid
from datetime import datetime, UTC

from sqlmodel import SQLModel, Field
from sqlalchemy import Column, String, Text, Boolean

from app.models.enums import AssignmentProposalStatus, AssignmentResponseType, NegotiationStatus


class AssignmentProposal(SQLModel, table=True):
    __tablename__ = "assignment_proposals"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    project_id: str = Field(foreign_key="projects.id")
    stage_id: str = Field(foreign_key="stages.id")
    task_id: str = Field(foreign_key="tasks.id")
    recommended_owner_user_id: str = Field(foreign_key="users.id")
    backup_owner_user_id: str | None = Field(default=None, sa_column=Column(String, nullable=True))
    reason: str = Field(sa_column=Column(Text, nullable=False))
    risk_note: str | None = Field(default=None, sa_column=Column(Text, nullable=True))
    status: AssignmentProposalStatus = Field(default=AssignmentProposalStatus.proposed)
    created_by_agent: bool = Field(default=False)
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))


class AssignmentResponse(SQLModel, table=True):
    __tablename__ = "assignment_responses"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    proposal_id: str = Field(foreign_key="assignment_proposals.id")
    user_id: str = Field(foreign_key="users.id")
    response: AssignmentResponseType
    preferred_task_id: str | None = Field(default=None, sa_column=Column(String, nullable=True))
    reason: str | None = Field(default=None, sa_column=Column(Text, nullable=True))
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))


class AssignmentNegotiation(SQLModel, table=True):
    __tablename__ = "assignment_negotiations"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    project_id: str = Field(foreign_key="projects.id")
    stage_id: str = Field(foreign_key="stages.id")
    from_user_id: str = Field(foreign_key="users.id")
    desired_task_id: str = Field(foreign_key="tasks.id")
    current_owner_user_id: str | None = Field(default=None, sa_column=Column(String, nullable=True))
    status: NegotiationStatus = Field(default=NegotiationStatus.pending)
    agent_message: str = Field(sa_column=Column(Text, nullable=False))
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
