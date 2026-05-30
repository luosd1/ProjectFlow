from datetime import datetime, UTC

from sqlmodel import Session, select

from app.models.enums import InvitationStatus, WorkspaceRole
from app.models.invitation import Invitation
from app.models.user import User
from app.models.workspace import WorkspaceMembership
from app.schemas.invitation import InvitationCreate


def create_invitation(session: Session, data: InvitationCreate) -> Invitation:
    invitation = Invitation(
        workspace_id=data.workspace_id,
        invited_name=data.invited_name,
        invited_email=data.invited_email,
    )
    session.add(invitation)
    session.commit()
    session.refresh(invitation)
    return invitation


def accept_invitation(session: Session, token: str, user_id: str | None = None) -> Invitation:
    invitation = session.exec(
        select(Invitation).where(Invitation.token == token)
    ).first()

    if not invitation:
        raise ValueError("Invitation not found")

    if invitation.status != InvitationStatus.pending.value:
        raise ValueError(f"Invitation is already {invitation.status}")

    invitation.status = InvitationStatus.accepted.value
    invitation.accepted_at = datetime.now(UTC)
    session.add(invitation)
    session.flush()

    resolved_user_id = user_id
    if resolved_user_id is None:
        user = User(
            display_name=invitation.invited_name or "Invited Member",
            email=invitation.invited_email,
        )
        session.add(user)
        session.flush()
        resolved_user_id = user.id

    membership = WorkspaceMembership(
        workspace_id=invitation.workspace_id,
        user_id=resolved_user_id,
        role=WorkspaceRole.member,
    )
    session.add(membership)
    session.commit()
    session.refresh(invitation)
    return invitation
