from fastapi import APIRouter, Depends
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
    session: Session = Depends(get_session),
):
    return [_event_to_read(event) for event in list_timeline_by_project(session, project_id)]
