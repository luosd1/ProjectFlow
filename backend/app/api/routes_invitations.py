from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session

from app.core.database import get_session
from app.schemas.invitation import InvitationAccept, InvitationCreate, InvitationRead
from app.services import invitation_service

router = APIRouter(tags=["invitations"])


@router.post("/invitations", response_model=InvitationRead, status_code=201)
def create_invitation(data: InvitationCreate, session: Session = Depends(get_session)):
    invitation = invitation_service.create_invitation(session, data)
    return invitation


@router.post("/invitations/accept", response_model=InvitationRead)
def accept_invitation(data: InvitationAccept, session: Session = Depends(get_session)):
    try:
        invitation = invitation_service.accept_invitation(session, data.token)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return invitation
