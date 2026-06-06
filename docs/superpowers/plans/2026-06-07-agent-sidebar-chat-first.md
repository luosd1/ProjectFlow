# Agent Sidebar Chat-first Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the project page right Agent sidebar into a Chat-first guided conversation flow where suggestion clicks send user instructions, Agent outputs appear as conversation artifacts, and proposal confirmation is visible in the conversation.

**Architecture:** Keep the real Agent decision path in the backend conversation service. Add structured `suggestions` and `artifacts` to conversation turns, attach them to assistant message payloads for refresh recovery, then refactor the frontend sidebar into focused conversation primitives that render messages, run status, artifacts, and light suggestion replies. Existing project overview proposal panels remain synced through the existing project state reload path.

**Tech Stack:** FastAPI, SQLModel, Pydantic v2, Next.js App Router, React 18, TypeScript, Tailwind CSS, Vitest, Testing Library, existing repo-local `scripts/npm` wrapper.

---

## Scope Check

This plan implements the approved spec as one testable slice:

- Backend conversation turns return structured suggestions and artifacts.
- Frontend API/types understand the new contract while keeping existing fields during migration.
- Right Agent sidebar becomes Chat-first with guided suggestions and conversation-local artifacts.
- Page state preserves smooth pending/error states.
- Verification covers backend tests, frontend tests, lint, build, and browser smoke checks.

It does not add SSE streaming, a full-screen Agent workspace, or a new database table for generic artifacts.

## File Structure

Backend files:

- Modify `backend/app/schemas/agent_conversation.py`: define `AgentSuggestionRead`, `AgentArtifactRead`, and extend `AgentConversationTurnRead`.
- Modify `backend/app/services/agent_conversation_service.py`: build structured suggestions and artifacts, attach them to assistant message payloads, and avoid internal planner wording in fallback text.
- Modify `backend/app/tests/test_agent_conversation_flow.py`: cover structured suggestions, proposal artifacts, risk/action artifacts, and payload recovery.

Frontend files:

- Modify `frontend/src/lib/types.ts`: add `AgentSuggestion`, `AgentArtifact`, and extend `AgentConversationTurn`.
- Modify `frontend/src/lib/api.ts`: keep `sendAgentConversationMessage()` body as natural-language content and normalize legacy suggestion strings into structured suggestions.
- Modify `frontend/src/lib/api.test.ts`: cover structured suggestions and artifacts.
- Create `frontend/src/components/project/agent-conversation-cards.tsx`: pure UI units for context, run status, error, artifact, and suggestions.
- Create `frontend/src/components/project/agent-sidebar.test.tsx`: component tests for the Chat-first flow.
- Modify `frontend/src/components/project/agent-sidebar.tsx`: refactor layout to Chat-first and use the new card primitives.
- Modify `frontend/src/app/workspaces/[workspaceId]/page.tsx`: store structured suggestions, last turn artifacts when needed, pending instruction, and conversation error.
- Modify `frontend/src/components/project/project-layout.tsx` and `frontend/src/components/project/workspace-layout.tsx`: pass the new sidebar props through.

## Task 1: Backend Structured Turn Contract

**Files:**
- Modify: `backend/app/schemas/agent_conversation.py`
- Modify: `backend/app/services/agent_conversation_service.py`
- Test: `backend/app/tests/test_agent_conversation_flow.py`

- [ ] **Step 1: Write the failing backend test for structured suggestions and proposal artifact**

Add this test to `backend/app/tests/test_agent_conversation_flow.py` after `test_service_accepts_llm_planner_alias_fields_for_module_execution`:

```python
def test_conversation_turn_returns_structured_suggestions_and_proposal_artifact():
    engine = _session_fixture()
    with Session(engine) as session:
        seed_demo_data(session)
        conversation = get_or_create_project_conversation(session, "demo-project-001")
        llm_client = MockLLMClient(
            responses=[
                json.dumps(
                    {
                        "response_type": "run_module",
                        "selected_module": "replan",
                        "user_instruction": "根据签到调整计划",
                        "rationale": "签到显示后端阻塞，需要生成计划调整草案。",
                        "required_inputs": [],
                        "expected_artifact": "计划调整草案",
                        "risk_level": "medium",
                        "requires_confirmation": True,
                    },
                    ensure_ascii=False,
                ),
                "{}",
            ]
        )

        result = process_conversation_message(
            session,
            conversation.id,
            "根据签到调整计划",
            llm_client=llm_client,
        )

        assert result.run is not None
        assert result.run.proposal_id is not None
        assert result.suggestions
        assert result.suggestions[0].label
        assert result.suggestions[0].user_instruction
        assert result.suggestions[0].priority in {"primary", "secondary"}
        assert result.artifacts
        artifact = result.artifacts[0]
        assert artifact.type == "proposal"
        assert artifact.status == "pending_confirmation"
        assert artifact.linked_entity_ids == [result.run.proposal_id]
        assert "计划" in artifact.title or "调整" in artifact.title
        assert artifact.summary
        assert artifact.rationale
        assert artifact.impact
        assert result.assistant_message.structured_payload["artifacts"][0]["id"] == artifact.id
        assert result.assistant_message.structured_payload["suggestions"][0]["label"] == result.suggestions[0].label
```

- [ ] **Step 2: Run the backend test and verify it fails for missing fields**

Run:

```bash
cd backend
/Users/robertwu/.codex/scripts/rtk .venv/bin/python -m pytest app/tests/test_agent_conversation_flow.py::test_conversation_turn_returns_structured_suggestions_and_proposal_artifact -q
```

Expected: fail with an error that `AgentConversationTurnRead` has no `suggestions` or `artifacts` field.

- [ ] **Step 3: Add schema models for suggestions and artifacts**

In `backend/app/schemas/agent_conversation.py`, add these classes after `AgentRunRead`:

```python
class AgentSuggestionRead(BaseModel):
    id: str
    label: str
    user_instruction: str
    priority: Literal["primary", "secondary"] = "secondary"


class AgentArtifactRead(BaseModel):
    id: str
    type: Literal[
        "proposal",
        "risk_analysis",
        "action_card",
        "assignment",
        "direction",
        "plan",
    ]
    status: Literal[
        "draft",
        "pending_confirmation",
        "confirmed",
        "dismissed",
        "expired",
    ]
    title: str
    summary: str
    rationale: str
    impact: list[str] = Field(default_factory=list)
    linked_entity_ids: list[str] = Field(default_factory=list)
```

Then replace `AgentConversationTurnRead` with:

```python
class AgentConversationTurnRead(BaseModel):
    conversation: AgentConversationRead
    user_message: AgentMessageRead
    assistant_message: AgentMessageRead
    run: AgentRunRead | None
    turn_plan: AgentTurnPlan | None
    next_suggestions: list[str] = Field(default_factory=list)
    suggestions: list[AgentSuggestionRead] = Field(default_factory=list)
    artifacts: list[AgentArtifactRead] = Field(default_factory=list)
```

- [ ] **Step 4: Add backend artifact and suggestion builders**

In `backend/app/services/agent_conversation_service.py`, update the schema imports:

```python
from app.schemas.agent_conversation import (
    AgentArtifactRead,
    AgentConversationRead,
    AgentConversationTurnRead,
    AgentMessageRead,
    AgentRunRead,
    AgentSuggestionRead,
    AgentTurnPlan,
)
```

Update the model import line:

```python
from app.models import AgentEvent, AgentProposal, Project
```

Add these helpers before `_next_suggestions`:

```python
def _structured_suggestions(workspace_state) -> list[AgentSuggestionRead]:
    labels = _next_suggestions(workspace_state)
    suggestions: list[AgentSuggestionRead] = []
    for index, label in enumerate(labels[:3]):
        suggestions.append(
            AgentSuggestionRead(
                id=f"suggestion-{index + 1}",
                label=label,
                user_instruction=label,
                priority="primary" if index == 0 else "secondary",
            )
        )
    return suggestions


def _artifacts_from_flow_result(session: Session, flow_result, turn_plan: AgentTurnPlan) -> list[AgentArtifactRead]:
    artifacts: list[AgentArtifactRead] = []
    if flow_result.proposal_id:
        proposal = session.get(AgentProposal, flow_result.proposal_id)
        if proposal:
            artifacts.append(_proposal_to_artifact(proposal, turn_plan))
    elif turn_plan.selected_module == "risk" and flow_result.created_ids:
        artifacts.append(
            AgentArtifactRead(
                id=f"risk-artifact-{flow_result.created_ids[0]}",
                type="risk_analysis",
                status="draft",
                title="风险分析",
                summary=f"已识别 {len(flow_result.created_ids)} 个风险信号。",
                rationale=turn_plan.rationale,
                impact=flow_result.created_ids,
                linked_entity_ids=flow_result.created_ids,
            )
        )
    elif turn_plan.selected_module == "push" and flow_result.created_ids:
        artifacts.append(
            AgentArtifactRead(
                id=f"action-artifact-{flow_result.created_ids[0]}",
                type="action_card",
                status="draft",
                title="下一步行动卡",
                summary=f"已生成 {len(flow_result.created_ids)} 张行动卡。",
                rationale=turn_plan.rationale,
                impact=flow_result.created_ids,
                linked_entity_ids=flow_result.created_ids,
            )
        )
    return artifacts


def _proposal_to_artifact(proposal: AgentProposal, turn_plan: AgentTurnPlan) -> AgentArtifactRead:
    payload = _proposal_payload(proposal)
    title = _proposal_title(proposal.proposal_type)
    proposal_status = getattr(proposal.status, "value", proposal.status)
    status = {
        "pending": "pending_confirmation",
        "confirmed": "confirmed",
        "rejected": "dismissed",
    }.get(str(proposal_status), "draft")
    return AgentArtifactRead(
        id=f"proposal-artifact-{proposal.id}",
        type="proposal",
        status=status,
        title=title,
        summary=_proposal_summary(payload, title),
        rationale=_proposal_rationale(payload, turn_plan.rationale),
        impact=_proposal_impact(payload, proposal.proposal_type),
        linked_entity_ids=[proposal.id],
    )


def _proposal_payload(proposal: AgentProposal) -> dict[str, Any]:
    if isinstance(proposal.payload, dict):
        return proposal.payload
    try:
        parsed = json.loads(proposal.payload)
    except json.JSONDecodeError:
        return {}
    return parsed if isinstance(parsed, dict) else {"items": parsed}


def _proposal_title(proposal_type: str) -> str:
    return {
        "clarify": "方向澄清提案",
        "plan": "阶段计划提案",
        "breakdown": "任务拆解提案",
        "replan": "计划调整草案",
    }.get(proposal_type, "Agent 提案")


def _proposal_summary(payload: dict[str, Any], fallback_title: str) -> str:
    for key in ("summary", "reason", "rationale", "impact", "problem", "goal"):
        value = payload.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    if isinstance(payload.get("stages"), list):
        return f"{fallback_title}包含 {len(payload['stages'])} 个阶段。"
    if isinstance(payload.get("tasks"), list):
        return f"{fallback_title}包含 {len(payload['tasks'])} 个任务。"
    return f"{fallback_title}已生成，等待你确认后应用。"


def _proposal_rationale(payload: dict[str, Any], fallback: str) -> str:
    for key in ("reason", "rationale", "why", "analysis"):
        value = payload.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return fallback or "Agent 根据当前项目状态生成了这条建议。"


def _proposal_impact(payload: dict[str, Any], proposal_type: str) -> list[str]:
    value = payload.get("impact")
    if isinstance(value, list):
        return [str(item) for item in value if str(item).strip()]
    if isinstance(value, str) and value.strip():
        return [value.strip()]
    if proposal_type == "replan":
        return ["可能调整任务优先级、负责人或截止时间。"]
    if proposal_type == "plan":
        return ["确认后会更新阶段计划。"]
    if proposal_type == "breakdown":
        return ["确认后会更新任务拆解。"]
    if proposal_type == "clarify":
        return ["确认后会更新方向卡。"]
    return ["确认后会同步到项目。"]
```

- [ ] **Step 5: Return structured suggestions and artifacts from `process_conversation_message`**

In `process_conversation_message`, initialize `artifacts` before the module branch:

```python
    artifacts: list[AgentArtifactRead] = []
```

Inside the successful module branch, after `flow_result = _run_selected_module(...)`, add:

```python
        artifacts = _artifacts_from_flow_result(session, flow_result, turn_plan)
```

Before creating `assistant_message`, add:

```python
    suggestions = _structured_suggestions(workspace_state)
```

Replace the `assistant_message.set_structured_payload(...)` call with:

```python
    assistant_message.set_structured_payload(
        {
            "turn_plan": turn_plan.model_dump(mode="json"),
            "blocked_reason": blocked_reason,
            "next_suggestions": _next_suggestions(workspace_state),
            "suggestions": [suggestion.model_dump(mode="json") for suggestion in suggestions],
            "artifacts": [artifact.model_dump(mode="json") for artifact in artifacts],
        }
    )
```

Replace the `return AgentConversationTurnRead(...)` block with:

```python
    return AgentConversationTurnRead(
        conversation=_conversation_to_read(session, conversation),
        user_message=_message_to_read(user_message),
        assistant_message=_message_to_read(assistant_message),
        run=run_read,
        turn_plan=turn_plan,
        next_suggestions=_next_suggestions(workspace_state),
        suggestions=suggestions,
        artifacts=artifacts,
    )
```

- [ ] **Step 6: Run the targeted backend test**

Run:

```bash
cd backend
/Users/robertwu/.codex/scripts/rtk .venv/bin/python -m pytest app/tests/test_agent_conversation_flow.py::test_conversation_turn_returns_structured_suggestions_and_proposal_artifact -q
```

Expected: `1 passed`.

- [ ] **Step 7: Run the full conversation backend test file**

Run:

```bash
cd backend
/Users/robertwu/.codex/scripts/rtk .venv/bin/python -m pytest app/tests/test_agent_conversation_flow.py -q
```

Expected: all tests in `test_agent_conversation_flow.py` pass.

- [ ] **Step 8: Commit Task 1**

Run:

```bash
git add backend/app/schemas/agent_conversation.py backend/app/services/agent_conversation_service.py backend/app/tests/test_agent_conversation_flow.py
git diff --cached --name-status
git commit -m "feat: return structured agent conversation turns"
```

Expected staged files:

```text
M	backend/app/schemas/agent_conversation.py
M	backend/app/services/agent_conversation_service.py
M	backend/app/tests/test_agent_conversation_flow.py
```

## Task 2: Frontend API and Type Contract

**Files:**
- Modify: `frontend/src/lib/types.ts`
- Modify: `frontend/src/lib/api.ts`
- Test: `frontend/src/lib/api.test.ts`

- [ ] **Step 1: Write the failing API test for structured suggestions and artifacts**

In `frontend/src/lib/api.test.ts`, update the `sends natural language messages to the backend agent conversation` mock response by adding these fields next to `next_suggestions`:

```ts
          next_suggestions: ["确认这个阶段计划"],
          suggestions: [
            {
              id: "suggestion-1",
              label: "确认这个阶段计划",
              user_instruction: "确认这个阶段计划",
              priority: "primary",
            },
          ],
          artifacts: [
            {
              id: "proposal-artifact-1",
              type: "proposal",
              status: "pending_confirmation",
              title: "阶段计划提案",
              summary: "三周阶段计划已生成。",
              rationale: "用户要求按三周节奏重新规划。",
              impact: ["确认后会更新阶段计划。"],
              linked_entity_ids: ["proposal-1"],
            },
          ],
```

Add these assertions after the existing expectations:

```ts
    expect(result.suggestions[0].user_instruction).toBe("确认这个阶段计划");
    expect(result.artifacts[0].type).toBe("proposal");
    expect(result.artifacts[0].linked_entity_ids).toEqual(["proposal-1"]);
```

- [ ] **Step 2: Run the API test and verify it fails on missing TypeScript fields**

Run:

```bash
cd frontend
../scripts/npm run test -- src/lib/api.test.ts
```

Expected: fail because `AgentConversationTurn` has no `suggestions` or `artifacts`.

- [ ] **Step 3: Add frontend types**

In `frontend/src/lib/types.ts`, add these types after `AgentConversationRun`:

```ts
export type AgentSuggestion = {
  id: string;
  label: string;
  user_instruction: string;
  priority: "primary" | "secondary";
};

export type AgentArtifact = {
  id: string;
  type: "proposal" | "risk_analysis" | "action_card" | "assignment" | "direction" | "plan";
  status: "draft" | "pending_confirmation" | "confirmed" | "dismissed" | "expired";
  title: string;
  summary: string;
  rationale: string;
  impact: string[];
  linked_entity_ids: string[];
};
```

Then replace `AgentConversationTurn` with:

```ts
export type AgentConversationTurn = {
  conversation: AgentConversation;
  user_message: AgentConversationMessage;
  assistant_message: AgentConversationMessage;
  run?: AgentConversationRun | null;
  turn_plan?: AgentTurnPlan | null;
  next_suggestions: string[];
  suggestions: AgentSuggestion[];
  artifacts: AgentArtifact[];
};
```

- [ ] **Step 4: Normalize legacy backend responses in the API layer**

In `frontend/src/lib/api.ts`, import `AgentSuggestion` with the existing type imports:

```ts
  AgentSuggestion,
```

Add this helper above `sendAgentConversationMessage`:

```ts
function normalizeAgentConversationTurn(turn: AgentConversationTurn): AgentConversationTurn {
  const suggestions = Array.isArray(turn.suggestions) && turn.suggestions.length > 0
    ? turn.suggestions
    : (turn.next_suggestions ?? []).slice(0, 3).map((label, index): AgentSuggestion => ({
        id: `suggestion-${index + 1}`,
        label,
        user_instruction: label,
        priority: index === 0 ? "primary" : "secondary",
      }));

  return {
    ...turn,
    suggestions,
    artifacts: Array.isArray(turn.artifacts) ? turn.artifacts : [],
    next_suggestions: turn.next_suggestions ?? suggestions.map((suggestion) => suggestion.label),
  };
}
```

Replace `sendAgentConversationMessage` with:

```ts
export async function sendAgentConversationMessage(
  conversationId: string,
  content: string,
): Promise<AgentConversationTurn> {
  const turn = await request<AgentConversationTurn>(`/agent/conversations/${conversationId}/messages`, {
    method: "POST",
    body: JSON.stringify({ content }),
  });
  return normalizeAgentConversationTurn(turn);
}
```

- [ ] **Step 5: Run the API test**

Run:

```bash
cd frontend
../scripts/npm run test -- src/lib/api.test.ts
```

Expected: `api.test.ts` passes.

- [ ] **Step 6: Commit Task 2**

Run:

```bash
git add frontend/src/lib/types.ts frontend/src/lib/api.ts frontend/src/lib/api.test.ts
git diff --cached --name-status
git commit -m "feat: type structured agent conversation turns"
```

Expected staged files:

```text
M	frontend/src/lib/api.test.ts
M	frontend/src/lib/api.ts
M	frontend/src/lib/types.ts
```

## Task 3: Conversation UI Primitives

**Files:**
- Create: `frontend/src/components/project/agent-conversation-cards.tsx`
- Create: `frontend/src/components/project/agent-sidebar.test.tsx`
- Modify: `frontend/src/components/project/agent-sidebar.tsx`

- [ ] **Step 1: Write failing component tests for Chat-first behavior**

Create `frontend/src/components/project/agent-sidebar.test.tsx` with:

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AgentSidebar } from "./agent-sidebar";
import type { AgentArtifact, AgentConversation, AgentSuggestion, ProjectState } from "@/lib/types";

const baseState = {
  workspace: {
    workspace_id: "workspace-1",
    name: "Demo Workspace",
    owner_user_id: "user-1",
    description: null,
    created_at: "2026-06-06T00:00:00Z",
    updated_at: "2026-06-06T00:00:00Z",
  },
  project: {
    id: "project-1",
    workspace_id: "workspace-1",
    name: "ProjectFlow",
    idea: "Demo",
    deadline: "2026-06-09",
    deliverables: "Demo",
    status: "active",
    current_stage_id: "stage-1",
    direction_card: null,
    created_by: "user-1",
    created_at: "2026-06-06T00:00:00Z",
    updated_at: "2026-06-06T00:00:00Z",
  },
  resources: [],
  members: [],
  memberships: [],
  member_profiles: [],
  projects: [],
  stages: [{ id: "stage-1", project_id: "project-1", name: "核心实现", goal: "Demo", start_date: "2026-06-01", end_date: "2026-06-09", deliverable: "Demo", done_criteria: [], status: "active", order_index: 1 }],
  tasks: [{ id: "task-1", project_id: "project-1", stage_id: "stage-1", title: "后端 API", description: "完成 API", priority: "P0", status: "in_progress", owner_user_id: "user-1", backup_owner_user_id: null, due_date: "2026-06-08", estimated_hours: 6, dependency_ids: [], acceptance_criteria: [], can_cut: false, assignment_reason: null, created_by_agent: true, updated_at: "2026-06-06T00:00:00Z" }],
  agent_proposals: [],
  assignment_proposals: [],
  assignment_responses: [],
  assignment_negotiations: [],
  checkins: [],
  risks: [],
  action_cards: [],
  timeline: [],
} satisfies ProjectState;

const conversation: AgentConversation = {
  id: "conversation-1",
  workspace_id: "workspace-1",
  project_id: "project-1",
  status: "active",
  summary: "",
  current_focus: "执行推进",
  messages: [
    {
      id: "assistant-1",
      conversation_id: "conversation-1",
      role: "assistant",
      content: "现在最有效的是根据签到调整计划。",
      structured_payload: {},
      linked_event_id: null,
      linked_proposal_id: null,
      created_at: "2026-06-06T00:00:00Z",
    },
  ],
  created_at: "2026-06-06T00:00:00Z",
  updated_at: "2026-06-06T00:00:00Z",
};

const suggestions: AgentSuggestion[] = [
  { id: "suggestion-1", label: "根据签到调整计划", user_instruction: "根据签到调整计划", priority: "primary" },
  { id: "suggestion-2", label: "先解释风险来源", user_instruction: "先解释风险来源", priority: "secondary" },
];

const artifacts: AgentArtifact[] = [
  {
    id: "proposal-artifact-1",
    type: "proposal",
    status: "pending_confirmation",
    title: "计划调整草案",
    summary: "建议把后端协助前置。",
    rationale: "签到显示后端阻塞。",
    impact: ["影响 3 个任务"],
    linked_entity_ids: ["proposal-1"],
  },
];

describe("AgentSidebar", () => {
  it("sends suggestion clicks as user instructions", () => {
    const onSendMessage = vi.fn();
    render(
      <AgentSidebar
        state={baseState}
        conversation={conversation}
        conversationSuggestions={suggestions}
        onRunAgent={vi.fn()}
        onSendMessage={onSendMessage}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "根据签到调整计划" }));

    expect(onSendMessage).toHaveBeenCalledWith("根据签到调整计划");
  });

  it("shows pending instruction and run status while Agent is working", () => {
    render(
      <AgentSidebar
        state={baseState}
        conversation={conversation}
        conversationSuggestions={suggestions}
        pendingConversation
        pendingConversationInstruction="根据签到调整计划"
        onRunAgent={vi.fn()}
        onSendMessage={vi.fn()}
      />
    );

    expect(screen.getByText("根据签到调整计划")).toBeTruthy();
    expect(screen.getByText("Agent 正在处理")).toBeTruthy();
    expect(screen.getByText("读取项目状态")).toBeTruthy();
  });

  it("renders conversation artifacts with confirmation actions", () => {
    render(
      <AgentSidebar
        state={baseState}
        conversation={conversation}
        conversationSuggestions={suggestions}
        conversationArtifacts={artifacts}
        onRunAgent={vi.fn()}
        onSendMessage={vi.fn()}
        onConfirmArtifact={vi.fn()}
      />
    );

    expect(screen.getByText("计划调整草案")).toBeTruthy();
    expect(screen.getByText("建议把后端协助前置。")).toBeTruthy();
    expect(screen.getByRole("button", { name: "确认应用" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "继续修改" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "查看影响" })).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run the component test and verify it fails**

Run:

```bash
cd frontend
../scripts/npm run test -- src/components/project/agent-sidebar.test.tsx
```

Expected: fail because `AgentSidebar` props and artifact UI do not exist yet.

- [ ] **Step 3: Create conversation card primitives**

Create `frontend/src/components/project/agent-conversation-cards.tsx`:

```tsx
"use client";

import { AlertTriangle, CheckCircle2, Loader2, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { AgentArtifact, AgentSuggestion } from "@/lib/types";

export function AgentContextCard({ focus, pendingCount }: { focus: string; pendingCount: number }) {
  return (
    <div className="rounded-lg border border-moss/20 bg-moss/5 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-moss">
          <Sparkles className="h-3.5 w-3.5" />
          当前最值得推进
        </div>
        {pendingCount > 0 && (
          <span className="rounded-full bg-moss/15 px-2 py-0.5 text-[10px] font-semibold text-moss">
            {pendingCount} 待确认
          </span>
        )}
      </div>
      <p className="mt-2 text-sm font-semibold text-neutral-900">{focus}</p>
      <p className="mt-1 text-xs leading-5 text-neutral-600">{focusReason(focus)}</p>
    </div>
  );
}

export function AgentRunStatusCard() {
  return (
    <div className="rounded-lg border border-moss/20 bg-white p-3 text-xs text-neutral-600">
      <div className="flex items-center gap-2 font-semibold text-moss">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Agent 正在处理
      </div>
      <div className="mt-2 space-y-1.5">
        <p>读取项目状态</p>
        <p>判断下一步影响</p>
        <p>整理可确认结果</p>
      </div>
    </div>
  );
}

export function AgentErrorCard({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="rounded-lg border border-coral/20 bg-coral/10 p-3 text-xs text-coral">
      <div className="flex items-center gap-2 font-semibold">
        <AlertTriangle className="h-3.5 w-3.5" />
        Agent 暂时没有完成这次处理
      </div>
      <p className="mt-2 leading-5">{message}</p>
      {onRetry && (
        <Button type="button" variant="outline" size="sm" className="mt-2 h-7 text-xs" onClick={onRetry}>
          重新发送
        </Button>
      )}
    </div>
  );
}

export function AgentArtifactCard({
  artifact,
  onConfirm,
  onRevise,
  onInspect,
}: {
  artifact: AgentArtifact;
  onConfirm?: (artifact: AgentArtifact) => void;
  onRevise?: (artifact: AgentArtifact) => void;
  onInspect?: (artifact: AgentArtifact) => void;
}) {
  const canConfirm = artifact.status === "pending_confirmation";
  return (
    <div className="rounded-lg border border-moss/20 bg-white p-3 text-xs text-neutral-700">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-neutral-900">{artifact.title}</p>
          <p className="mt-1 leading-5">{artifact.summary}</p>
        </div>
        <span className="shrink-0 rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-semibold text-neutral-500">
          {artifactStatusLabel(artifact.status)}
        </span>
      </div>
      <div className="mt-2 rounded-md bg-neutral-50 p-2">
        <p className="font-semibold text-neutral-500">原因</p>
        <p className="mt-1 leading-5">{artifact.rationale}</p>
      </div>
      {artifact.impact.length > 0 && (
        <div className="mt-2 rounded-md bg-neutral-50 p-2">
          <p className="font-semibold text-neutral-500">影响</p>
          <ul className="mt-1 space-y-1">
            {artifact.impact.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      )}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {canConfirm && (
          <Button type="button" size="sm" className="h-7 bg-moss px-2.5 text-xs text-white hover:bg-moss/90" onClick={() => onConfirm?.(artifact)}>
            <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
            确认应用
          </Button>
        )}
        <Button type="button" variant="outline" size="sm" className="h-7 px-2.5 text-xs" onClick={() => onRevise?.(artifact)}>
          继续修改
        </Button>
        <Button type="button" variant="ghost" size="sm" className="h-7 px-2.5 text-xs" onClick={() => onInspect?.(artifact)}>
          查看影响
        </Button>
      </div>
    </div>
  );
}

export function AgentSuggestionRow({
  suggestions,
  disabled,
  onPick,
}: {
  suggestions: AgentSuggestion[];
  disabled?: boolean;
  onPick: (instruction: string) => void;
}) {
  if (suggestions.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {suggestions.slice(0, 3).map((suggestion) => (
        <button
          key={suggestion.id}
          type="button"
          onClick={() => onPick(suggestion.user_instruction)}
          disabled={disabled}
          className={cn(
            "rounded-full border px-2.5 py-1 text-[11px] transition disabled:cursor-not-allowed disabled:opacity-50",
            suggestion.priority === "primary"
              ? "border-moss bg-moss text-white hover:bg-moss/90"
              : "border-neutral-200 bg-white text-neutral-600 hover:border-moss/30 hover:text-moss"
          )}
        >
          {suggestion.label}
        </button>
      ))}
    </div>
  );
}

export function focusReason(focus: string): string {
  const reasons: Record<string, string> = {
    方向澄清: "先把目标、边界和取舍确认下来，后续计划才不会建立在模糊假设上。",
    阶段计划: "方向已经具备基础，可以按截止时间和交付物倒排阶段。",
    任务拆解: "阶段计划确认后，需要把阶段目标拆成可分配、可检查的任务。",
    分工确认: "任务明确后，需要结合成员技能、时间和偏好生成并确认分工。",
    执行推进: "分工确认后，Agent 可以持续生成行动卡、分析风险并建议重排。",
  };
  return reasons[focus] ?? "Agent 会根据当前项目状态判断下一步。";
}

function artifactStatusLabel(status: AgentArtifact["status"]) {
  return {
    draft: "草案",
    pending_confirmation: "待确认",
    confirmed: "已确认",
    dismissed: "已忽略",
    expired: "已过期",
  }[status];
}
```

- [ ] **Step 4: Extend `AgentSidebar` props and wire the new primitives**

In `frontend/src/components/project/agent-sidebar.tsx`, update imports:

```tsx
import type { AgentArtifact, AgentConversation, AgentEvent, AgentSuggestion, ProjectState } from "@/lib/types";
import {
  AgentArtifactCard,
  AgentContextCard,
  AgentErrorCard,
  AgentRunStatusCard,
  AgentSuggestionRow,
  focusReason,
} from "./agent-conversation-cards";
```

Update `AgentSidebarProps`:

```tsx
  conversationSuggestions?: AgentSuggestion[];
  conversationArtifacts?: AgentArtifact[];
  pendingConversationInstruction?: string | null;
  conversationError?: string | null;
  onConfirmArtifact?: (artifact: AgentArtifact) => void | Promise<void>;
```

Update the function arguments with the same props.

Set defaults in the destructuring block:

```tsx
  conversationSuggestions = [],
  conversationArtifacts = [],
  pendingConversationInstruction = null,
  conversationError = null,
```

Change the message list so it keeps all messages:

```tsx
  const messages = conversation?.messages ?? [];
```

Replace the existing suggestions line with:

```tsx
  const suggestions = conversationSuggestions.length > 0 ? conversationSuggestions : inferStructuredSuggestions(focus);
```

Add this helper inside `AgentSidebar` before `return`:

```tsx
  const payloadArtifacts = messages.flatMap((message) => {
    const artifacts = message.structured_payload?.artifacts;
    return Array.isArray(artifacts) ? (artifacts as AgentArtifact[]) : [];
  });
  const visibleArtifacts = Array.from(
    new Map([...payloadArtifacts, ...conversationArtifacts].map((artifact) => [artifact.id, artifact])).values()
  );
```

Add this helper near `inferSuggestions`:

```tsx
function inferStructuredSuggestions(focus: string): AgentSuggestion[] {
  return inferSuggestions(focus).slice(0, 3).map((label, index) => ({
    id: `fallback-suggestion-${index + 1}`,
    label,
    user_instruction: label,
    priority: index === 0 ? "primary" : "secondary",
  }));
}
```

In the conversation area, render this sequence:

```tsx
                  <div className="space-y-2">
                    <AgentContextCard focus={focus} pendingCount={pendingProposalCount} />
                    {messages.length === 0 && (
                      <div className="rounded-lg border border-neutral-200 bg-white p-3 text-xs leading-5 text-neutral-600">
                        {focusReason(focus)}
                      </div>
                    )}
                    {messages.map((message) => (
                      <div
                        key={message.id}
                        className={cn(
                          "rounded-lg border p-3 text-xs leading-5",
                          message.role === "user"
                            ? "ml-5 border-neutral-200 bg-white text-neutral-700"
                            : "mr-5 border-moss/20 bg-moss/5 text-neutral-700"
                        )}
                      >
                        <div className="mb-1 text-[10px] font-semibold text-neutral-400">
                          {message.role === "user" ? "你" : "Agent"}
                        </div>
                        {message.content}
                      </div>
                    ))}
                    {pendingConversationInstruction && (
                      <div className="ml-5 rounded-lg border border-neutral-200 bg-white p-3 text-xs leading-5 text-neutral-700">
                        <div className="mb-1 text-[10px] font-semibold text-neutral-400">你</div>
                        {pendingConversationInstruction}
                      </div>
                    )}
                    {pendingConversation && <AgentRunStatusCard />}
                    {visibleArtifacts.map((artifact) => (
                      <AgentArtifactCard
                        key={artifact.id}
                        artifact={artifact}
                        onConfirm={onConfirmArtifact}
                        onRevise={(item) => void submitMessage(`继续修改：${item.title}`)}
                        onInspect={(item) => void submitMessage(`解释这条建议的影响：${item.title}`)}
                      />
                    ))}
                    {conversationError && <AgentErrorCard message={conversationError} onRetry={() => pendingConversationInstruction && void submitMessage(pendingConversationInstruction)} />}
                  </div>
```

Replace the suggestion button block with:

```tsx
                  <div className="mt-3">
                    <AgentSuggestionRow
                      suggestions={suggestions}
                      disabled={Boolean(pendingConversation)}
                      onPick={(instruction) => void submitMessage(instruction)}
                    />
                  </div>
```

Keep `高级操作` and `重置演示数据` below the conversation, still collapsed by default.

- [ ] **Step 5: Run the component test**

Run:

```bash
cd frontend
../scripts/npm run test -- src/components/project/agent-sidebar.test.tsx
```

Expected: `agent-sidebar.test.tsx` passes.

- [ ] **Step 6: Commit Task 3**

Run:

```bash
git add frontend/src/components/project/agent-conversation-cards.tsx frontend/src/components/project/agent-sidebar.tsx frontend/src/components/project/agent-sidebar.test.tsx
git diff --cached --name-status
git commit -m "feat: render chat-first agent sidebar"
```

Expected staged files:

```text
A	frontend/src/components/project/agent-conversation-cards.tsx
A	frontend/src/components/project/agent-sidebar.test.tsx
M	frontend/src/components/project/agent-sidebar.tsx
```

## Task 4: Page State Integration

**Files:**
- Modify: `frontend/src/app/workspaces/[workspaceId]/page.tsx`
- Modify: `frontend/src/components/project/project-layout.tsx`
- Modify: `frontend/src/components/project/workspace-layout.tsx`
- Test: `frontend/src/components/project/agent-sidebar.test.tsx`

- [ ] **Step 1: Add page-level structured state**

In `frontend/src/app/workspaces/[workspaceId]/page.tsx`, update the type import:

```ts
  AgentArtifact,
  AgentConversation,
  AgentFlowResult,
  AgentSuggestion,
  ProjectState,
  WorkspaceState,
```

Replace:

```ts
  const [agentConversationSuggestions, setAgentConversationSuggestions] = useState<string[]>([]);
```

with:

```ts
  const [agentConversationSuggestions, setAgentConversationSuggestions] = useState<AgentSuggestion[]>([]);
  const [agentConversationArtifacts, setAgentConversationArtifacts] = useState<AgentArtifact[]>([]);
  const [pendingAgentInstruction, setPendingAgentInstruction] = useState<string | null>(null);
  const [agentConversationError, setAgentConversationError] = useState<string | null>(null);
```

- [ ] **Step 2: Reset structured state when switching project or workspace**

Where `setAgentConversationSuggestions([])` already exists, also add:

```ts
      setAgentConversationArtifacts([]);
      setPendingAgentInstruction(null);
      setAgentConversationError(null);
```

Use this in `handleSelectProject`, `handleShowWorkspace`, and the initial project load success path.

- [ ] **Step 3: Update `handleSendAgentMessage` to preserve a smooth pending/error state**

Replace `handleSendAgentMessage` with:

```ts
  const handleSendAgentMessage = async (content: string) => {
    if (!agentConversation) return;
    setPendingAgentConversation(true);
    setPendingAgentInstruction(content);
    setAgentConversationError(null);
    setActionError(null);
    setActionSuccess(null);
    try {
      const result = await sendAgentConversationMessage(agentConversation.id, content);
      setAgentConversation(result.conversation);
      setAgentConversationSuggestions(result.suggestions ?? []);
      setAgentConversationArtifacts(result.artifacts ?? []);
      setPendingAgentInstruction(null);
      await reloadProject();
      if (result.artifacts?.some((artifact) => artifact.status === "pending_confirmation")) {
        setActionSuccess(null);
      }
    } catch {
      setAgentConversationError("这次没有生成可用结果，我保留了你的请求。你可以重新发送或换一种说法。");
    } finally {
      setPendingAgentConversation(false);
    }
  };
```

- [ ] **Step 4: Add artifact confirmation handler**

Add this handler near `handleConfirmProposal`:

```ts
  const handleConfirmAgentArtifact = async (artifact: AgentArtifact) => {
    const proposalId = artifact.type === "proposal" ? artifact.linked_entity_ids[0] : null;
    if (!proposalId || !currentUserId) {
      setAgentConversationError("这条结果暂时不能直接确认，请在项目提案面板中查看。");
      return;
    }
    setAgentConversationError(null);
    try {
      await confirmAgentProposal(proposalId, currentUserId);
      setAgentConversationArtifacts((items) =>
        items.map((item) => item.id === artifact.id ? { ...item, status: "confirmed" } : item)
      );
      await reloadProject();
    } catch {
      setAgentConversationError("确认应用失败，请重试。");
    }
  };
```

- [ ] **Step 5: Pass new props through `WorkspaceLayout`**

In `frontend/src/app/workspaces/[workspaceId]/page.tsx`, pass:

```tsx
      agentConversationSuggestions={agentConversationSuggestions}
      agentConversationArtifacts={agentConversationArtifacts}
      pendingAgentInstruction={pendingAgentInstruction}
      agentConversationError={agentConversationError}
      onConfirmAgentArtifact={handleConfirmAgentArtifact}
```

In `frontend/src/components/project/workspace-layout.tsx`, add props to the type:

```ts
  agentConversationSuggestions?: AgentSuggestion[];
  agentConversationArtifacts?: AgentArtifact[];
  pendingAgentInstruction?: string | null;
  agentConversationError?: string | null;
  onConfirmAgentArtifact?: (artifact: AgentArtifact) => void | Promise<void>;
```

Import the types:

```ts
import type { AddResourceRequest, AgentArtifact, AgentConversation, AgentSuggestion, ProjectState, WorkspaceState } from "@/lib/types";
```

Pass them to `AgentSidebar`:

```tsx
        conversationSuggestions={agentConversationSuggestions}
        conversationArtifacts={agentConversationArtifacts}
        pendingConversationInstruction={pendingAgentInstruction}
        conversationError={agentConversationError}
        onConfirmArtifact={onConfirmAgentArtifact}
```

- [ ] **Step 6: Pass new props through `ProjectLayout`**

Apply the same prop additions to `frontend/src/components/project/project-layout.tsx` so any direct project layout usage compiles.

- [ ] **Step 7: Run frontend tests**

Run:

```bash
cd frontend
../scripts/npm run test -- src/components/project/agent-sidebar.test.tsx src/lib/api.test.ts
```

Expected: both test files pass.

- [ ] **Step 8: Commit Task 4**

Run:

```bash
git add 'frontend/src/app/workspaces/[workspaceId]/page.tsx' frontend/src/components/project/project-layout.tsx frontend/src/components/project/workspace-layout.tsx frontend/src/components/project/agent-sidebar.test.tsx
git diff --cached --name-status
git commit -m "feat: connect agent sidebar conversation state"
```

Expected staged files:

```text
M	frontend/src/app/workspaces/[workspaceId]/page.tsx
M	frontend/src/components/project/agent-sidebar.test.tsx
M	frontend/src/components/project/project-layout.tsx
M	frontend/src/components/project/workspace-layout.tsx
```

## Task 5: Chat-first Layout Polish

**Files:**
- Modify: `frontend/src/components/project/agent-sidebar.tsx`
- Modify: `frontend/src/components/project/agent-conversation-cards.tsx`
- Test: `frontend/src/components/project/agent-sidebar.test.tsx`

- [ ] **Step 1: Add keyboard behavior test**

Add this test to `frontend/src/components/project/agent-sidebar.test.tsx`:

```tsx
  it("sends composer text with Enter and keeps Shift Enter for multiline input", () => {
    const onSendMessage = vi.fn();
    render(
      <AgentSidebar
        state={baseState}
        conversation={conversation}
        conversationSuggestions={suggestions}
        onRunAgent={vi.fn()}
        onSendMessage={onSendMessage}
      />
    );

    const input = screen.getByPlaceholderText("告诉 Agent 你的具体要求...");
    fireEvent.change(input, { target: { value: "分析当前风险" } });
    fireEvent.keyDown(input, { key: "Enter", shiftKey: false });

    expect(onSendMessage).toHaveBeenCalledWith("分析当前风险");
  });
```

- [ ] **Step 2: Run the test and verify it fails**

Run:

```bash
cd frontend
../scripts/npm run test -- src/components/project/agent-sidebar.test.tsx
```

Expected: fail because the textarea does not submit on Enter.

- [ ] **Step 3: Add textarea keyboard behavior**

In `frontend/src/components/project/agent-sidebar.tsx`, add this handler near `handleSubmit`:

```tsx
  const handleComposerKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || event.shiftKey) return;
    event.preventDefault();
    void submitMessage(draft);
  };
```

Update the textarea:

```tsx
                        onKeyDown={handleComposerKeyDown}
```

Update the React import:

```tsx
import type { ElementType, FormEvent, KeyboardEvent } from "react";
```

- [ ] **Step 4: Move recent activity below a collapsed disclosure**

In `frontend/src/components/project/agent-sidebar.tsx`, replace the visible recent activity block heading with a collapsed button:

```tsx
              {recentEvents.length > 0 && (
                <div className="mb-4 border-t border-neutral-100 pt-3">
                  <button
                    type="button"
                    onClick={() => setActivityOpen((open) => !open)}
                    className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-xs font-semibold text-neutral-500 transition hover:bg-neutral-50 hover:text-neutral-700"
                  >
                    <span className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5" />
                      最近活动
                    </span>
                    <ChevronRight className={cn("h-3 w-3 transition-transform", activityOpen && "rotate-90")} />
                  </button>
                  <AnimatePresence>
                    {activityOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="mt-2 space-y-2">
                          {recentEvents.map((event) => {
                            const Icon = getEventIcon(event.event_type);
                            return (
                              <div key={event.id} className="flex items-start gap-2 text-xs">
                                <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-neutral-400" />
                                <div className="min-w-0">
                                  <p className="text-neutral-700">
                                    <span>{getEventLabel(event.event_type)}</span>
                                  </p>
                                  <p className="mt-0.5 flex items-center gap-1 text-neutral-400">
                                    <Clock className="h-3 w-3" />
                                    {formatTimeAgo(event.created_at)}
                                  </p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
```

Add state near `advancedOpen`:

```tsx
  const [activityOpen, setActivityOpen] = useState(false);
```

- [ ] **Step 5: Make collapsed mode Chat-first instead of action-button-first**

In collapsed mode, replace the action icon list with one Agent button and a pending badge:

```tsx
        {!isExpanded && hasProject && (
          <div className="flex flex-col items-center gap-2 py-3">
            <button
              type="button"
              onClick={toggle}
              className="relative flex h-8 w-8 items-center justify-center rounded-lg text-moss transition hover:bg-moss/10 focus:outline-none focus:ring-2 focus:ring-moss/30"
              title="打开 Agent 对话"
            >
              <MessageSquare className="h-4 w-4" />
              {pendingProposalCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-moss px-1 text-[9px] font-semibold text-white">
                  {pendingProposalCount}
                </span>
              )}
            </button>
          </div>
        )}
```

- [ ] **Step 6: Run the sidebar test**

Run:

```bash
cd frontend
../scripts/npm run test -- src/components/project/agent-sidebar.test.tsx
```

Expected: `agent-sidebar.test.tsx` passes.

- [ ] **Step 7: Commit Task 5**

Run:

```bash
git add frontend/src/components/project/agent-sidebar.tsx frontend/src/components/project/agent-conversation-cards.tsx frontend/src/components/project/agent-sidebar.test.tsx
git diff --cached --name-status
git commit -m "feat: polish guided agent conversation flow"
```

Expected staged files:

```text
M	frontend/src/components/project/agent-conversation-cards.tsx
M	frontend/src/components/project/agent-sidebar.test.tsx
M	frontend/src/components/project/agent-sidebar.tsx
```

## Task 6: End-to-End Verification and Browser Smoke

**Files:**
- No planned source edits.
- Use local browser against `http://localhost:3000/workspaces/demo-workspace-001?project=demo-project-001`.

- [ ] **Step 1: Run backend conversation tests**

Run:

```bash
cd backend
/Users/robertwu/.codex/scripts/rtk .venv/bin/python -m pytest app/tests/test_agent_conversation_flow.py -q
```

Expected: all tests pass.

- [ ] **Step 2: Run full backend test suite**

Run:

```bash
cd backend
/Users/robertwu/.codex/scripts/rtk .venv/bin/python -m pytest app/tests -q
```

Expected: all backend tests pass.

- [ ] **Step 3: Run frontend tests**

Run:

```bash
cd frontend
../scripts/npm run test
```

Expected: all frontend tests pass.

- [ ] **Step 4: Run frontend lint and build**

Run:

```bash
cd frontend
../scripts/npm run lint
../scripts/npm run build
```

Expected: lint exits 0 and build succeeds.

- [ ] **Step 5: Start or reuse local servers**

If backend is not listening on port 8000:

```bash
cd backend
.venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

If frontend is not listening on port 3000:

```bash
cd frontend
../scripts/npm run dev
```

Expected:

- Backend responds at `http://127.0.0.1:8000/api/projects/demo-project-001/agent-conversation`.
- Frontend opens at `http://localhost:3000/workspaces/demo-workspace-001?project=demo-project-001`.

- [ ] **Step 6: Browser smoke check**

Open:

```text
http://localhost:3000/workspaces/demo-workspace-001?project=demo-project-001
```

Verify:

- Right sidebar header is compact.
- Current focus appears as a conversation context card.
- Suggestions look like quick replies.
- Clicking “根据签到调整计划” inserts that text as a user message immediately.
- While pending, “Agent 正在处理” appears with short steps.
- The result appears in the conversation, and proposal artifacts show `确认应用`, `继续修改`, `查看影响`.
- The main `Agent 提案` panel and right-side artifact agree on pending/confirmed state after confirmation.
- Recent activity is collapsed by default.
- Advanced operations are collapsed by default.

- [ ] **Step 7: Final diff check**

Run:

```bash
git status --short
git diff --check
```

Expected:

- `git diff --check` prints nothing.
- Only intentional source and test files are modified.

- [ ] **Step 8: Commit verification polish if source changed during Task 6**

Task 6 has no planned source edits. If browser verification reveals a source issue, return to the task that owns that file, apply the same test-first loop, and commit with that task's commit command. If the fix touches only final polish in already implemented files, use this explicit staging set:

```bash
git add backend/app/schemas/agent_conversation.py backend/app/services/agent_conversation_service.py backend/app/tests/test_agent_conversation_flow.py frontend/src/lib/types.ts frontend/src/lib/api.ts frontend/src/lib/api.test.ts frontend/src/components/project/agent-conversation-cards.tsx frontend/src/components/project/agent-sidebar.tsx frontend/src/components/project/agent-sidebar.test.tsx 'frontend/src/app/workspaces/[workspaceId]/page.tsx' frontend/src/components/project/project-layout.tsx frontend/src/components/project/workspace-layout.tsx
git diff --cached --name-status
git commit -m "fix: finalize agent sidebar chat-first flow"
```

Expected: this commit contains only verification fixes made during Task 6.

## Rollback Notes

- Backend schema changes are additive: remove `suggestions` and `artifacts` fields from `AgentConversationTurnRead` and remove the builder helpers to return to the previous contract.
- Frontend API changes are additive: keep legacy `next_suggestions` until all call sites consume structured suggestions.
- UI refactor is contained to `frontend/src/components/project/agent-sidebar.tsx` and `frontend/src/components/project/agent-conversation-cards.tsx`.
- If artifact confirmation causes regressions, disable only `onConfirmArtifact` wiring and keep read-only artifact cards visible.

## Final Acceptance Criteria

- A user can click “根据签到调整计划” in the right sidebar and see a user message immediately.
- Pending state shows `Agent 正在处理` and short non-technical steps.
- Backend still receives natural-language `content`; frontend does not route intent by button label.
- Conversation turn returns structured `suggestions` and `artifacts`.
- Proposal artifact appears in the conversation with reason, impact, and confirmation actions.
- Confirming a proposal from the artifact updates project state and the main proposal panel.
- Conversation history is not truncated to the last 6 messages.
- Internal wording such as `Planner 输出不可用` is never shown to the user.
- Backend tests, frontend tests, lint, build, and browser smoke checks pass.
