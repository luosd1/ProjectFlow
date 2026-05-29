from app.agent.modules.common import AgentModuleRequest, first_member_id, first_stage_id, first_task_id
from app.models.enums import AgentEventType
from app.schemas.workspace_state import WorkspaceStateResponse


def build_request(workspace_state: WorkspaceStateResponse) -> AgentModuleRequest:
    return AgentModuleRequest(
        event_type=AgentEventType.push,
        user_prompt=(
            "Create action cards that actively push the team forward.\n\n"
            "Using the WorkspaceState:\n"
            "1. Identify the most impactful next step for the team — a blocked task to unblock, an unassigned task to claim, or an overdue task to escalate.\n"
            "2. Create action cards grounded in specific state:\n"
            "   - For blocked tasks: reference the specific task_id and what is blocking it.\n"
            "   - For unassigned tasks: reference the task_id and suggest the best-fit member by skill.\n"
            "   - For overdue tasks: reference the task_id, its due_date, and current status.\n"
            "3. Assign each card to a specific member (user_id) when possible.\n"
            "4. Do not create cards for tasks that are already done or have no clear next action.\n\n"
            "Ground every card reason in specific WorkspaceState data: task status, member availability, deadlines."
        ),
        fallback_payload={
            "action_cards": [
                {
                    "type": "team_next_step",
                    "title": "Confirm next action",
                    "content": "Pick the smallest useful next step for the active stage.",
                    "reason": "Fallback should prompt action without inventing work.",
                    "user_id": first_member_id(workspace_state),
                    "stage_id": first_stage_id(workspace_state),
                    "task_id": first_task_id(workspace_state),
                }
            ],
            "reason": "Active push fallback keeps the team focused on one action.",
        },
    )
