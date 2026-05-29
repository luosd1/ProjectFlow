from app.agent.modules.common import AgentModuleRequest, first_stage_id, project_deadline_or_today
from app.models.enums import AgentEventType
from app.schemas.workspace_state import WorkspaceStateResponse


def build_request(workspace_state: WorkspaceStateResponse) -> AgentModuleRequest:
    stage_id = first_stage_id(workspace_state)
    return AgentModuleRequest(
        event_type=AgentEventType.breakdown,
        user_prompt=(
            "Break the current stage into prioritized implementation tasks.\n\n"
            "Using the WorkspaceState:\n"
            "1. Create tasks for the current stage (referenced by stage_id). Each task must have: title, description, priority (P0/P1/P2), due_date, estimated_hours, dependency_ids, acceptance_criteria, can_cut flag, and reason.\n"
            "2. P0 tasks are critical path — the stage cannot complete without them. P1 are important. P2 are nice-to-have.\n"
            "3. Set can_cut=true only for P2 tasks that can be dropped if time runs out.\n"
            "4. Set dependency_ids only for tasks that genuinely block each other — do not create artificial chains.\n"
            "5. Distribute due_dates across the stage timeframe, front-loading P0 tasks.\n"
            "6. Consider member skills when estimating hours — if no member has the required skill, note it in the reason.\n\n"
            "Ground every task reason in specific WorkspaceState data: stage goal, member skills, project deadline."
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
