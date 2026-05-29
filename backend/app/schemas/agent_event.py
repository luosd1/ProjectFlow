from datetime import datetime
from typing import Any

from pydantic import BaseModel

from app.models.enums import AgentEventStatus, AgentEventType


class AgentEventRead(BaseModel):
    id: str
    project_id: str
    workspace_id: str
    event_type: AgentEventType
    status: AgentEventStatus
    input_snapshot: dict[str, Any] | list
    output_snapshot: dict[str, Any] | list
    reasoning_summary: str
    user_confirmed: bool
    created_at: datetime
