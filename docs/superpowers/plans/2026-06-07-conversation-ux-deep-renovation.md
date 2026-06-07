# Agent 对话交互全栈深度改造 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the Agent sidebar from synchronous request + plain text to SSE streaming + rich message components + real-time agent step visualization.

**Architecture:** Backend adds `stream_complete()` to LLMClient and a new SSE endpoint. Frontend consumes SSE via `fetch + ReadableStream`, renders messages with dedicated components, and shows real-time agent execution progress.

**Tech Stack:** Python (FastAPI, SSE), TypeScript (React, Next.js), react-markdown, remark-gfm

---

## File Map

### Backend (create/modify)

| File | Action | Responsibility |
|---|---|---|
| `backend/app/agent/llm_client.py` | Modify | Add `stream_complete()` to protocol + implementations |
| `backend/app/services/agent_conversation_service.py` | Modify | Add `process_conversation_message_stream()` generator |
| `backend/app/api/routes_agent_conversations.py` | Modify | Add `/messages/stream` SSE endpoint |
| `backend/app/tests/test_agent_stream.py` | Create | Tests for streaming LLM client + service |

### Frontend (create/modify)

| File | Action | Responsibility |
|---|---|---|
| `frontend/src/lib/types.ts` | Modify | Add SSE event types |
| `frontend/src/lib/api.ts` | Modify | Add `sendAgentConversationMessageStream()` |
| `frontend/src/components/project/agent/useAgentStream.ts` | Create | SSE consumption hook |
| `frontend/src/components/project/agent/ChatMessage.tsx` | Create | Message bubble (user/assistant roles) |
| `frontend/src/components/project/agent/MarkdownContent.tsx` | Create | Markdown renderer for assistant messages |
| `frontend/src/components/project/agent/StreamingText.tsx` | Create | Streaming text + cursor |
| `frontend/src/components/project/agent/AgentStepIndicator.tsx` | Create | Real-time agent execution steps |
| `frontend/src/components/project/agent/ModuleRunCard.tsx` | Create | Collapsible module execution card |
| `frontend/src/components/project/agent/ChatComposer.tsx` | Create | Enhanced input area |
| `frontend/src/components/project/agent/StarterPrompts.tsx` | Create | Empty state prompt cards |
| `frontend/src/components/project/agent/MessageActions.tsx` | Create | Copy/retry/task-ify actions |
| `frontend/src/components/project/agent-sidebar.tsx` | Modify | Refactor to use new components |
| `frontend/src/components/project/agent-conversation-cards.tsx` | Modify | Deprecate AgentRunStatusCard |
| `frontend/src/app/workspaces/[workspaceId]/page.tsx` | Modify | Wire streaming into handleSendAgentMessage |

---

## Task 1: Backend — LLMClient.stream_complete()

**Files:**
- Modify: `backend/app/agent/llm_client.py`
- Create: `backend/app/tests/test_agent_stream.py`

### Step 1: Add stream_complete to LLMClient protocol

In `backend/app/agent/llm_client.py`, add to the `LLMClient` protocol:

```python
from collections.abc import Iterator

class LLMClient(Protocol):
    def complete(self, messages: list[dict[str, str]], *, max_tokens: int | None = None) -> str:
        """Return the assistant message content."""

    def stream_complete(
        self, messages: list[dict[str, str]], *, max_tokens: int | None = None
    ) -> Iterator[str]:
        """Yield content tokens incrementally."""
        ...  # pragma: no cover
```

### Step 2: Implement MockLLMClient.stream_complete()

Add to `MockLLMClient`:

```python
import time

class MockLLMClient:
    # ... existing code ...

    def stream_complete(self, messages: list[dict[str, str]], *, max_tokens: int | None = None) -> Iterator[str]:
        content = self.complete(messages, max_tokens=max_tokens)
        for char in content:
            yield char
            time.sleep(0.01)
```

### Step 3: Implement OpenAICompatibleLLMClient.stream_complete()

Add to `OpenAICompatibleLLMClient`:

```python
class OpenAICompatibleLLMClient:
    # ... existing code ...

    def stream_complete(self, messages: list[dict[str, str]], *, max_tokens: int | None = None) -> Iterator[str]:
        body = json.dumps(
            {
                "model": self.model,
                "messages": messages,
                "temperature": 0.05,
                "max_tokens": max_tokens or 1800,
                "stream": True,
            }
        ).encode("utf-8")
        req = request.Request(
            f"{self.base_url}/chat/completions",
            data=body,
            method="POST",
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
            },
        )
        try:
            with request.urlopen(req, timeout=self.timeout_seconds) as response:
                for line in response:
                    line = line.decode("utf-8").strip()
                    if not line or not line.startswith("data: "):
                        continue
                    data = line[6:]
                    if data == "[DONE]":
                        break
                    try:
                        chunk = json.loads(data)
                        delta = chunk.get("choices", [{}])[0].get("delta", {})
                        content = delta.get("content")
                        if content:
                            yield content
                    except (json.JSONDecodeError, IndexError, KeyError):
                        continue
        except (urllib_error.HTTPError, urllib_error.URLError, TimeoutError) as exc:
            # Fall back to non-streaming on error
            yield self.complete(messages, max_tokens=max_tokens)
```

### Step 4: Write tests

Create `backend/app/tests/test_agent_stream.py`:

```python
import pytest
from app.agent.llm_client import MockLLMClient


def test_mock_stream_complete_yields_characters():
    client = MockLLMClient(responses=["Hello"])
    tokens = list(client.stream_complete([{"role": "user", "content": "hi"}]))
    assert tokens == ["H", "e", "l", "l", "o"]


def test_mock_stream_complete_empty_response():
    client = MockLLMClient(responses=["{}"])
    tokens = list(client.stream_complete([{"role": "user", "content": "hi"}]))
    assert tokens == ["{", "}"]


def test_mock_stream_complete_multiple_calls():
    client = MockLLMClient(responses=["AB", "CD"])
    first = list(client.stream_complete([{"role": "user", "content": "a"}]))
    second = list(client.stream_complete([{"role": "user", "content": "b"}]))
    assert first == ["A", "B"]
    assert second == ["C", "D"]
```

### Step 5: Run tests

```bash
cd backend && .venv/bin/python -m pytest app/tests/test_agent_stream.py -v
```

Expected: 3 passed.

### Step 6: Commit

```bash
git add backend/app/agent/llm_client.py backend/app/tests/test_agent_stream.py
git commit -m "feat(agent): add stream_complete() to LLMClient protocol and implementations"
```

---

## Task 2: Backend — SSE Endpoint

**Files:**
- Modify: `backend/app/services/agent_conversation_service.py`
- Modify: `backend/app/api/routes_agent_conversations.py`
- Modify: `backend/app/tests/test_agent_stream.py`

### Step 1: Add process_conversation_message_stream()

Add to `backend/app/services/agent_conversation_service.py`:

```python
import time
from collections.abc import Iterator
from typing import Any


def _sse_event(event: str, data: dict[str, Any]) -> str:
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


MODULE_STATUS_MESSAGES: dict[str, str] = {
    "clarify": "正在澄清项目方向",
    "plan": "正在生成阶段计划",
    "breakdown": "正在拆解任务",
    "assign": "正在推荐分工",
    "push": "正在生成行动卡",
    "checkin": "正在分析签到状态",
    "risk": "正在分析风险",
    "replan": "正在调整计划",
}


def process_conversation_message_stream(
    session: Session,
    conversation_id: str,
    content: str,
    *,
    llm_client: LLMClient | None = None,
) -> Iterator[str]:
    """Yield SSE event strings for a conversation turn."""
    conversation = session.get(AgentConversation, conversation_id)
    if conversation is None:
        yield _sse_event("error", {"message": "对话不存在"})
        return
    project = session.get(Project, conversation.project_id)
    if project is None:
        yield _sse_event("error", {"message": "项目不存在"})
        return

    llm = llm_client or build_agent_llm_client()
    workspace_state = get_workspace_state(
        session,
        conversation.workspace_id,
        project_id=conversation.project_id,
    )
    if workspace_state is None or workspace_state.project is None:
        yield _sse_event("error", {"message": "工作区状态不存在"})
        return

    # Save user message
    user_message = AgentMessage(
        conversation_id=conversation.id,
        role="user",
        content=content,
    )
    session.add(user_message)
    session.flush()

    # Phase: planning
    yield _sse_event("status", {"phase": "planning", "message": "正在理解你的需求..."})

    turn_plan = _plan_turn(
        llm,
        content=content,
        conversation=conversation,
        workspace_state=workspace_state,
        recent_messages=_recent_messages(session, conversation.id),
    )

    blocked_reason = _policy_block_reason(turn_plan, workspace_state)
    run_read: AgentRunRead | None = None
    linked_event_id: str | None = None
    linked_proposal_id: str | None = None
    artifacts: list[AgentArtifactRead] = []

    if blocked_reason:
        yield _sse_event("status", {"phase": "answering", "message": "正在整理回复..."})
        assistant_content = blocked_reason
    elif turn_plan.response_type in {"answer", "ask_clarifying_question"} or not turn_plan.selected_module:
        yield _sse_event("status", {"phase": "answering", "message": "正在整理回复..."})
        assistant_content = _answer_content(turn_plan, workspace_state)
    else:
        module = turn_plan.selected_module
        status_msg = MODULE_STATUS_MESSAGES.get(module, f"正在执行 {module}")
        yield _sse_event("status", {"phase": "executing", "module": module, "message": status_msg})

        flow_result = _run_selected_module(
            session,
            conversation.workspace_id,
            conversation.project_id,
            turn_plan,
            llm,
        )
        event_type = MODULE_EVENT_TYPE[module]
        linked_event_id = _latest_agent_event_id(
            session,
            conversation.project_id,
            conversation.workspace_id,
            event_type,
        )
        linked_proposal_id = flow_result.proposal_id
        run = AgentRun(
            conversation_id=conversation.id,
            project_id=conversation.project_id,
            user_instruction=turn_plan.user_instruction or content,
            selected_module=module,
            status="proposal_created" if flow_result.proposal_id else "completed",
            model=_client_model(llm),
            attempts=flow_result.attempts,
            verifier_status="passed",
            agent_event_id=linked_event_id,
            proposal_id=flow_result.proposal_id,
            completed_at=datetime.now(UTC),
        )
        session.add(run)
        session.flush()
        run_read = _run_to_read(run)
        assistant_content = _success_content(turn_plan, flow_result.proposal_id)
        artifacts = _artifacts_from_flow_result(session, flow_result, turn_plan)

        yield _sse_event("status", {"phase": "generating", "message": "正在整理结果..."})

    # Phase: stream the final reply
    yield _sse_event("status", {"phase": "streaming", "message": "正在生成回复..."})

    # Stream the pre-generated assistant content character by character
    for char in assistant_content:
        yield _sse_event("token", {"content": char})
        time.sleep(0.005)

    full_response = assistant_content

    # Save assistant message
    next_labels = _next_suggestions(workspace_state)
    suggestions = _structured_suggestions(next_labels)

    assistant_message = AgentMessage(
        conversation_id=conversation.id,
        role="assistant",
        content=full_response,
        linked_event_id=linked_event_id,
        linked_proposal_id=linked_proposal_id,
    )
    assistant_message.set_structured_payload(
        {
            "turn_plan": turn_plan.model_dump(mode="json"),
            "blocked_reason": blocked_reason,
            "next_suggestions": next_labels,
            "suggestions": [s.model_dump(mode="json") for s in suggestions],
            "artifacts": [a.model_dump(mode="json") for a in artifacts],
        }
    )
    session.add(assistant_message)

    conversation.current_focus = _focus_for_workspace_state(workspace_state)
    conversation.updated_at = datetime.now(UTC)
    session.add(conversation)
    session.commit()
    session.refresh(user_message)
    session.refresh(assistant_message)

    # Done event with full turn data
    turn = AgentConversationTurnRead(
        conversation=_conversation_to_read(session, conversation),
        user_message=_message_to_read(user_message),
        assistant_message=_message_to_read(assistant_message),
        run=run_read,
        turn_plan=turn_plan,
        next_suggestions=next_labels,
        suggestions=suggestions,
        artifacts=artifacts,
    )
    yield _sse_event("done", turn.model_dump(mode="json"))
```

### Step 2: Add the SSE endpoint

In `backend/app/api/routes_agent_conversations.py`, add:

```python
from fastapi.responses import StreamingResponse
from app.services.agent_conversation_service import process_conversation_message_stream


@router.post("/agent/conversations/{conversation_id}/messages/stream")
def api_send_agent_conversation_message_stream(
    conversation_id: str,
    data: AgentConversationMessageCreate,
    session: Session = Depends(get_session),
):
    try:
        return StreamingResponse(
            process_conversation_message_stream(session, conversation_id, data.content),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
```

### Step 3: Write tests for the stream service

Add to `backend/app/tests/test_agent_stream.py`:

```python
import json
import pytest
from unittest.mock import MagicMock, patch
from app.agent.llm_client import MockLLMClient


def test_sse_event_format():
    from app.services.agent_conversation_service import _sse_event
    result = _sse_event("status", {"phase": "planning", "message": "test"})
    assert result == 'event: status\ndata: {"phase": "planning", "message": "test"}\n\n'


def test_process_stream_yields_status_events():
    """Test that stream yields status, token, and done events."""
    from app.services.agent_conversation_service import process_conversation_message_stream

    mock_session = MagicMock()
    mock_conversation = MagicMock()
    mock_conversation.id = "conv-1"
    mock_conversation.workspace_id = "ws-1"
    mock_conversation.project_id = "proj-1"
    mock_session.get.return_value = mock_conversation

    mock_project = MagicMock()
    mock_project.direction_card = {"problem": "test"}
    mock_project.stages = []
    mock_project.tasks = []
    mock_project.assignment_proposals = []
    mock_session.get.side_effect = lambda model, id: {
        "AgentConversation": mock_conversation,
        "Project": mock_project,
    }.get(model.__name__ if hasattr(model, "__name__") else str(model), MagicMock())

    llm = MockLLMClient(responses=['{"response_type": "answer", "rationale": "test answer"}'])

    with patch("app.services.agent_conversation_service.get_workspace_state") as mock_ws:
        mock_ws.return_value = MagicMock(project=mock_project)
        with patch("app.services.agent_conversation_service._recent_messages", return_value=[]):
            events = list(process_conversation_message_stream(
                mock_session, "conv-1", "hello", llm_client=llm
            ))

    event_types = []
    for evt in events:
        lines = evt.strip().split("\n")
        for line in lines:
            if line.startswith("event: "):
                event_types.append(line[7:])

    assert "status" in event_types
    assert "token" in event_types or "done" in event_types
```

### Step 4: Run tests

```bash
cd backend && .venv/bin/python -m pytest app/tests/test_agent_stream.py -v
```

### Step 5: Commit

```bash
git add backend/app/services/agent_conversation_service.py backend/app/api/routes_agent_conversations.py backend/app/tests/test_agent_stream.py
git commit -m "feat(agent): add SSE streaming endpoint for conversation messages"
```

---

## Task 3: Frontend — Types & API & Dependencies

**Files:**
- Modify: `frontend/src/lib/types.ts`
- Modify: `frontend/src/lib/api.ts`

### Step 1: Add SSE event types

Append to `frontend/src/lib/types.ts`:

```typescript
// --- SSE Streaming Events ---

export type AgentStreamPhase = "planning" | "executing" | "generating" | "streaming" | "answering";

export type AgentStreamStatusEvent = {
  event: "status";
  data: { phase: AgentStreamPhase; module?: string; message: string };
};

export type AgentStreamTokenEvent = {
  event: "token";
  data: { content: string };
};

export type AgentStreamDoneEvent = {
  event: "done";
  data: AgentConversationTurn;
};

export type AgentStreamErrorEvent = {
  event: "error";
  data: { message: string };
};

export type AgentStreamEvent =
  | AgentStreamStatusEvent
  | AgentStreamTokenEvent
  | AgentStreamDoneEvent
  | AgentStreamErrorEvent;
```

### Step 2: Add sendAgentConversationMessageStream()

Add to `frontend/src/lib/api.ts` (after the existing `sendAgentConversationMessage`):

```typescript
export type AgentStreamCallbacks = {
  onStatus: (status: { phase: string; module?: string; message: string }) => void;
  onToken: (token: string) => void;
  onDone: (turn: AgentConversationTurn) => void;
  onError: (error: string) => void;
};

export async function sendAgentConversationMessageStream(
  conversationId: string,
  content: string,
  callbacks: AgentStreamCallbacks,
  signal?: AbortSignal,
): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/agent/conversations/${conversationId}/messages/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
    signal,
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`请求失败：${response.status} ${body}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error("无法读取响应流");

  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      let currentEvent = "";
      for (const line of lines) {
        if (line.startsWith("event: ")) {
          currentEvent = line.slice(7).trim();
        } else if (line.startsWith("data: ")) {
          const dataStr = line.slice(6);
          try {
            const data = JSON.parse(dataStr);
            switch (currentEvent) {
              case "status":
                callbacks.onStatus(data);
                break;
              case "token":
                callbacks.onToken(data.content);
                break;
              case "done":
                callbacks.onDone(normalizeAgentConversationTurn(data));
                break;
              case "error":
                callbacks.onError(data.message);
                break;
            }
          } catch {
            // skip malformed JSON
          }
          currentEvent = "";
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
```

### Step 3: Install dependencies

```bash
cd frontend && npm install react-markdown remark-gfm
```

### Step 4: Commit

```bash
git add frontend/src/lib/types.ts frontend/src/lib/api.ts frontend/package.json frontend/package-lock.json
git commit -m "feat(agent): add SSE streaming types, API function, and markdown deps"
```

---

## Task 4: Frontend — useAgentStream Hook

**Files:**
- Create: `frontend/src/components/project/agent/useAgentStream.ts`

### Step 1: Create the hook

```typescript
"use client";

import { useCallback, useRef, useState } from "react";
import type { AgentConversationTurn, AgentStreamPhase } from "@/lib/types";
import { sendAgentConversationMessageStream } from "@/lib/api";

export type AgentStreamStatus = {
  phase: AgentStreamPhase;
  module?: string;
  message: string;
};

type UseAgentStreamOptions = {
  onDone: (turn: AgentConversationTurn) => void;
  onError: (error: string) => void;
};

export function useAgentStream({ onDone, onError }: UseAgentStreamOptions) {
  const [streamingBuffer, setStreamingBuffer] = useState("");
  const [streamStatus, setStreamStatus] = useState<AgentStreamStatus | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(
    async (conversationId: string, content: string) => {
      abortRef.current = new AbortController();
      setIsStreaming(true);
      setStreamingBuffer("");
      setStreamStatus({ phase: "planning", message: "正在理解你的需求..." });

      try {
        await sendAgentConversationMessageStream(
          conversationId,
          content,
          {
            onStatus: (status) => setStreamStatus(status),
            onToken: (token) => setStreamingBuffer((prev) => prev + token),
            onDone: (turn) => {
              setStreamingBuffer("");
              setStreamStatus(null);
              onDone(turn);
            },
            onError: (msg) => {
              setStreamingBuffer("");
              setStreamStatus(null);
              onError(msg);
            },
          },
          abortRef.current.signal,
        );
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          // User stopped — keep partial buffer as-is
          setStreamStatus(null);
        } else {
          setStreamingBuffer("");
          setStreamStatus(null);
          onError(err instanceof Error ? err.message : "连接中断");
        }
      } finally {
        setIsStreaming(false);
        abortRef.current = null;
      }
    },
    [onDone, onError],
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return { sendMessage, stop, streamingBuffer, streamStatus, isStreaming };
}
```

### Step 2: Commit

```bash
git add frontend/src/components/project/agent/useAgentStream.ts
git commit -m "feat(agent): add useAgentStream hook for SSE consumption"
```

---

## Task 5: Frontend — Message Components

**Files:**
- Create: `frontend/src/components/project/agent/ChatMessage.tsx`
- Create: `frontend/src/components/project/agent/MarkdownContent.tsx`
- Create: `frontend/src/components/project/agent/StreamingText.tsx`

### Step 1: Create MarkdownContent

```tsx
"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface MarkdownContentProps {
  content: string;
  className?: string;
}

export function MarkdownContent({ content, className }: MarkdownContentProps) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      className={className}
      components={{
        ol: ({ children, ...props }) => (
          <ol className="list-decimal pl-4 space-y-0.5" {...props}>{children}</ol>
        ),
        ul: ({ children, ...props }) => (
          <ul className="list-disc pl-4 space-y-0.5" {...props}>{children}</ul>
        ),
        li: ({ children, ...props }) => (
          <li className="text-xs leading-5" {...props}>{children}</li>
        ),
        p: ({ children, ...props }) => (
          <p className="text-xs leading-5" {...props}>{children}</p>
        ),
        strong: ({ children, ...props }) => (
          <strong className="font-semibold" {...props}>{children}</strong>
        ),
        code: ({ children, className, ...props }) => {
          const isInline = !className;
          if (isInline) {
            return <code className="rounded bg-neutral-100 px-1 py-0.5 text-[11px]" {...props}>{children}</code>;
          }
          return (
            <pre className="my-1 overflow-x-auto rounded bg-neutral-100 p-2">
              <code className="text-[11px]" {...props}>{children}</code>
            </pre>
          );
        },
        table: ({ children, ...props }) => (
          <div className="my-1 overflow-x-auto">
            <table className="text-xs" {...props}>{children}</table>
          </div>
        ),
        th: ({ children, ...props }) => (
          <th className="border-b border-neutral-200 px-2 py-1 text-left font-semibold" {...props}>{children}</th>
        ),
        td: ({ children, ...props }) => (
          <td className="border-b border-neutral-100 px-2 py-1" {...props}>{children}</td>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
```

### Step 2: Create StreamingText

```tsx
"use client";

import { MarkdownContent } from "./MarkdownContent";

interface StreamingTextProps {
  buffer: string;
  className?: string;
}

export function StreamingText({ buffer, className }: StreamingTextProps) {
  if (!buffer) return null;

  return (
    <div className={className}>
      <MarkdownContent content={buffer} />
      <span className="ml-0.5 inline-block h-3 w-px animate-pulse bg-moss" />
    </div>
  );
}
```

### Step 3: Create ChatMessage

```tsx
"use client";

import { cn } from "@/lib/utils";
import type { AgentConversationMessage } from "@/lib/types";
import { MarkdownContent } from "./MarkdownContent";
import { MessageActions } from "./MessageActions";

interface ChatMessageProps {
  message: AgentConversationMessage;
  isLast?: boolean;
  onRetry?: () => void;
  onAction?: (instruction: string) => void;
}

// Map verbose quick-reply instructions back to short labels
const QUICK_REPLY_DISPLAY_MAP: Record<string, string> = {
  "请执行 push 模块：生成下一步行动卡。用户点击了快捷回复「生成下一步行动卡」，请直接运行 push 模块生成行动卡。": "生成下一步行动卡",
  "请执行 risk 模块：分析当前风险。用户点击了快捷回复「分析当前风险」，请直接运行 risk 模块进行风险分析。": "分析当前风险",
  "请执行 replan 模块：根据签到结果调整项目计划。用户点击了快捷回复「根据签到调整计划」，请直接运行 replan 模块生成计划调整草案。": "根据签到调整计划",
  "请执行 assign 模块：根据成员情况推荐分工。用户点击了快捷回复「根据成员情况推荐分工」，请直接运行 assign 模块。": "根据成员情况推荐分工",
  "请执行 breakdown 模块：把当前阶段拆成可执行任务。用户点击了快捷回复「把当前阶段拆成任务」，请直接运行 breakdown 模块。": "把当前阶段拆成任务",
  "请执行 plan 模块：按三周节奏生成阶段计划。用户点击了快捷回复「按三周节奏生成阶段计划」，请直接运行 plan 模块。": "按三周节奏生成阶段计划",
  "请执行 clarify 模块：澄清项目方向。用户点击了快捷回复「先帮我澄清方向」，请直接运行 clarify 模块。": "先帮我澄清方向",
};

function displayContent(message: AgentConversationMessage): string {
  if (message.role === "user") {
    return QUICK_REPLY_DISPLAY_MAP[message.content] ?? message.content;
  }
  return message.content;
}

export function ChatMessage({ message, isLast, onRetry, onAction }: ChatMessageProps) {
  const isUser = message.role === "user";

  return (
    <div
      className={cn(
        "rounded-lg border p-3",
        isUser
          ? "ml-8 border-neutral-200 bg-white text-neutral-700"
          : "mr-0 border-moss/20 bg-moss/5 text-neutral-700",
      )}
    >
      <div className="mb-1 text-[10px] font-semibold text-neutral-400">
        {isUser ? "你" : "Agent"}
      </div>
      {isUser ? (
        <p className="text-xs leading-5">{displayContent(message)}</p>
      ) : (
        <MarkdownContent content={message.content} />
      )}
      {!isUser && isLast && (
        <MessageActions
          message={message}
          onCopy={() => navigator.clipboard.writeText(message.content)}
          onRetry={onRetry}
          onAction={onAction}
        />
      )}
    </div>
  );
}
```

### Step 4: Commit

```bash
git add frontend/src/components/project/agent/ChatMessage.tsx frontend/src/components/project/agent/MarkdownContent.tsx frontend/src/components/project/agent/StreamingText.tsx
git commit -m "feat(agent): add ChatMessage, MarkdownContent, StreamingText components"
```

---

## Task 6: Frontend — Agent Status Components

**Files:**
- Create: `frontend/src/components/project/agent/AgentStepIndicator.tsx`
- Create: `frontend/src/components/project/agent/ModuleRunCard.tsx`

### Step 1: Create AgentStepIndicator

```tsx
"use client";

import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, Loader2, Circle } from "lucide-react";
import type { AgentStreamStatus } from "./useAgentStream";

interface AgentStepIndicatorProps {
  status: AgentStreamStatus | null;
}

const PHASE_LABELS: Record<string, string> = {
  planning: "理解你的需求",
  executing: "执行任务模块",
  generating: "整理执行结果",
  streaming: "生成回复",
  answering: "整理回复",
};

function getSteps(status: AgentStreamStatus | null) {
  const allPhases = ["planning", "executing", "generating", "streaming"] as const;
  const currentIdx = status ? allPhases.indexOf(status.phase as (typeof allPhases)[number]) : -1;

  return allPhases.map((phase, idx) => {
    let state: "done" | "active" | "pending" = "pending";
    if (idx < currentIdx) state = "done";
    else if (idx === currentIdx) state = "active";

    let label = PHASE_LABELS[phase] ?? phase;
    if (phase === "executing" && status?.module && state === "active") {
      label = `正在${PHASE_LABELS.executing}`;
    }

    return { phase, label, state };
  });
}

export function AgentStepIndicator({ status }: AgentStepIndicatorProps) {
  if (!status) return null;

  const steps = getSteps(status);
  const statusMessage = status.message;

  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      className="mb-3 rounded-lg border border-moss/20 bg-moss/5 p-3"
    >
      <div className="flex items-center gap-1.5 text-xs font-semibold text-moss">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Agent 正在处理
      </div>
      <ul className="mt-2 space-y-1">
        <AnimatePresence>
          {steps.map((step) => (
            <motion.li
              key={step.phase}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-1.5 text-xs"
            >
              {step.state === "done" ? (
                <CheckCircle2 className="h-3 w-3 shrink-0 text-moss" />
              ) : step.state === "active" ? (
                <Loader2 className="h-3 w-3 shrink-0 animate-spin text-moss" />
              ) : (
                <Circle className="h-3 w-3 shrink-0 text-neutral-300" />
              )}
              <span className={step.state === "active" ? "text-neutral-700 font-medium" : "text-neutral-400"}>
                {step.label}
              </span>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
      {statusMessage && (
        <p className="mt-1.5 text-[11px] text-neutral-500">{statusMessage}</p>
      )}
    </motion.div>
  );
}
```

### Step 2: Create ModuleRunCard

```tsx
"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ChevronRight, Loader2, CheckCircle2, Cpu } from "lucide-react";
import { cn } from "@/lib/utils";

interface ModuleRunCardProps {
  module: string;
  status: "running" | "completed" | "failed";
  message?: string;
  elapsed?: number;
}

const MODULE_LABELS: Record<string, string> = {
  clarify: "方向澄清",
  plan: "阶段计划",
  breakdown: "任务拆解",
  assign: "分工推荐",
  push: "主动推进",
  checkin: "签到分析",
  risk: "风险分析",
  replan: "计划调整",
};

export function ModuleRunCard({ module, status, message, elapsed }: ModuleRunCardProps) {
  const [expanded, setExpanded] = useState(status === "running");
  const label = MODULE_LABELS[module] ?? module;

  return (
    <div className="mb-2 rounded-lg border border-neutral-200 bg-white">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between px-3 py-2 text-xs"
      >
        <div className="flex items-center gap-1.5">
          <Cpu className="h-3.5 w-3.5 text-neutral-400" />
          <span className="font-medium text-neutral-700">{label}</span>
          {status === "running" && <Loader2 className="h-3 w-3 animate-spin text-moss" />}
          {status === "completed" && <CheckCircle2 className="h-3 w-3 text-moss" />}
          {status === "failed" && <span className="text-coral text-[10px]">失败</span>}
        </div>
        <div className="flex items-center gap-1.5">
          {elapsed != null && (
            <span className="text-[10px] text-neutral-400">{elapsed}s</span>
          )}
          <ChevronRight className={cn("h-3 w-3 text-neutral-400 transition-transform", expanded && "rotate-90")} />
        </div>
      </button>
      {expanded && message && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          className="border-t border-neutral-100 px-3 py-2 text-xs text-neutral-500"
        >
          {message}
        </motion.div>
      )}
    </div>
  );
}
```

### Step 3: Commit

```bash
git add frontend/src/components/project/agent/AgentStepIndicator.tsx frontend/src/components/project/agent/ModuleRunCard.tsx
git commit -m "feat(agent): add AgentStepIndicator and ModuleRunCard components"
```

---

## Task 7: Frontend — Composer, StarterPrompts, MessageActions

**Files:**
- Create: `frontend/src/components/project/agent/ChatComposer.tsx`
- Create: `frontend/src/components/project/agent/StarterPrompts.tsx`
- Create: `frontend/src/components/project/agent/MessageActions.tsx`

### Step 1: Create ChatComposer

```tsx
"use client";

import { useCallback, useRef, useEffect, type FormEvent, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { Loader2, Send, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ChatComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (content: string) => void;
  onStop?: () => void;
  disabled?: boolean;
  isStreaming?: boolean;
  maxLength?: number;
}

export function ChatComposer({
  value,
  onChange,
  onSubmit,
  onStop,
  disabled,
  isStreaming,
  maxLength = 4000,
}: ChatComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const lineHeight = 20; // text-sm line-height
    const maxLines = 6;
    el.style.height = `${Math.min(el.scrollHeight, lineHeight * maxLines)}px`;
  }, [value]);

  const handleSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      const trimmed = value.trim();
      if (!trimmed || disabled) return;
      onSubmit(trimmed);
    },
    [value, disabled, onSubmit],
  );

  const handleKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        const trimmed = value.trim();
        if (!trimmed || disabled) return;
        onSubmit(trimmed);
      }
    },
    [value, disabled, onSubmit],
  );

  const nearLimit = value.length > maxLength * 0.9;

  return (
    <form onSubmit={handleSubmit}>
      <div className="rounded-lg border border-neutral-200 bg-white p-2 focus-within:border-moss/40">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={2}
          placeholder="告诉 Agent 你的具体要求..."
          className="min-h-10 w-full resize-none bg-transparent text-sm text-neutral-800 outline-none placeholder:text-neutral-400"
          disabled={disabled}
          maxLength={maxLength}
        />
        <div className="mt-1 flex items-center justify-between">
          <span className={cn("text-[10px]", nearLimit ? "text-coral" : "text-neutral-300")}>
            {nearLimit ? `${value.length}/${maxLength}` : ""}
          </span>
          <div className="flex gap-1.5">
            {isStreaming && onStop ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 gap-1 px-2.5 text-xs text-coral border-coral/30 hover:bg-coral/10"
                onClick={onStop}
              >
                <Square className="h-3 w-3" />
                停止
              </Button>
            ) : (
              <Button
                type="submit"
                size="sm"
                className="h-7 gap-1 bg-moss px-2.5 text-xs text-white hover:bg-moss/90"
                disabled={!value.trim() || disabled}
              >
                {disabled ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                发送
              </Button>
            )}
          </div>
        </div>
      </div>
    </form>
  );
}
```

### Step 2: Create StarterPrompts

```tsx
"use client";

import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface StarterPromptsProps {
  focus: string;
  onSelect: (instruction: string) => void;
  disabled?: boolean;
}

const FOCUS_PROMPTS: Record<string, { label: string; instruction: string }[]> = {
  方向澄清: [
    { label: "帮我澄清项目方向", instruction: "请执行 clarify 模块：澄清项目方向。" },
    { label: "根据已有资料生成方向卡", instruction: "请执行 clarify 模块：根据已有资料生成方向卡。" },
    { label: "这个项目的核心价值是什么？", instruction: "这个项目的核心价值是什么？帮我和团队理清楚。" },
  ],
  阶段计划: [
    { label: "按三周节奏生成阶段计划", instruction: "请执行 plan 模块：按三周节奏生成阶段计划。" },
    { label: "按截止日期倒排阶段", instruction: "请执行 plan 模块：按截止日期倒排阶段。" },
    { label: "解释阶段划分的依据", instruction: "解释阶段划分的依据，帮我和团队理解规划逻辑。" },
  ],
  任务拆解: [
    { label: "把当前阶段拆成任务", instruction: "请执行 breakdown 模块：把当前阶段拆成可执行任务。" },
    { label: "任务拆得更细一点", instruction: "请执行 breakdown 模块：把当前阶段拆成更细的任务。" },
    { label: "优先保留 MVP 任务", instruction: "请执行 breakdown 模块：优先保留 MVP 核心任务。" },
  ],
  分工确认: [
    { label: "根据成员情况推荐分工", instruction: "请执行 assign 模块：根据成员情况推荐分工。" },
    { label: "解释分工依据", instruction: "解释当前分工推荐的依据，帮我和团队理解。" },
    { label: "查看未确认分工", instruction: "查看当前还有哪些分工没有确认。" },
  ],
  执行推进: [
    { label: "生成下一步行动卡", instruction: "请执行 push 模块：生成下一步行动卡。" },
    { label: "分析当前风险", instruction: "请执行 risk 模块：分析当前风险。" },
    { label: "查看项目整体进度", instruction: "帮我看一下项目整体进度，哪些任务完成了，哪些有风险。" },
  ],
};

export function StarterPrompts({ focus, onSelect, disabled }: StarterPromptsProps) {
  const prompts = FOCUS_PROMPTS[focus] ?? FOCUS_PROMPTS["执行推进"];

  return (
    <div className="mb-4">
      <div className="mb-2 flex items-center gap-1.5 text-xs text-neutral-400">
        <Sparkles className="h-3 w-3" />
        快速开始
      </div>
      <div className="space-y-1.5">
        {prompts.map((prompt) => (
          <button
            key={prompt.label}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(prompt.instruction)}
            className={cn(
              "w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-left text-xs text-neutral-600 transition",
              "hover:border-moss/30 hover:bg-moss/5 hover:text-moss",
              "disabled:cursor-not-allowed disabled:opacity-50",
            )}
          >
            {prompt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
```

### Step 3: Create MessageActions

```tsx
"use client";

import { Copy, RefreshCw, ListTodo } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AgentConversationMessage } from "@/lib/types";

interface MessageActionsProps {
  message: AgentConversationMessage;
  onCopy?: () => void;
  onRetry?: () => void;
  onAction?: (instruction: string) => void;
}

export function MessageActions({ message, onCopy, onRetry, onAction }: MessageActionsProps) {
  return (
    <div className="mt-2 flex items-center gap-1 border-t border-neutral-100 pt-2">
      {onCopy && (
        <button
          type="button"
          onClick={onCopy}
          className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-600"
        >
          <Copy className="h-3 w-3" />
          复制
        </button>
      )}
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-600"
        >
          <RefreshCw className="h-3 w-3" />
          重试
        </button>
      )}
      {onAction && (
        <button
          type="button"
          onClick={() => onAction("把这条建议转为具体任务")}
          className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-600"
        >
          <ListTodo className="h-3 w-3" />
          转为任务
        </button>
      )}
    </div>
  );
}
```

### Step 4: Commit

```bash
git add frontend/src/components/project/agent/ChatComposer.tsx frontend/src/components/project/agent/StarterPrompts.tsx frontend/src/components/project/agent/MessageActions.tsx
git commit -m "feat(agent): add ChatComposer, StarterPrompts, MessageActions components"
```

---

## Task 8: Frontend — Refactor AgentSidebar & Wire Streaming

**Files:**
- Modify: `frontend/src/components/project/agent-sidebar.tsx`
- Modify: `frontend/src/app/workspaces/[workspaceId]/page.tsx`
- Modify: `frontend/src/components/project/agent-conversation-cards.tsx`

### Step 1: Add barrel export

Create `frontend/src/components/project/agent/index.ts`:

```typescript
export { ChatMessage } from "./ChatMessage";
export { MarkdownContent } from "./MarkdownContent";
export { StreamingText } from "./StreamingText";
export { AgentStepIndicator } from "./AgentStepIndicator";
export { ModuleRunCard } from "./ModuleRunCard";
export { ChatComposer } from "./ChatComposer";
export { StarterPrompts } from "./StarterPrompts";
export { MessageActions } from "./MessageActions";
export { useAgentStream } from "./useAgentStream";
```

### Step 2: Wire streaming into page.tsx

Replace `handleSendAgentMessage` in `frontend/src/app/workspaces/[workspaceId]/page.tsx`:

```typescript
// Add these state variables alongside existing ones:
const [streamingBuffer, setStreamingBuffer] = useState("");
const [streamStatus, setStreamStatus] = useState<{ phase: string; module?: string; message: string } | null>(null);
const abortRef = useRef<AbortController | null>(null);

const handleSendAgentMessage = async (content: string) => {
  if (!agentConversation) return;
  setPendingAgentConversation(true);
  setPendingAgentInstruction(content);
  setAgentConversationError(null);
  setActionError(null);
  setActionSuccess(null);

  abortRef.current = new AbortController();

  try {
    await sendAgentConversationMessageStream(
      agentConversation.id,
      content,
      {
        onStatus: (status) => setStreamStatus(status),
        onToken: (token) => setStreamingBuffer((prev) => prev + token),
        onDone: (turn) => {
          setAgentConversation(turn.conversation);
          setAgentConversationSuggestions(turn.suggestions ?? []);
          setAgentConversationArtifacts(turn.artifacts ?? []);
          setPendingAgentInstruction(null);
          setStreamingBuffer("");
          setStreamStatus(null);
          reloadProject();
          const hasPendingArtifact = (turn.artifacts ?? []).some(
            (a) => a.status === "pending_confirmation",
          );
          if (!hasPendingArtifact && turn.run?.proposal_id) {
            setActionSuccess("Agent 已生成提案，等待你确认后应用");
          }
        },
        onError: (msg) => {
          setStreamingBuffer("");
          setStreamStatus(null);
          setAgentConversationError(msg || "这次没有生成可用结果，我保留了你的请求。");
        },
      },
      abortRef.current.signal,
    );
  } catch {
    if (!abortRef.current?.signal.aborted) {
      setAgentConversationError("这次没有生成可用结果，我保留了你的请求。你可以重新发送或换一种说法。");
    }
    setStreamingBuffer("");
    setStreamStatus(null);
  } finally {
    setPendingAgentConversation(false);
    abortRef.current = null;
  }
};

const handleStopStreaming = () => {
  abortRef.current?.abort();
};
```

Also update the AgentSidebar props to pass the new streaming state:

```typescript
<AgentSidebar
  // ... existing props ...
  streamingBuffer={streamingBuffer}
  streamStatus={streamStatus}
  onStopStreaming={handleStopStreaming}
/>
```

### Step 3: Refactor agent-sidebar.tsx

The key changes to `agent-sidebar.tsx`:

1. Add new props: `streamingBuffer`, `streamStatus`, `onStopStreaming`
2. Replace inline message rendering with `ChatMessage`
3. Replace `AgentRunStatusCard` with `AgentStepIndicator`
4. Replace inline composer with `ChatComposer`
5. Add `StarterPrompts` for empty state
6. Add `StreamingText` for streaming buffer display
7. Keep `AgentContextCard`, `AgentArtifactCard`, `AgentSuggestionRow`, `AgentErrorCard`

```typescript
// Add to imports:
import {
  ChatMessage,
  StreamingText,
  AgentStepIndicator,
  ChatComposer,
  StarterPrompts,
  useAgentStream,
} from "./agent";

// Add to AgentSidebarProps:
streamingBuffer?: string;
streamStatus?: { phase: string; module?: string; message: string } | null;
onStopStreaming?: () => void;

// Replace message rendering (lines 267-282):
{messages.map((message, index) => (
  <ChatMessage
    key={message.id}
    message={message}
    isLast={index === messages.length - 1}
    onRetry={pendingConversationInstruction ? () => void submitMessage(pendingConversationInstruction) : undefined}
    onAction={(instruction) => void submitMessage(instruction)}
  />
))}

// Replace pending instruction echo (lines 284-289) with:
{pendingConversationInstruction && !streamingBuffer && (
  <ChatMessage
    message={{
      id: "pending",
      conversation_id: "",
      role: "user",
      content: pendingConversationInstruction,
      structured_payload: {},
      created_at: new Date().toISOString(),
    }}
  />
)}

// Add streaming buffer display after pending instruction:
{streamingBuffer && (
  <div className="mr-0 rounded-lg border border-moss/20 bg-moss/5 p-3">
    <div className="mb-1 text-[10px] font-semibold text-neutral-400">Agent</div>
    <StreamingText buffer={streamingBuffer} />
  </div>
)}

// Replace AgentRunStatusCard with AgentStepIndicator:
{streamStatus && <AgentStepIndicator status={streamStatus} />}
{pendingConversation && !streamStatus && <AgentRunStatusCard />}

// Replace composer with ChatComposer:
<ChatComposer
  value={draft}
  onChange={setDraft}
  onSubmit={(text) => void submitMessage(text)}
  onStop={onStopStreaming}
  disabled={Boolean(pendingConversation)}
  isStreaming={Boolean(streamingBuffer)}
/>

// Add StarterPrompts for empty state:
{messages.length === 0 && !pendingConversationInstruction && (
  <StarterPrompts
    focus={focus}
    onSelect={(instruction) => void submitMessage(instruction)}
    disabled={Boolean(pendingConversation)}
  />
)}
```

### Step 4: Run frontend build to verify

```bash
cd frontend && npm run build
```

### Step 5: Commit

```bash
git add frontend/src/components/project/agent/index.ts frontend/src/components/project/agent-sidebar.tsx frontend/src/app/workspaces/\[workspaceId\]/page.tsx
git commit -m "feat(agent): refactor sidebar to use streaming and new components"
```

---

## Task 9: End-to-End Verification

### Step 1: Start backend

```bash
cd backend && .venv/bin/python -m uvicorn app.main:app --reload --port 8000
```

### Step 2: Start frontend

```bash
cd frontend && npm run dev
```

### Step 3: Manual test checklist

- [ ] Open a project, verify Agent sidebar loads
- [ ] Empty state shows StarterPrompts (3 quick-start cards)
- [ ] Click a starter prompt → message sends → AgentStepIndicator shows real-time steps
- [ ] Reply streams in character by character with cursor
- [ ] After streaming completes, message renders as markdown
- [ ] Artifacts appear inline below the message
- [ ] MessageActions (copy/retry/task) visible on last assistant message
- [ ] Click "停止" during streaming → aborts cleanly
- [ ] Quick reply pills still work
- [ ] Advanced actions panel still works
- [ ] Ctrl+J sidebar toggle still works
- [ ] Error state shows AgentErrorCard with retry

### Step 4: Commit final state

```bash
git add -A
git commit -m "feat(agent): conversation UX deep renovation complete"
```
