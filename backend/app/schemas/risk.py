from datetime import datetime

from pydantic import BaseModel, Field

from app.models.enums import RiskSeverity, RiskStatus, RiskType
from app.schemas.common import NonEmptyStr


class RiskCreate(BaseModel):
    project_id: NonEmptyStr
    stage_id: NonEmptyStr | None = None
    task_id: NonEmptyStr | None = None
    type: RiskType
    severity: RiskSeverity
    title: NonEmptyStr
    description: NonEmptyStr
    evidence: list[str | dict] = Field(min_length=1)
    recommendation: NonEmptyStr
    created_by_agent: bool = False


class RiskRead(BaseModel):
    id: str
    project_id: str
    stage_id: str | None
    task_id: str | None
    type: RiskType
    severity: RiskSeverity
    title: str
    description: str
    evidence: list[str | dict]
    recommendation: str
    status: RiskStatus
    created_by_agent: bool
    created_at: datetime


class RiskUpdate(BaseModel):
    status: RiskStatus
