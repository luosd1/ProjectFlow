import json

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session

from app.core.database import get_session
from app.models.stage import Stage
from app.schemas.stage import StageCreate, StageUpdate, StageRead
from app.services.stage_service import (
    create_stage,
    get_stage,
    list_stages_by_project,
    update_stage,
)

router = APIRouter(tags=["stages"])


def _stage_to_read(stage: Stage) -> StageRead:
    """Convert a Stage model to its read schema, deserializing JSON fields."""
    return StageRead(
        id=stage.id,
        project_id=stage.project_id,
        name=stage.name,
        goal=stage.goal,
        start_date=stage.start_date,
        end_date=stage.end_date,
        deliverable=stage.deliverable,
        done_criteria=json.loads(stage.done_criteria) if stage.done_criteria else [],
        status=stage.status,
        order_index=stage.order_index,
    )


@router.post("/stages", response_model=StageRead, status_code=201)
def api_create_stage(
    data: StageCreate,
    session: Session = Depends(get_session),
):
    stage = create_stage(session, data)
    return _stage_to_read(stage)


@router.get("/stages/{stage_id}", response_model=StageRead)
def api_get_stage(
    stage_id: str,
    session: Session = Depends(get_session),
):
    stage = get_stage(session, stage_id)
    if stage is None:
        raise HTTPException(status_code=404, detail="Stage not found")
    return _stage_to_read(stage)


@router.get("/projects/{project_id}/stages", response_model=list[StageRead])
def api_list_stages_by_project(
    project_id: str,
    session: Session = Depends(get_session),
):
    stages = list_stages_by_project(session, project_id)
    return [_stage_to_read(s) for s in stages]


@router.patch("/stages/{stage_id}", response_model=StageRead)
def api_update_stage(
    stage_id: str,
    data: StageUpdate,
    session: Session = Depends(get_session),
):
    try:
        stage = update_stage(session, stage_id, data)
        return _stage_to_read(stage)
    except ValueError:
        raise HTTPException(status_code=404, detail="Stage not found")
