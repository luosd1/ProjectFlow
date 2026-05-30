from app.agent.modules.common import AgentModuleRequest, first_member_id, first_task_id
from app.models.enums import AgentEventType
from app.schemas.workspace_state import WorkspaceStateResponse


def build_request(workspace_state: WorkspaceStateResponse) -> AgentModuleRequest:
    member_id = first_member_id(workspace_state)
    task_id = first_task_id(workspace_state)

    fallback_member = workspace_state.members[0] if workspace_state.members else None
    fallback_skill = fallback_member.skills[0] if fallback_member and fallback_member.skills else "general"
    fallback_hours = fallback_member.available_hours_per_week if fallback_member else 0
    fallback_pref = fallback_member.role_preference if fallback_member else "unknown"
    fallback_constraint = fallback_member.constraints if fallback_member else ""

    if member_id is None or task_id is None:
        return AgentModuleRequest(
            event_type=AgentEventType.assign,
            user_prompt=(
                "Recommend owners for unassigned tasks only. "
                "Match task title/description to member skills, hours, preference, and constraints. "
                "Fill skill_match, availability_match, preference_match, constraint_respected, and risk_note. "
                "Use only existing member IDs and task IDs."
            ),
            fallback_payload={
                "assignments": [],
                "requires_confirmation": False,
                "reason": "No members or tasks available for assignment.",
            },
        )

    return AgentModuleRequest(
        event_type=AgentEventType.assign,
        user_prompt=(
            "Recommend owners for unassigned tasks only. "
            "Match task title/description to member skills, hours, preference, and constraints. "
            "Fill skill_match, availability_match, preference_match, constraint_respected, and risk_note. "
            "Use only existing member IDs and task IDs."
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
