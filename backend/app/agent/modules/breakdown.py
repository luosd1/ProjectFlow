from app.agent.modules.common import AgentModuleRequest, first_stage_id, project_deadline_or_today
from app.models.enums import AgentEventType
from app.schemas.workspace_state import WorkspaceStateResponse


def build_request(workspace_state: WorkspaceStateResponse) -> AgentModuleRequest:
    stage_id = first_stage_id(workspace_state)
    return AgentModuleRequest(
        event_type=AgentEventType.breakdown,
        user_prompt=(
            "Break the current or first stage into exactly 3 prioritized tasks. "
            "Use existing stage_id, P0/P1/P2 priorities, realistic hours, real dependencies only, and due dates before the stage/project deadline. "
            "Each reason must cite stage goal, member skills, or deadline."
        ),
        fallback_payload={
            "tasks": [
                {
                    "stage_id": stage_id,
                    "title": "Confirm next implementation step",
                    "description": "Identify the smallest task that moves the MVP forward.",
                    "priority": "P0",
                    "due_date": project_deadline_or_today(workspace_state).isoformat(),
                    "estimated_hours": 1,
                    "dependency_ids": [],
                    "acceptance_criteria": ["The next step is explicit and actionable."],
                    "can_cut": False,
                    "reason": "Fallback avoids fabricating a detailed backlog.",
                }
            ],
            "reason": "Template fallback produces one conservative task proposal.",
        },
    )
