from sqlmodel import Session, select

from app.models import AgentEvent


def list_timeline_by_project(session: Session, project_id: str) -> list[AgentEvent]:
    return list(
        session.exec(
            select(AgentEvent)
            .where(AgentEvent.project_id == project_id)
            .order_by(AgentEvent.created_at.desc())
        ).all()
    )
