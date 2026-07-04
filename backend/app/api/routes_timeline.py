from datetime import datetime

from fastapi import APIRouter, Depends, Query
from sqlmodel import Session

from app.core.database import get_session
from app.models.timeline import AgentEvent
from app.schemas.agent_event import AgentEventRead
from app.services.timeline_service import list_timeline_by_project

router = APIRouter(tags=["timeline"])


def _event_to_read(event: AgentEvent) -> AgentEventRead:
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


@router.get("/projects/{project_id}/timeline", response_model=list[AgentEventRead])
def api_list_timeline_by_project(
    project_id: str,
    limit: int = Query(default=50, ge=1, le=200, description="返回条数上限"),
    since: str | None = Query(default=None, description="只返回此时间之后的事件（ISO 8601）"),
    event_types: str | None = Query(default=None, description="逗号分隔的事件类型过滤"),
    session: Session = Depends(get_session),
):
    events = list_timeline_by_project(session, project_id)

    # Filter by time (strip timezone for SQLite naive datetime comparison)
    if since:
        try:
            since_dt = datetime.fromisoformat(since.replace("Z", "+00:00"))
            # SQLite returns naive datetimes; compare in naive-UTC space
            if since_dt.tzinfo is not None:
                since_dt = since_dt.replace(tzinfo=None)
            events = [e for e in events if e.created_at and e.created_at.replace(tzinfo=None) >= since_dt]
        except (ValueError, TypeError):
            pass  # ignore malformed since parameter

    # Filter by event types
    if event_types:
        type_set = {t.strip() for t in event_types.split(",") if t.strip()}
        if type_set:
            events = [e for e in events if e.event_type in type_set]

    return [_event_to_read(event) for event in events[:limit]]
