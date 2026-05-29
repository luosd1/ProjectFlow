from datetime import date

from app.agent.modules.common import AgentModuleRequest, project_deadline_or_today
from app.models.enums import AgentEventType
from app.schemas.workspace_state import WorkspaceStateResponse


def build_request(workspace_state: WorkspaceStateResponse) -> AgentModuleRequest:
    start = date.today()
    deadline = project_deadline_or_today(workspace_state)
    end = deadline if deadline >= start else start
    return AgentModuleRequest(
        event_type=AgentEventType.plan,
        user_prompt=(
            "Create a stage plan for this project.\n\n"
            "Using the WorkspaceState:\n"
            "1. Generate 3-5 stages that cover the project from start to deadline.\n"
            "2. Each stage must have: a descriptive name, a concrete goal, start/end dates that fit within the project deadline, a deliverable, and done criteria.\n"
            "3. Order stages logically — earlier stages must produce outputs that later stages depend on.\n"
            "4. Consider member skills and availability when deciding what each stage delivers.\n"
            "5. If the project deadline is tight, keep stages lean and mark stretch goals in done_criteria.\n\n"
            "Ground every stage reason in specific WorkspaceState data: the project deadline, member count, and current task status."
        ),
        fallback_payload={
            "stages": [
                {
                    "name": "MVP Demo",
                    "goal": "Produce the smallest demoable project loop.",
                    "start_date": start.isoformat(),
                    "end_date": end.isoformat(),
                    "deliverable": "A runnable ProjectFlow MVP path.",
                    "done_criteria": ["The team can inspect a concrete next step."],
                    "order_index": 0,
                    "reason": "The fallback keeps the plan scoped to the demo deadline.",
                }
            ],
            "reason": "Template fallback avoids fabricating detailed stages.",
        },
    )
