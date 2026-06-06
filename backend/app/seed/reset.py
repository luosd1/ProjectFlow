"""Demo reset: clears all data from all tables."""

from sqlmodel import Session, select

from app.models import (
    User,
    Workspace,
    WorkspaceMembership,
    Invitation,
    MemberProfile,
    Project,
    ProjectResource,
    Stage,
    Task,
    TaskStatusUpdate,
    AssignmentProposal,
    AssignmentResponse,
    AssignmentNegotiation,
    CheckInCycle,
    CheckInResponse,
    Risk,
    ActionCard,
    AgentEvent,
    AgentProposal,
    AgentConversation,
    AgentMessage,
    AgentRun,
)

# All model tables in reverse dependency order (children first)
ALL_TABLES = [
    AgentMessage,
    AgentRun,
    AgentConversation,
    AgentProposal,
    AgentEvent,
    ActionCard,
    Risk,
    CheckInResponse,
    CheckInCycle,
    AssignmentNegotiation,
    AssignmentResponse,
    AssignmentProposal,
    TaskStatusUpdate,
    Task,
    Stage,
    ProjectResource,
    Project,
    MemberProfile,
    Invitation,
    WorkspaceMembership,
    Workspace,
    User,
]


def reset_demo_data(session: Session) -> dict:
    """Delete all rows from all tables. Returns counts of deleted rows."""

    deleted = {}
    for model in ALL_TABLES:
        rows = session.exec(select(model)).all()
        count = len(rows)
        for row in rows:
            session.delete(row)
        deleted[model.__tablename__] = count

    session.commit()
    return {"deleted": deleted}
