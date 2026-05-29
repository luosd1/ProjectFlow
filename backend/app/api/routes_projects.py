import json

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session

from app.core.database import get_session
from app.schemas.project import ProjectCreate, ProjectUpdate, ProjectRead
from app.services.project_service import (
    create_project,
    get_project,
    list_projects_by_workspace,
    update_project,
)

router = APIRouter(tags=["projects"])


def _project_to_read(project) -> ProjectRead:
    """Convert a Project model to ProjectRead, parsing JSON string fields."""
    direction_card = project.direction_card
    if isinstance(direction_card, str):
        direction_card = json.loads(direction_card)
    return ProjectRead(
        id=project.id,
        workspace_id=project.workspace_id,
        name=project.name,
        idea=project.idea,
        deadline=project.deadline,
        deliverables=project.deliverables,
        status=project.status,
        current_stage_id=project.current_stage_id,
        direction_card=direction_card,
        created_by=project.created_by,
        created_at=project.created_at,
        updated_at=project.updated_at,
    )


@router.post("/projects", response_model=ProjectRead, status_code=201)
def api_create_project(
    data: ProjectCreate,
    session: Session = Depends(get_session),
):
    project = create_project(session, data)
    return _project_to_read(project)


@router.get("/projects/{project_id}", response_model=ProjectRead)
def api_get_project(
    project_id: str,
    session: Session = Depends(get_session),
):
    project = get_project(session, project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")
    return _project_to_read(project)


@router.get("/workspaces/{workspace_id}/projects", response_model=list[ProjectRead])
def api_list_projects_by_workspace(
    workspace_id: str,
    session: Session = Depends(get_session),
):
    projects = list_projects_by_workspace(session, workspace_id)
    return [_project_to_read(p) for p in projects]


@router.patch("/projects/{project_id}", response_model=ProjectRead)
def api_update_project(
    project_id: str,
    data: ProjectUpdate,
    session: Session = Depends(get_session),
):
    try:
        project = update_project(session, project_id, data)
        return _project_to_read(project)
    except ValueError:
        raise HTTPException(status_code=404, detail="Project not found")
