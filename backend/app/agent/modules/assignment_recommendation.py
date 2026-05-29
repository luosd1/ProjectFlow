from app.agent.modules.common import AgentModuleRequest, first_member_id, first_task_id
from app.models.enums import AgentEventType
from app.schemas.workspace_state import WorkspaceStateResponse


def build_request(workspace_state: WorkspaceStateResponse) -> AgentModuleRequest:
    member_id = first_member_id(workspace_state)
    task_id = first_task_id(workspace_state)

    # Build fallback that cites real member data
    fallback_member = workspace_state.members[0] if workspace_state.members else None
    fallback_skill = fallback_member.skills[0] if fallback_member and fallback_member.skills else "general"
    fallback_hours = fallback_member.available_hours_per_week if fallback_member else 0
    fallback_pref = fallback_member.role_preference if fallback_member else "unknown"
    fallback_constraint = fallback_member.constraints if fallback_member else ""

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
            "3. In each assignment, fill these citation fields:\n"
            "   - skill_match: which specific member skill matches the task domain (e.g. 'backend matches API task')\n"
            "   - availability_match: how member available_hours_per_week compares to task estimated_hours\n"
            "   - preference_match: how member role_preference or interests align with the task\n"
            "   - constraint_respected: which member constraints were checked and not violated (or 'none' if no constraints)\n"
            "4. The reason field must summarize the above citations in one sentence.\n"
            "5. Flag workload imbalance in risk_note — if one member is assigned many tasks while others are free.\n\n"
            "Do NOT assign a task to a member whose user_id is not in WorkspaceState.members."
        ),
        fallback_payload={
            "assignments": [
                {
                    "task_id": task_id,
                    "recommended_owner_user_id": member_id,
                    "backup_owner_user_id": None,
                    "reason": f"Fallback: {fallback_member.display_name if fallback_member else 'member'} is the first available member. Must be confirmed.",
                    "skill_match": f"Member has {fallback_skill} skill",
                    "availability_match": f"Member has {fallback_hours}h/week available",
                    "preference_match": f"Member preference: {fallback_pref}",
                    "constraint_respected": fallback_constraint if fallback_constraint else "No constraints listed",
                    "risk_note": "Fallback assignment is conservative and needs human review.",
                }
            ],
            "requires_confirmation": True,
            "reason": "Assignments must remain proposals until the team confirms them.",
        },
    )
