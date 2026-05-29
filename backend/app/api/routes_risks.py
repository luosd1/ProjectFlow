import json

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session

from app.core.database import get_session
from app.models.risk import Risk
from app.schemas.risk import RiskCreate, RiskRead
from app.services.risk_service import create_risk, list_risks_by_project

router = APIRouter(tags=["risks"])


def _risk_to_read(risk: Risk) -> RiskRead:
    """Convert a Risk model to its read schema, deserializing JSON fields."""
    return RiskRead(
        id=risk.id,
        project_id=risk.project_id,
        stage_id=risk.stage_id,
        task_id=risk.task_id,
        type=risk.type,
        severity=risk.severity,
        title=risk.title,
        description=risk.description,
        evidence=json.loads(risk.evidence) if risk.evidence else [],
        recommendation=risk.recommendation,
        status=risk.status,
        created_by_agent=risk.created_by_agent,
        created_at=risk.created_at,
    )


@router.post("/risks", response_model=RiskRead, status_code=201)
def api_create_risk(
    data: RiskCreate,
    session: Session = Depends(get_session),
):
    try:
        risk = create_risk(session, data)
        return _risk_to_read(risk)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.get("/projects/{project_id}/risks", response_model=list[RiskRead])
def api_list_risks_by_project(
    project_id: str,
    session: Session = Depends(get_session),
):
    risks = list_risks_by_project(session, project_id)
    return [_risk_to_read(r) for r in risks]
