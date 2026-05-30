import json
from datetime import datetime, UTC

from sqlmodel import Session, select

from app.models.member_profile import MemberProfile
from app.schemas.member_profile import MemberProfileCreate, MemberProfileUpdate


def create_profile(session: Session, data: MemberProfileCreate) -> MemberProfile:
    profile = MemberProfile(
        user_id=data.user_id,
        workspace_id=data.workspace_id,
        skills=json.dumps(data.skills, ensure_ascii=False),
        available_hours_per_week=data.available_hours_per_week,
        role_preference=data.role_preference,
        interests=data.interests,
        constraints=data.constraints,
        collaboration_preference=data.collaboration_preference,
    )
    session.add(profile)
    session.commit()
    session.refresh(profile)
    return profile


def get_profile(session: Session, profile_id: str) -> MemberProfile | None:
    return session.get(MemberProfile, profile_id)


def update_profile(session: Session, profile_id: str, data: MemberProfileUpdate) -> MemberProfile:
    profile = session.get(MemberProfile, profile_id)
    if not profile:
        raise ValueError(f"MemberProfile {profile_id} not found")

    update_data = data.model_dump(exclude_unset=True)
    if "skills" in update_data and update_data["skills"] is not None:
        update_data["skills"] = json.dumps(update_data["skills"], ensure_ascii=False)
    for field, value in update_data.items():
        if field == "skills" and not isinstance(value, str):
            value = json.dumps(value)
        setattr(profile, field, value)

    profile.updated_at = datetime.now(UTC)
    session.add(profile)
    session.commit()
    session.refresh(profile)
    return profile


def list_profiles_by_workspace(session: Session, workspace_id: str) -> list[MemberProfile]:
    return list(
        session.exec(
            select(MemberProfile).where(MemberProfile.workspace_id == workspace_id)
        ).all()
    )
