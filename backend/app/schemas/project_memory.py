from datetime import datetime

from pydantic import BaseModel


class ProjectMemoryRead(BaseModel):
    id: str
    project_id: str
    workspace_id: str
    memory_type: str
    scope: str
    content: str
    rationale: str
    source_type: str
    source_id: str
    status: str
    visibility: str
    valid_until: datetime | None
    related_stage_id: str | None
    related_task_id: str | None
    related_risk_id: str | None
    created_at: datetime
    updated_at: datetime
