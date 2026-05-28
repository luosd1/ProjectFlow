from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session

from app.core.database import get_session
from app.schemas.member_profile import (
    MemberProfileCreate,
    MemberProfileRead,
    MemberProfileUpdate,
)
from app.services import member_profile_service

router = APIRouter(tags=["member-profiles"])


@router.post("/member-profiles", response_model=MemberProfileRead, status_code=201)
def create_profile(data: MemberProfileCreate, session: Session = Depends(get_session)):
    profile = member_profile_service.create_profile(session, data)
    return profile


@router.get("/member-profiles/{profile_id}", response_model=MemberProfileRead)
def get_profile(profile_id: str, session: Session = Depends(get_session)):
    profile = member_profile_service.get_profile(session, profile_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Member profile not found")
    return profile


@router.patch("/member-profiles/{profile_id}", response_model=MemberProfileRead)
def update_profile(
    profile_id: str, data: MemberProfileUpdate, session: Session = Depends(get_session)
):
    try:
        profile = member_profile_service.update_profile(session, profile_id, data)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return profile


@router.get("/workspaces/{workspace_id}/profiles", response_model=list[MemberProfileRead])
def list_profiles_by_workspace(workspace_id: str, session: Session = Depends(get_session)):
    return member_profile_service.list_profiles_by_workspace(session, workspace_id)
