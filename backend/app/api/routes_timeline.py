from fastapi import APIRouter, Depends, Query
from sqlmodel import Session

from app.core.database import get_session
from app.schemas.agent_event import AgentEventRead
from app.services.timeline_service import event_to_read, list_timeline_by_project

router = APIRouter(tags=["timeline"])


@router.get("/projects/{project_id}/timeline", response_model=list[AgentEventRead])
def api_list_timeline_by_project(
    project_id: str,
    limit: int = Query(default=50, ge=1, le=200, description="返回条数上限"),
    since: str | None = Query(default=None, description="只返回此时间之后的事件（ISO 8601）"),
    event_types: str | None = Query(default=None, description="逗号分隔的事件类型过滤"),
    session: Session = Depends(get_session),
):
    events = list_timeline_by_project(
        session,
        project_id,
        limit=limit,
        since=since,
        event_types=event_types,
    )
    return [event_to_read(event) for event in events]
