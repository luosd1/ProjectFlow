from app.agent.modules.common import AgentModuleRequest, first_member_id, first_task_id
from app.models.enums import AgentEventType
from app.schemas.workspace_state import WorkspaceStateResponse


def build_request(workspace_state: WorkspaceStateResponse) -> AgentModuleRequest:
    member_id = first_member_id(workspace_state)
    task_id = first_task_id(workspace_state)

    if member_id is None or task_id is None:
        return AgentModuleRequest(
            event_type=AgentEventType.negotiate,
            user_prompt="Propose assignment negotiation options after a member rejects an assignment.",
            fallback_payload={
                "from_user_id": "",
                "desired_task_id": "",
                "current_owner_user_id": "",
                "message": "No members or tasks available for negotiation.",
                "options": [],
                "requires_confirmation": False,
                "reason": "No members or tasks available for negotiation.",
            },
        )

    return AgentModuleRequest(
        event_type=AgentEventType.negotiate,
        user_prompt="Propose assignment negotiation options after a member rejects an assignment.",
        fallback_payload={
            "from_user_id": member_id,
            "desired_task_id": task_id,
            "current_owner_user_id": member_id,
            "message": "Confirm whether the team wants to keep or swap this assignment.",
            "options": ["Keep the current proposal", "Choose a different owner manually"],
            "requires_confirmation": True,
            "reason": "Negotiation fallback must wait for human agreement.",
        },
    )
