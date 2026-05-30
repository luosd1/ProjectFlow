from app.agent.modules.common import AgentModuleRequest, first_member_id, first_task_id
from app.models.enums import AgentEventType
from app.schemas.workspace_state import WorkspaceStateResponse


def build_request(workspace_state: WorkspaceStateResponse) -> AgentModuleRequest:
    member_id = first_member_id(workspace_state)
    task_id = first_task_id(workspace_state)

    if member_id is None or task_id is None:
        return AgentModuleRequest(
            event_type=AgentEventType.checkin,
            user_prompt=(
                "Analyze task progress, blockers, deadline risk, and workload from WorkspaceState. "
                "Update status only with clear evidence. Return status quo if no real signal exists."
            ),
            fallback_payload={
                "summary": "No members or tasks available for check-in analysis.",
                "task_updates": [],
                "risks": [],
                "reason": "No members or tasks available for check-in analysis.",
            },
        )

    return AgentModuleRequest(
        event_type=AgentEventType.checkin,
        user_prompt=(
            "Analyze task progress, blockers, deadline risk, and workload from WorkspaceState. "
            "Update status only with clear evidence. Return status quo if no real signal exists."
        ),
        fallback_payload={
            "summary": "No strong check-in signal is available.",
            "task_updates": [
                {
                    "task_id": task_id,
                    "user_id": member_id,
                    "status": "not_started",
                    "progress_note": "Fallback keeps current task state unchanged.",
                    "blocker": None,
                }
            ],
            "risks": [],
            "reason": "Fallback should avoid inventing progress.",
        },
    )
