from app.agent.modules.common import AgentModuleRequest
from app.models.enums import AgentEventType
from app.schemas.workspace_state import WorkspaceStateResponse


def build_request(workspace_state: WorkspaceStateResponse) -> AgentModuleRequest:
    return AgentModuleRequest(
        event_type=AgentEventType.clarify,
        user_prompt=(
            "Create a concise direction card from WorkspaceState. "
            "Use project idea, deadline, deliverables, member skills/hours, and constraints. "
            "Return only high-value risks/questions that affect the next plan."
        ),
        fallback_payload={
            "problem": "The project direction needs explicit confirmation.",
            "users": "The team members listed in WorkspaceState.",
            "value": "A clear direction card that enables staged planning.",
            "deliverables": ["A confirmed direction card with scope boundaries."],
            "boundaries": ["Use only the supplied WorkspaceState."],
            "risks": ["Proceeding without confirmed direction may waste effort."],
            "suggested_questions": ["What is the next decision the team must confirm?"],
            "reason": "A safe fallback should ask for clarification instead of inventing state.",
        },
    )
