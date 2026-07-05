from fastapi import APIRouter, Body, Depends, HTTPException, Query
from sqlmodel import Session

from app.core.database import get_session
from app.core.db_utils import require_user
from app.schemas.agent_proposal import (
    AgentProposalConfirm,
    AgentProposalRead,
    AgentProposalReject,
)
from app.services.agent_proposal_service import (
    confirm_proposal,
    get_proposal,
    list_proposals_by_project,
    reject_proposal,
    to_proposal_read,
)

router = APIRouter(tags=["agent-proposals"])


def _proposal_to_read(proposal) -> AgentProposalRead:
    return to_proposal_read(proposal)


@router.get("/agent-proposals", response_model=list[AgentProposalRead])
def api_list_agent_proposals(
    project_id: str = Query(...),
    proposal_type: str | None = Query(None),
    status: str | None = Query(None, description="按状态过滤（pending/confirmed/rejected）"),
    session: Session = Depends(get_session),
):
    proposals = list_proposals_by_project(session, project_id, proposal_type, status)
    return [_proposal_to_read(p) for p in proposals]


@router.get("/agent-proposals/{proposal_id}", response_model=AgentProposalRead)
def api_get_agent_proposal(
    proposal_id: str,
    session: Session = Depends(get_session),
):
    proposal = get_proposal(session, proposal_id)
    if proposal is None:
        raise HTTPException(status_code=404, detail="Agent proposal not found")
    return _proposal_to_read(proposal)


@router.post("/agent-proposals/{proposal_id}/confirm", response_model=AgentProposalRead)
def api_confirm_agent_proposal(
    proposal_id: str,
    data: AgentProposalConfirm,
    session: Session = Depends(get_session),
):
    require_user(session, data.confirmed_by)
    try:
        proposal = confirm_proposal(session, proposal_id, data.confirmed_by)
        return _proposal_to_read(proposal)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.post("/agent-proposals/{proposal_id}/reject", response_model=AgentProposalRead)
def api_reject_agent_proposal(
    proposal_id: str,
    data: AgentProposalReject | None = Body(default=None),
    session: Session = Depends(get_session),
):
    try:
        proposal = reject_proposal(session, proposal_id, reason=data.reason if data else None)
        return _proposal_to_read(proposal)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
