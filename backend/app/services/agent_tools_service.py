"""T41 Internal Agent Tools Service.

Dispatches POST /internal/agent-tools/{tool_name} to tool handlers
and wraps results in the unified ProjectFlowToolResult envelope.

Read-only tools return side_effect_status=no_side_effect.
Write/proposal tools (S8+) return richer side_effect_status values
(e.g. proposal_persisted) and populate links.created_ids.
"""

from typing import Any

from pydantic import ValidationError
from sqlmodel import Session

from app.models import User
from app.models.enums import SideEffectStatus, ToolResultStatus
from app.schemas.agent_proposal import AgentProposalRead
from app.schemas.agent_conversation import AgentConversationRead
from app.schemas.assignment import AssignmentProposalCreate, AssignmentProposalRead
from app.schemas.runtime import ProjectFlowToolResult, ToolExecutionRequest, ToolLinks
from app.schemas.workspace_state import WorkspaceStateResponse
from app.services.agent_conversation_service import read_project_conversation
from app.services.agent_proposal_service import list_proposals_by_project, to_proposal_read
from app.services.assignment_service import create_assignment_proposal
from app.services.timeline_service import event_to_read, list_timeline_by_project
from app.services.workspace_state_service import get_workspace_state


class ToolNotFoundError(ValueError):
    """Raised when the requested tool_name is not registered."""


# Read-only tools currently exposed through this dispatcher.
READ_ONLY_TOOLS = {
    "workspace-state",
    "conversation",
    "pending-proposals",
    "timeline-slice",
}


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


# ─── Proposal tools (S8+) ─────────────────────────────────────────────────


def execute_assignment_recommendation(session: Session, request: ToolExecutionRequest) -> ProjectFlowToolResult:
    """Create an AssignmentProposal from agent recommendation.

    risk_category=draft_only, effects.effect_type=proposal_create.
    Creates an AssignmentProposal without writing Task.owner_user_id.
    Final owner is only written by finalize_assignment_proposal (human-triggered).
    """
    args = request.arguments or {}
    project_id = request.project_id

    # Validate required fields
    required = ["stage_id", "task_id", "recommended_owner_user_id", "reason"]
    missing = [f for f in required if not args.get(f)]
    if missing:
        return ProjectFlowToolResult(
            status=ToolResultStatus.validation_error,
            side_effect_status=SideEffectStatus.no_side_effect,
            observation=f"缺少必填字段：{', '.join(missing)}",
        )

    try:
        create_data = AssignmentProposalCreate(
            project_id=project_id,
            stage_id=args["stage_id"],
            task_id=args["task_id"],
            recommended_owner_user_id=args["recommended_owner_user_id"],
            backup_owner_user_id=args.get("backup_owner_user_id"),
            reason=args["reason"],
            skill_match=args.get("skill_match"),
            availability_match=args.get("availability_match"),
            preference_match=args.get("preference_match"),
            constraint_respected=args.get("constraint_respected"),
            risk_note=args.get("risk_note"),
            created_by_agent=True,
        )
        proposal = create_assignment_proposal(session, create_data, auto_commit=True)
        read_schema = AssignmentProposalRead.model_validate(proposal, from_attributes=True)

        # Look up display_name for user-readable observation (CLAUDE.md: 禁止原始 ID)
        owner_user = session.get(User, args["recommended_owner_user_id"])
        owner_name = owner_user.display_name if owner_user else args["recommended_owner_user_id"]

        return ProjectFlowToolResult(
            status=ToolResultStatus.success,
            data=read_schema.model_dump(mode="json"),
            side_effect_status=SideEffectStatus.proposal_persisted,
            idempotency_key=request.idempotency_key,
            links=ToolLinks(proposal_id=proposal.id, created_ids=[proposal.id]),
            observation=f"分工建议已创建：推荐 {owner_name} 负责任务",
        )
    except (ValueError, ValidationError) as exc:
        # Validation errors (task already has proposal, rejected pair, schema errors, etc.)
        return ProjectFlowToolResult(
            status=ToolResultStatus.validation_error,
            side_effect_status=SideEffectStatus.no_side_effect,
            observation=str(exc),
        )


# ─── Tool dispatch ─────────────────────────────────────────────────────────


# All tools dispatched through the unified endpoint.
ALL_TOOLS = READ_ONLY_TOOLS | {"assignment-recommendation"}


def execute_tool(session: Session, request: ToolExecutionRequest) -> ProjectFlowToolResult:
    """Dispatch any tool call through the unified internal contract."""
    tool_name = request.tool_name

    if tool_name in READ_ONLY_TOOLS:
        return execute_read_only_tool(session, request)

    if tool_name == "assignment-recommendation":
        return execute_assignment_recommendation(session, request)

    raise ToolNotFoundError(f"Unknown tool: {tool_name}")


__all__ = [
    "execute_read_only_tool",
    "execute_assignment_recommendation",
    "execute_tool",
    "ToolNotFoundError",
    "WorkspaceStateResponse",
    "AgentConversationRead",
    "AgentProposalRead",
]
