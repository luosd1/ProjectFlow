from datetime import UTC, datetime

from sqlmodel import Session, select

from app.core.db_utils import require_row
from app.models import (
    AssignmentNegotiation,
    AssignmentProposal,
    AssignmentResponse,
    Project,
    Stage,
    Task,
    User,
)
from app.models.enums import AssignmentProposalStatus, AssignmentResponseType
from app.schemas.assignment import (
    AssignmentNegotiationCreate,
    AssignmentProposalCreate,
    AssignmentResponseCreate,
)


def create_assignment_proposal(session: Session, data: AssignmentProposalCreate, *, auto_commit: bool = True) -> AssignmentProposal:
    require_row(session, Project, data.project_id, "Project")
    require_row(session, Stage, data.stage_id, "Stage")
    require_row(session, Task, data.task_id, "Task")
    require_row(session, User, data.recommended_owner_user_id, "Recommended owner")
    if data.backup_owner_user_id:
        require_row(session, User, data.backup_owner_user_id, "Backup owner")

    proposal = AssignmentProposal(
        project_id=data.project_id,
        stage_id=data.stage_id,
        task_id=data.task_id,
        recommended_owner_user_id=data.recommended_owner_user_id,
        backup_owner_user_id=data.backup_owner_user_id,
        reason=data.reason,
        skill_match=data.skill_match,
        availability_match=data.availability_match,
        preference_match=data.preference_match,
        constraint_respected=data.constraint_respected,
        risk_note=data.risk_note,
        created_by_agent=data.created_by_agent,
    )
    session.add(proposal)
    if auto_commit:
        session.commit()
        session.refresh(proposal)
    else:
        session.flush()
    return proposal


def get_assignment_proposal(session: Session, proposal_id: str) -> AssignmentProposal | None:
    return session.get(AssignmentProposal, proposal_id)


def list_assignment_proposals_by_project(session: Session, project_id: str) -> list[AssignmentProposal]:
    return list(
        session.exec(
            select(AssignmentProposal).where(AssignmentProposal.project_id == project_id)
        ).all()
    )


def list_assignment_responses_by_project(session: Session, project_id: str) -> list[AssignmentResponse]:
    proposal_ids = [
        proposal.id for proposal in list_assignment_proposals_by_project(session, project_id)
    ]
    if not proposal_ids:
        return []
    return list(
        session.exec(
            select(AssignmentResponse).where(AssignmentResponse.proposal_id.in_(proposal_ids))
        ).all()
    )


def list_assignment_negotiations_by_project(
    session: Session,
    project_id: str,
) -> list[AssignmentNegotiation]:
    return list(
        session.exec(
            select(AssignmentNegotiation).where(AssignmentNegotiation.project_id == project_id)
        ).all()
    )


def create_assignment_response(
    session: Session,
    proposal_id: str,
    data: AssignmentResponseCreate,
) -> AssignmentResponse:
    proposal = require_row(session, AssignmentProposal, proposal_id, "Assignment proposal")
    require_row(session, User, data.user_id, "User")
    if data.user_id != proposal.recommended_owner_user_id:
        raise ValueError("Only the recommended owner can respond to this proposal")
    if data.preferred_task_id:
        require_row(session, Task, data.preferred_task_id, "Preferred task")

    response = AssignmentResponse(
        proposal_id=proposal_id,
        user_id=data.user_id,
        response=data.response,
        preferred_task_id=data.preferred_task_id,
        reason=data.reason,
    )
    if data.response == AssignmentResponseType.accept:
        proposal.status = AssignmentProposalStatus.owner_confirmed
    else:
        proposal.status = AssignmentProposalStatus.owner_rejected

    session.add(response)
    session.add(proposal)
    session.commit()
    session.refresh(response)
    return response


def finalize_assignment_proposal(session: Session, proposal_id: str) -> AssignmentProposal:
    proposal = require_row(session, AssignmentProposal, proposal_id, "Assignment proposal")
    if proposal.status != AssignmentProposalStatus.owner_confirmed:
        raise ValueError("Assignment proposal must be owner_confirmed before finalization")

    task = require_row(session, Task, proposal.task_id, "Task")
    task.owner_user_id = proposal.recommended_owner_user_id
    task.backup_owner_user_id = proposal.backup_owner_user_id
    task.assignment_reason = proposal.reason
    task.updated_at = datetime.now(UTC)
    proposal.status = AssignmentProposalStatus.finalized

    session.add(task)
    session.add(proposal)
    session.commit()
    session.refresh(proposal)
    return proposal


def finalize_assignment_proposals_by_stage(session: Session, stage_id: str) -> list[AssignmentProposal]:
    require_row(session, Stage, stage_id, "Stage")
    proposals = list(
        session.exec(
            select(AssignmentProposal).where(
                AssignmentProposal.stage_id == stage_id,
                AssignmentProposal.status == AssignmentProposalStatus.owner_confirmed,
            )
        ).all()
    )
    for proposal in proposals:
        task = require_row(session, Task, proposal.task_id, "Task")
        task.owner_user_id = proposal.recommended_owner_user_id
        task.backup_owner_user_id = proposal.backup_owner_user_id
        task.assignment_reason = proposal.reason
        task.updated_at = datetime.now(UTC)
        proposal.status = AssignmentProposalStatus.finalized
        session.add(task)
        session.add(proposal)
    session.commit()
    for proposal in proposals:
        session.refresh(proposal)
    return proposals


def create_assignment_negotiation(
    session: Session,
    data: AssignmentNegotiationCreate,
) -> AssignmentNegotiation:
    require_row(session, Project, data.project_id, "Project")
    require_row(session, Stage, data.stage_id, "Stage")
    require_row(session, User, data.from_user_id, "Requester")
    require_row(session, Task, data.desired_task_id, "Desired task")
    if data.current_owner_user_id:
        require_row(session, User, data.current_owner_user_id, "Current owner")

    negotiation = AssignmentNegotiation(
        project_id=data.project_id,
        stage_id=data.stage_id,
        from_user_id=data.from_user_id,
        desired_task_id=data.desired_task_id,
        current_owner_user_id=data.current_owner_user_id,
        agent_message=data.agent_message,
    )
    session.add(negotiation)
    session.commit()
    session.refresh(negotiation)
    return negotiation
