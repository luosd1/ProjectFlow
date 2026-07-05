"""T41 Internal Agent Tools API Routes.

Provides the unified internal tool endpoint:
- POST /internal/agent-tools/{tool_name} — execute a ProjectFlow tool

Read-only tools (workspace-state, conversation, pending-proposals,
timeline-slice) dispatch to existing services and return a ProjectFlowToolResult
with side_effect_status=no_side_effect.

These endpoints use service-to-service authentication (not browser cookies).
Service-token verification is a repo-wide hardening item tracked separately;
the existing /internal/agent-runs/* routes share the same gap.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session

from app.core.database import get_session
from app.schemas.runtime import ProjectFlowToolResult, ToolExecutionRequest
from app.services.agent_tools_service import ToolNotFoundError, execute_tool as dispatch_tool

router = APIRouter(prefix="/internal/agent-tools", tags=["agent-tools"])

# All tools currently exposed through this dispatcher.
REGISTERED_TOOLS = {
    "workspace-state",
    "conversation",
    "pending-proposals",
    "timeline-slice",
    "assignment-recommendation",
}


@router.post("/{tool_name}", response_model=ProjectFlowToolResult)
def execute_tool(
    tool_name: str,
    request: ToolExecutionRequest,
    session: Session = Depends(get_session),
) -> ProjectFlowToolResult:
    """Execute a ProjectFlow tool via the unified internal contract.

    The sidecar submits one envelope (run_id, tool_call_id, arguments, trace, ...);
    FastAPI dispatches to the tool handler and returns a ProjectFlowToolResult.
    """
    # Reconcile path tool_name with envelope tool_name if the sidecar set one.
    effective_name = request.tool_name or tool_name
    request = request.model_copy(update={"tool_name": effective_name})

    if effective_name not in REGISTERED_TOOLS:
        raise HTTPException(status_code=404, detail=f"Tool not found: {tool_name}")

    try:
        return dispatch_tool(session, request)
    except ToolNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
