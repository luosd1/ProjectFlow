from app.agent.modules.common import AgentModuleRequest
from app.models.enums import AgentEventType
from app.schemas.workspace_state import WorkspaceStateResponse


def build_request(workspace_state: WorkspaceStateResponse) -> AgentModuleRequest:
    return AgentModuleRequest(
        event_type=AgentEventType.risk,
        user_prompt=(
            "Analyze risks across the project.\n\n"
            "Using the WorkspaceState, check for these risk types:\n"
            "1. deadline: Tasks whose due_date is near or past with status not done. Cite the task_id and days remaining.\n"
            "2. dependency: Tasks blocked by unfinished dependencies. Cite both task_ids.\n"
            "3. workload: Members with too many in_progress tasks relative to available_hours_per_week. Cite the member and task count.\n"
            "4. scope: Tasks that seem to exceed the stage goal or project idea. Cite the task_id and why.\n"
            "5. review: Stages with all tasks done but no review step. Cite the stage_id.\n"
            "6. assignment: Tasks with no owner that are past their due_date. Cite the task_id.\n"
            "7. checkin: Members who have not updated task status recently. Cite the member and their task.\n\n"
            "Every risk MUST have evidence — a list of dicts citing specific WorkspaceState data.\n"
            "Each evidence dict must include at least one of these keys:\n"
            "  - task_id: reference to a specific task\n"
            "  - user_id: reference to a specific member\n"
            "  - stage_id: reference to a specific stage\n"
            "  - status: the current status value\n"
            "  - due_date: the relevant deadline\n"
            "  - available_hours_per_week: member availability figure\n"
            "  - detail: one-sentence explanation of what this evidence shows\n\n"
            "Do not raise risks without evidence. Do not fabricate task_id, user_id, or stage_id values."
        ),
        fallback_payload={
            "risks": [],
            "reason": "Fallback reports no new risk without concrete evidence.",
        },
    )
