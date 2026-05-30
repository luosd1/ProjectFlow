from app.agent.modules.common import AgentModuleRequest
from app.models.enums import AgentEventType
from app.schemas.workspace_state import WorkspaceStateResponse


def build_request(workspace_state: WorkspaceStateResponse) -> AgentModuleRequest:
    return AgentModuleRequest(
        event_type=AgentEventType.risk,
        user_prompt=(
            "Analyze the current stage for deadline, dependency, workload, scope, review, assignment, and check-in risks. "
            "Return only the single highest risk with concrete evidence from WorkspaceState. "
            "Evidence objects should cite task_id, user_id, stage_id, status, due_date, hours, or detail. "
            "Do not fabricate IDs."
        ),
        fallback_payload={
            "risks": [],
            "reason": "Fallback reports no new risk without concrete evidence.",
        },
    )
