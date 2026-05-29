import uuid
from datetime import datetime, timezone

from sqlmodel import SQLModel, Field


class AssignmentProposal(SQLModel, table=True):
    __tablename__ = "assignment_proposals"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    project_id: str = Field(foreign_key="projects.id")
    stage_id: str = Field(foreign_key="stages.id")
    task_id: str = Field(foreign_key="tasks.id")
    recommended_owner_user_id: str = Field(foreign_key="users.id")
    backup_owner_user_id: str | None = Field(default=None, foreign_key="users.id")
    reason: str
    skill_match: str | None = Field(default=None)
    availability_match: str | None = Field(default=None)
    preference_match: str | None = Field(default=None)
    constraint_respected: str | None = Field(default=None)
    risk_note: str | None = Field(default=None)
    status: str = Field(default="proposed")  # "proposed" | "owner_confirmed" | "owner_rejected" | "negotiating" | "finalized"
    created_by_agent: bool = Field(default=False)
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc)
    )


class AssignmentResponse(SQLModel, table=True):
    __tablename__ = "assignment_responses"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    proposal_id: str = Field(foreign_key="assignment_proposals.id")
    user_id: str = Field(foreign_key="users.id")
    response: str  # "accept" | "reject"
    preferred_task_id: str | None = Field(default=None, foreign_key="tasks.id")
    reason: str | None = Field(default=None)
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc)
    )


class AssignmentNegotiation(SQLModel, table=True):
    __tablename__ = "assignment_negotiations"

    id: str = Field(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    project_id: str = Field(foreign_key="projects.id")
    stage_id: str = Field(foreign_key="stages.id")
    from_user_id: str = Field(foreign_key="users.id")
    desired_task_id: str = Field(foreign_key="tasks.id")
    current_owner_user_id: str | None = Field(default=None, foreign_key="users.id")
    status: str = Field(default="pending")  # "pending" | "accepted" | "declined" | "resolved"
    agent_message: str = Field(default="")
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc)
    )
