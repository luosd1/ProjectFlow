from app.agent.modules.common import AgentModuleRequest
from app.models.enums import AgentEventType
from app.schemas.workspace_state import WorkspaceStateResponse


def build_request(workspace_state: WorkspaceStateResponse) -> AgentModuleRequest:
    return AgentModuleRequest(
        event_type=AgentEventType.clarify,
        user_prompt=(
            "Create a direction card for this project.\n\n"
            "Using the WorkspaceState:\n"
            "1. Identify the core PROBLEM the project idea addresses.\n"
            "2. Identify WHO the project serves (from member roles/skills or the idea itself).\n"
            "3. State the VALUE the project delivers.\n"
            "4. List concrete DELIVERABLES the project must produce.\n"
            "5. Define BOUNDARIES — what is explicitly out of scope given the deadline and team capacity.\n"
            "6. List RISKS grounded in the current state: tight deadline, missing skills, unassigned tasks, member constraints.\n"
            "7. Ask only HIGH-VALUE clarification questions — skip anything the WorkspaceState already answers.\n\n"
            "Do not fabricate information not present in WorkspaceState. If the idea is vague, ask a targeted question instead of guessing."
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
