from datetime import datetime, UTC

from sqlmodel import Session, select

from app.models.enums import InvitationStatus, WorkspaceRole
from app.models.invitation import Invitation
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


def accept_invitation(session: Session, token: str) -> Invitation:
    invitation = session.exec(
        select(Invitation).where(Invitation.token == token)
    ).first()

    if not invitation:
        raise ValueError("Invitation not found")

    if invitation.status != InvitationStatus.pending:
        raise ValueError(f"Invitation is already {invitation.status.value}")

    # Update invitation status
    invitation.status = InvitationStatus.accepted
    invitation.accepted_at = datetime.now(UTC)
    session.add(invitation)
    session.commit()
    session.refresh(invitation)

    # Create workspace membership for the accepted invitee
    # We use a placeholder user_id derived from the invitation since
    # the invitee may not have a User account yet.
    # The caller (or a follow-up step) should link this to a real user.
    # For MVP, we create the membership with the invitation id as a marker
    # that will be replaced when the user registers.
    membership = WorkspaceMembership(
        workspace_id=invitation.workspace_id,
        user_id=invitation.id,  # placeholder until real user links
        role=WorkspaceRole.member,
    )
    session.add(membership)
    session.commit()
    session.refresh(invitation)
    return invitation
