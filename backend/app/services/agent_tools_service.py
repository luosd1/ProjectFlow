"""T41 Internal Agent Tools Service.

Dispatches POST /internal/agent-tools/{tool_name} to read-only tool handlers
and wraps results in the unified ProjectFlowToolResult envelope.

Read-only tools never mutate Primary Project State; they return
side_effect_status=no_side_effect. Write/proposal tools (S8+) will plug into
this same dispatcher with richer side_effect_status values.
"""

from typing import Any

from sqlmodel import Session

from app.models.enums import SideEffectStatus, ToolResultStatus
from app.schemas.agent_proposal import AgentProposalRead
from app.schemas.agent_conversation import AgentConversationRead
from app.schemas.runtime import ProjectFlowToolResult, ToolExecutionRequest
from app.schemas.workspace_state import WorkspaceStateResponse
from app.services.agent_conversation_service import read_project_conversation
from app.services.agent_proposal_service import list_proposals_by_project, to_proposal_read
from app.services.timeline_service import event_to_read, list_timeline_by_project
from app.services.workspace_state_service import get_workspace_state


class ToolNotFoundError(ValueError):
    """Raised when the requested tool_name is not registered."""


def _success(data: Any, observation: str) -> ProjectFlowToolResult:
    return ProjectFlowToolResult(
        status=ToolResultStatus.success,
        data=data if isinstance(data, dict) else {"value": data},
        side_effect_status=SideEffectStatus.no_side_effect,
        observation=observation,
    )


def _serialize(value: Any) -> dict[str, Any]:
    """Normalize a pydantic model / list of models into a JSON-safe dict."""
    if isinstance(value, list):
        return {"items": [_item_to_dict(v) for v in value]}
    return _item_to_dict(value)


def _item_to_dict(value: Any) -> dict[str, Any]:
    if hasattr(value, "model_dump"):
        return value.model_dump(mode="json")
    if isinstance(value, dict):
        return value
    return {"value": value}


def execute_read_only_tool(session: Session, request: ToolExecutionRequest) -> ProjectFlowToolResult:
    """Dispatch a read-only tool call and return a unified ProjectFlowToolResult."""
    tool_name = request.tool_name
    args = request.arguments or {}
    workspace_id = request.workspace_id
    project_id = args.get("project_id") or request.project_id

    if tool_name == "workspace-state":
        state = get_workspace_state(session, workspace_id, project_id=args.get("project_id"))
        if state is None:
            return ProjectFlowToolResult(
                status=ToolResultStatus.failed,
                side_effect_status=SideEffectStatus.no_side_effect,
                observation=f"Workspace {workspace_id} not found",
            )
        return _success(_serialize(state), "workspace_state")

    if tool_name == "conversation":
        try:
            conversation = read_project_conversation(session, project_id)
        except ValueError as exc:
            return ProjectFlowToolResult(
                status=ToolResultStatus.failed,
                side_effect_status=SideEffectStatus.no_side_effect,
                observation=str(exc),
            )
        return _success(_serialize(conversation), "agent_conversation")

    if tool_name == "pending-proposals":
        proposals = list_proposals_by_project(session, project_id, status="pending")
        data = {"items": [to_proposal_read(p).model_dump(mode="json") for p in proposals]}
        return _success(data, f"{len(proposals)} pending proposals")

    if tool_name == "timeline-slice":
        limit = int(args.get("limit", 20))
        since = args.get("since")
        event_types = args.get("event_types")
        if isinstance(event_types, list):
            event_types = ",".join(str(t) for t in event_types)
        events = list_timeline_by_project(
            session,
            project_id,
            limit=limit,
            since=since if isinstance(since, str) else None,
            event_types=event_types if isinstance(event_types, str) else None,
        )
        # Use the same AgentEventRead shape as the public timeline route
        data = {"items": [event_to_read(e).model_dump(mode="json") for e in events]}
        return _success(data, f"{len(events)} timeline events")

    raise ToolNotFoundError(f"Unknown read-only tool: {tool_name}")


__all__ = [
    "execute_read_only_tool",
    "ToolNotFoundError",
    "WorkspaceStateResponse",
    "AgentConversationRead",
    "AgentProposalRead",
]
