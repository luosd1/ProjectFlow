from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session

from app.core.database import get_session
from app.schemas.action_card import ActionCardCreate, ActionCardRead, ActionCardUpdate
from app.services.action_card_service import (
    create_action_card,
    list_action_cards_by_project,
    update_action_card_status,
)

router = APIRouter(tags=["action-cards"])


@router.post("/action-cards", response_model=ActionCardRead, status_code=201)
def api_create_action_card(
    data: ActionCardCreate,
    session: Session = Depends(get_session),
):
    try:
        return create_action_card(session, data)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.get("/projects/{project_id}/action-cards", response_model=list[ActionCardRead])
def api_list_action_cards_by_project(
    project_id: str,
    session: Session = Depends(get_session),
):
    return list_action_cards_by_project(session, project_id)


@router.patch("/action-cards/{card_id}", response_model=ActionCardRead)
def api_update_action_card(
    card_id: str,
    data: ActionCardUpdate,
    session: Session = Depends(get_session),
):
    try:
        return update_action_card_status(session, card_id, data.status)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
