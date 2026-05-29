import json

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session

from app.core.database import get_session
from app.models.member_profile import MemberProfile
from app.schemas.member_profile import (
    MemberProfileCreate,
    MemberProfileRead,
    MemberProfileUpdate,
)
from app.services import member_profile_service

router = APIRouter(tags=["member-profiles"])


def _profile_to_read(profile: MemberProfile) -> MemberProfileRead:
    """Convert a MemberProfile model to its read schema, deserializing JSON fields."""
    return MemberProfileRead(
        id=profile.id,
        user_id=profile.user_id,
        workspace_id=profile.workspace_id,
        skills=json.loads(profile.skills) if profile.skills else [],
        available_hours_per_week=profile.available_hours_per_week,
        role_preference=profile.role_preference,
        interests=profile.interests,
        constraints=profile.constraints,
        collaboration_preference=profile.collaboration_preference,
        created_at=profile.created_at,
        updated_at=profile.updated_at,
    )


@router.post("/member-profiles", response_model=MemberProfileRead, status_code=201)
def create_profile(data: MemberProfileCreate, session: Session = Depends(get_session)):
    profile = member_profile_service.create_profile(session, data)
    return _profile_to_read(profile)


@router.get("/member-profiles/{profile_id}", response_model=MemberProfileRead)
def get_profile(profile_id: str, session: Session = Depends(get_session)):
    profile = member_profile_service.get_profile(session, profile_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Member profile not found")
    return _profile_to_read(profile)


@router.patch("/member-profiles/{profile_id}", response_model=MemberProfileRead)
def update_profile(
    profile_id: str, data: MemberProfileUpdate, session: Session = Depends(get_session)
):
    try:
        profile = member_profile_service.update_profile(session, profile_id, data)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return _profile_to_read(profile)


@router.get("/workspaces/{workspace_id}/profiles", response_model=list[MemberProfileRead])
def list_profiles_by_workspace(workspace_id: str, session: Session = Depends(get_session)):
    profiles = member_profile_service.list_profiles_by_workspace(session, workspace_id)
    return [_profile_to_read(p) for p in profiles]
