from app.agent.modules.common import AgentModuleRequest, first_member_id, first_task_id
from app.models.enums import AgentEventType
from app.schemas.workspace_state import WorkspaceStateResponse


def build_request(workspace_state: WorkspaceStateResponse) -> AgentModuleRequest:
    member_id = first_member_id(workspace_state)
    task_id = first_task_id(workspace_state)
    return AgentModuleRequest(
        event_type=AgentEventType.assign,
        user_prompt=(
            "Recommend task-to-owner assignments.\n\n"
            "Using the WorkspaceState:\n"
            "1. For each unassigned task, recommend the member whose skills best match the task, considering:\n"
            "   - Member skills vs. task domain (from title/description)\n"
            "   - Member available_hours_per_week vs. task estimated_hours\n"
            "   - Member role_preference and interests\n"
            "   - Member constraints (respect them — do not assign if constraints conflict)\n"
            "2. Provide a backup_owner_user_id when possible.\n"
            "3. Cite the specific skill match and availability in the reason.\n"
            "4. Flag workload imbalance in risk_note — if one member is assigned many tasks while others are free.\n\n"
            "Do NOT assign a task to a member whose user_id is not in WorkspaceState.members."
        ),
        fallback_payload={
            "assignments": [
                {
                    "task_id": task_id,
                    "recommended_owner_user_id": member_id,
                    "backup_owner_user_id": None,
                    "reason": "This is the first available member and must be confirmed.",
                    "risk_note": "Fallback assignment is conservative and needs human review.",
                }
            ],
            "requires_confirmation": True,
            "reason": "Assignments must remain proposals until the team confirms them.",
        },
    )
