from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session

from app.core.database import get_session
from app.schemas.workspace_state import WorkspaceStateResponse
from app.services.workspace_state_service import get_workspace_state

router = APIRouter(tags=["workspace-state"])


@router.get("/workspaces/{workspace_id}/state", response_model=WorkspaceStateResponse)
def read_workspace_state(
    workspace_id: str,
    session: Session = Depends(get_session),
):
    state = get_workspace_state(session, workspace_id)
    if not state:
        raise HTTPException(status_code=404, detail="Workspace not found")
    return state
