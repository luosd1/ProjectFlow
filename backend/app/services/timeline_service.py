from datetime import datetime

from sqlmodel import Session, select

from app.models import AgentEvent
from app.schemas.agent_event import AgentEventRead


def event_to_read(event: AgentEvent) -> AgentEventRead:
    """Convert an AgentEvent model to AgentEventRead."""
    return AgentEventRead(
        id=event.id,
        project_id=event.project_id,
        workspace_id=event.workspace_id,
        event_type=event.event_type,
        status=event.status,
        input_snapshot=event.get_input_snapshot(),
        output_snapshot=event.get_output_snapshot(),
        reasoning_summary=event.reasoning_summary,
        user_confirmed=event.user_confirmed,
        created_at=event.created_at,
    )


def list_timeline_by_project(
    session: Session,
    project_id: str,
    *,
    limit: int = 50,
    since: str | None = None,
    event_types: str | None = None,
) -> list[AgentEvent]:
    """Return timeline events for a project, optionally filtered by time and type.

    Filtering lives in the service (not the route) so the read-only agent tool
    and the public API share one implementation. Malformed ``since`` is ignored
    rather than raising — callers pass user-supplied ISO 8601 strings.
    """
    events = list(
        session.exec(
            select(AgentEvent)
            .where(AgentEvent.project_id == project_id)
            .order_by(AgentEvent.created_at.desc())
        ).all()
    )

    # Filter by time (strip timezone for SQLite naive datetime comparison)
    if since:
        try:
            since_dt = datetime.fromisoformat(since.replace("Z", "+00:00"))
            # SQLite returns naive datetimes; compare in naive-UTC space
            if since_dt.tzinfo is not None:
                since_dt = since_dt.replace(tzinfo=None)
            events = [
                e for e in events if e.created_at and e.created_at.replace(tzinfo=None) >= since_dt
            ]
        except (ValueError, TypeError):
            pass  # ignore malformed since parameter

    # Filter by event types (comma-separated)
    if event_types:
        type_set = {t.strip() for t in event_types.split(",") if t.strip()}
        if type_set:
            events = [e for e in events if e.event_type in type_set]

    return events[:limit]
