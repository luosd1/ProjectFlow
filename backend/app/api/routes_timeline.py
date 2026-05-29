from fastapi import APIRouter, Depends
from sqlmodel import Session

from app.core.database import get_session
from app.schemas.agent_event import AgentEventRead
from app.services.timeline_service import list_timeline_by_project

router = APIRouter(tags=["timeline"])


@router.get("/projects/{project_id}/timeline", response_model=list[AgentEventRead])
def api_list_timeline_by_project(
    project_id: str,
    session: Session = Depends(get_session),
):
    return list_timeline_by_project(session, project_id)
