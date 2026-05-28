from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session

from app.core.database import get_session
from app.models.enums import WorkspaceRole
from app.schemas.workspace import (
    AddMemberRequest,
    WorkspaceCreate,
    WorkspaceMembershipRead,
    WorkspaceRead,
)
from app.services import workspace_service

router = APIRouter(tags=["workspaces"])


@router.post("/workspaces", response_model=WorkspaceRead, status_code=201)
def create_workspace(
    data: WorkspaceCreate,
    owner_user_id: str = Query(..., description="User ID of the workspace owner"),
    session: Session = Depends(get_session),
):
    workspace = workspace_service.create_workspace(session, data, owner_user_id)
    return workspace


@router.get("/workspaces", response_model=list[WorkspaceRead])
def list_workspaces(session: Session = Depends(get_session)):
    return workspace_service.list_workspaces(session)


@router.get("/workspaces/{workspace_id}", response_model=WorkspaceRead)
def get_workspace(workspace_id: str, session: Session = Depends(get_session)):
    workspace = workspace_service.get_workspace(session, workspace_id)
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")
    return workspace


@router.post(
    "/workspaces/{workspace_id}/members",
    response_model=WorkspaceMembershipRead,
    status_code=201,
)
def add_member(
    workspace_id: str,
    data: AddMemberRequest,
    session: Session = Depends(get_session),
):
    try:
        membership = workspace_service.add_member(
            session, workspace_id, data.user_id, data.role
        )
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))
    return membership
