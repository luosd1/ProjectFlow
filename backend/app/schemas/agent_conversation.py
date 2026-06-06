from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field


AgentConversationStatus = Literal["active", "archived"]
AgentMessageRole = Literal["user", "assistant", "tool"]


class AgentTurnPlan(BaseModel):
    response_type: Literal[
        "answer",
        "ask_clarifying_question",
        "run_module",
        "revise_pending_proposal",
    ]
    selected_module: Literal[
        "clarify",
        "plan",
        "breakdown",
        "assign",
        "push",
        "checkin",
        "risk",
        "replan",
    ] | None = None
    user_instruction: str = ""
    rationale: str
    required_inputs: list[str] = Field(default_factory=list)
    expected_artifact: str | None = None
    risk_level: Literal["low", "medium", "high"] = "low"
    requires_confirmation: bool = False


class AgentConversationMessageCreate(BaseModel):
    content: str = Field(min_length=1, max_length=4000)


class AgentMessageRead(BaseModel):
    id: str
    conversation_id: str
    role: AgentMessageRole | str
    content: str
    structured_payload: dict[str, Any]
    linked_event_id: str | None
    linked_proposal_id: str | None
    created_at: datetime


class AgentRunRead(BaseModel):
    id: str
    conversation_id: str
    project_id: str
    user_instruction: str
    selected_module: str
    status: str
    model: str
    attempts: int
    verifier_status: str
    agent_event_id: str | None
    proposal_id: str | None
    created_at: datetime
    completed_at: datetime | None


class AgentConversationRead(BaseModel):
    id: str
    workspace_id: str
    project_id: str
    status: AgentConversationStatus | str
    summary: str
    current_focus: str
    messages: list[AgentMessageRead] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime


class AgentConversationTurnRead(BaseModel):
    conversation: AgentConversationRead
    user_message: AgentMessageRead
    assistant_message: AgentMessageRead
    run: AgentRunRead | None
    turn_plan: AgentTurnPlan | None
    next_suggestions: list[str] = Field(default_factory=list)
