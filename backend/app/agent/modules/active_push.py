from app.agent.modules.common import AgentModuleRequest, first_member_id, first_stage_id, first_task_id
from app.models.enums import AgentEventType
from app.schemas.workspace_state import WorkspaceStateResponse


def build_request(workspace_state: WorkspaceStateResponse) -> AgentModuleRequest:
    # Build fallback that cites real state data
    fallback_member = workspace_state.members[0] if workspace_state.members else None
    fallback_member_name = fallback_member.display_name if fallback_member else "team"
    fallback_stage = None
    fallback_task_title = "next task"
    if workspace_state.project and workspace_state.project.stages:
        fallback_stage = workspace_state.project.stages[0]
    if workspace_state.project and workspace_state.project.tasks:
        for t in workspace_state.project.tasks:
            if t.status != "done":
                fallback_task_title = t.title
                break

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
            "3. Each action card MUST include:\n"
            "   - goal: what this card achieves for the project (e.g. 'Unblock the CI/CD pipeline')\n"
            "   - start_suggestion: concrete first step to take (e.g. 'Resolve the missing config in deploy.yml')\n"
            "   - completion_standard: how to know the action is done (e.g. 'CI pipeline runs green on main')\n"
            "4. Assign each card to a specific member (user_id) when possible.\n"
            "5. Set due_date from the referenced task's due_date when applicable.\n"
            "6. Do not create cards for tasks that are already done or have no clear next action.\n\n"
            "Ground every card reason in specific WorkspaceState data: task status, member availability, deadlines."
        ),
        fallback_payload={
            "action_cards": [
                {
                    "type": "team_next_step",
                    "title": f"Confirm next action: {fallback_task_title}",
                    "content": f"Pick the smallest useful next step for the active stage.",
                    "reason": f"Fallback: {fallback_member_name} should take the next actionable step.",
                    "goal": f"Advance {fallback_task_title} to in_progress",
                    "start_suggestion": f"Start working on {fallback_task_title}",
                    "completion_standard": f"{fallback_task_title} is marked done or in_progress",
                    "user_id": first_member_id(workspace_state),
                    "stage_id": first_stage_id(workspace_state),
                    "task_id": first_task_id(workspace_state),
                }
            ],
            "reason": "Active push fallback keeps the team focused on one action.",
        },
    )
