from app.agent.modules.common import AgentModuleRequest, first_member_id, first_task_id
from app.models.enums import AgentEventType
from app.schemas.workspace_state import WorkspaceStateResponse


def build_request(workspace_state: WorkspaceStateResponse) -> AgentModuleRequest:
    return AgentModuleRequest(
        event_type=AgentEventType.checkin,
        user_prompt=(
            "Analyze check-in signals for task progress and blockers.\n\n"
            "Using the WorkspaceState:\n"
            "1. For each task with a recent status change, assess whether progress is on track relative to its due_date.\n"
            "2. Identify blockers — tasks that are blocked or at risk of missing their deadline.\n"
            "3. Update task status only if there is clear evidence in WorkspaceState (e.g., a task marked in_progress that has no owner).\n"
            "4. Flag workload concerns — a member with many in_progress tasks while others are idle.\n"
            "5. Generate risks only when you can cite specific evidence: a task ID, a deadline, a member's available_hours.\n\n"
            "Do not invent progress. If WorkspaceState shows no change, report status quo."
        ),
        fallback_payload={
            "summary": "No strong check-in signal is available.",
            "task_updates": [
                {
                    "task_id": first_task_id(workspace_state),
                    "user_id": first_member_id(workspace_state),
                    "status": "not_started",
                    "progress_note": "Fallback keeps current task state unchanged.",
                    "blocker": None,
                }
            ],
            "risks": [],
            "reason": "Fallback should avoid inventing progress.",
        },
    )
