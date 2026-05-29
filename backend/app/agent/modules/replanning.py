from app.agent.modules.common import AgentModuleRequest
from app.models.enums import AgentEventType
from app.schemas.workspace_state import WorkspaceStateResponse


def build_request(workspace_state: WorkspaceStateResponse) -> AgentModuleRequest:
    return AgentModuleRequest(
        event_type=AgentEventType.replan,
        user_prompt=(
            "Propose a replan based on current project state.\n\n"
            "Using the WorkspaceState:\n"
            "1. Identify what has changed since the original plan: tasks that are blocked, overdue, or unassigned; members whose availability has dropped.\n"
            "2. Propose specific adjustments:\n"
            "   - stage_adjustments: move stage dates only if tasks in that stage are consistently late. Cite the task evidence.\n"
            "   - task_changes: reassign tasks only to members who exist in WorkspaceState and have matching skills. Cite the skill match.\n"
            "   - action_cards: create follow-up cards for any change that needs team confirmation.\n"
            "3. Describe before/after state clearly so the team can compare.\n"
            "4. If no replan is needed (all tasks on track, no blockers), return minimal changes with a reason explaining why the current plan is sound.\n\n"
            "Do not change the plan without evidence from WorkspaceState. Every adjustment must cite specific task_id, member_id, or deadline data."
        ),
        fallback_payload={
            "before": {"summary": "Keep the current plan unchanged."},
            "after": {"summary": "No automatic replan is applied."},
            "impact": "No schedule, ownership, or scope change is applied without confirmation.",
            "stage_adjustments": [],
            "task_changes": [],
            "action_cards": [],
            "requires_confirmation": True,
            "reason": "Fallback avoids changing the plan without stronger evidence.",
        },
    )
