# Agent 对话交互全栈深度改造设计

> 日期：2026-06-07
> 状态：设计确认
> 范围：前端 + 后端 streaming + 工具调用状态实时推送 + Agent 执行步骤可视化

## 1. 目标

将 ProjectFlow 右侧栏 Agent 对话从"同步请求 + 纯文本渲染"升级为接近成熟 AI 产品的交互体验：

- Agent 执行过程实时可见（不再盯 spinner 等待）
- 回复逐字流出（不再全量闪现）
- 消息有层级区分（用户/Agent/工具调用）
- Agent 模块执行有折叠式卡片展示
- 空状态有高质量引导
- 输入区成熟可用

## 2. 参考来源

| 来源 | 参考什么 |
|---|---|
| assistant-ui | 消息流组件抽象、Composer、streaming buffer 管理、auto-scroll |
| Vercel AI SDK / Chatbot | `StreamingTextResponse` + `useChat` 模式、空状态引导、shadcn/ui 组件组织 |
| LangChain Agent Chat UI | Agent 执行过程映射到消息流、模块调用卡片 |
| UI-TARS / Agent TARS | Event Stream、工具调用状态、运行耗时展示 |
| LibreChat | 消息操作栏（复制/重试）、成熟产品交互细节 |

## 3. 架构设计

### 3.1 后端 SSE Streaming Pipeline

```
POST /agent/conversations/{id}/messages/stream
  → 保存 user message
  → SSE 响应开始 (Content-Type: text/event-stream)
  → 推送 status event: phase=planning
  → _plan_turn() 执行
  → 推送 status event: phase=executing 或 phase=answering
  → 如果 run_module:
      推送 status event: phase=executing, module=xxx, message="正在拆解任务..."
      执行模块
      推送 status event: phase=generating
  → 最终回复文本: 推送 token events (逐字)
  → 推送 done event (含完整 turn 数据: suggestions, artifacts, metadata)
  → 保存 assistant message 到 DB
```

**SSE Event 格式：**

```
event: status
data: {"phase": "planning", "message": "正在理解你的需求..."}

event: status
data: {"phase": "executing", "module": "breakdown", "message": "正在拆解任务..."}

event: status
data: {"phase": "generating", "message": "正在整理结果..."}

event: token
data: {"content": "根据"}

event: token
data: {"content": "当前"}

event: done
data: {"conversation": {...}, "user_message": {...}, "assistant_message": {...}, "run": {...}, "turn_plan": {...}, "next_suggestions": [...], "suggestions": [...], "artifacts": [...]}
```

**关键决策：**
- 保留原有同步 `POST /messages` endpoint（向后兼容）
- 新增 `POST /messages/stream` SSE endpoint
- module 执行阶段（生成结构化 JSON）不逐字 streaming，只推状态 event
- 只有最终回复文本做逐字 streaming
- mock provider 做 fallback：将回复文本逐字切片模拟 streaming

### 3.2 前端 SSE 消费

```
fetch("/api/agent/conversations/{id}/messages/stream", { method: "POST", body: ... })
  → ReadableStream reader
  → 解析 SSE lines
  → status events → 更新 AgentStepIndicator
  → token events → 追加到 streamingBuffer state，逐字渲染
  → done event → 刷新 conversation state，清空 streamingBuffer
```

选择 `fetch + ReadableStream` 而非 `EventSource`，因为：
- EventSource 只支持 GET，我们需要 POST with body
- fetch 方式更灵活，可以携带 auth headers

## 4. 后端文件改动

### 4.1 `backend/app/agent/llm_client.py`

**改动：** `LLMClient` 协议增加 `stream_complete()` 方法

```python
class LLMClient(Protocol):
    def complete(self, messages: list[dict[str, str]], *, max_tokens: int | None = None) -> str: ...

    def stream_complete(
        self, messages: list[dict[str, str]], *, max_tokens: int | None = None
    ) -> Iterator[str]:
        """Yield content tokens incrementally. Default impl wraps complete()."""
        ...
```

- `OpenAICompatibleLLMClient.stream_complete()`: 使用 OpenAI streaming API (`"stream": true`)，解析 SSE chunks，yield 每个 delta content
- `MockLLMClient.stream_complete()`: 将预设回复逐字切片 yield（延迟 20ms/字模拟）
- 默认实现 fallback: 调用 `complete()` 后 yield 整个结果

### 4.2 `backend/app/services/agent_conversation_service.py`

**新增：** `process_conversation_message_stream()` async generator

```python
def process_conversation_message_stream(
    session: Session,
    conversation_id: str,
    content: str,
    *,
    llm_client: LLMClient | None = None,
) -> Iterator[dict[str, Any]]:
    """Yield SSE events for a conversation turn."""
    # 1. Save user message
    # 2. yield {"event": "status", "data": {"phase": "planning", ...}}
    # 3. _plan_turn()
    # 4. yield {"event": "status", "data": {"phase": "executing"/"answering", ...}}
    # 5. If run_module: execute, yield status events
    # 6. Generate final reply text
    # 7. yield {"event": "status", "data": {"phase": "generating"}}
    # 8. For token in llm_client.stream_complete(...): yield {"event": "token", ...}
    # 9. Save assistant message, yield {"event": "done", ...}
```

保留原有 `process_conversation_message()` 不动。

### 4.3 `backend/app/api/routes_agent_conversations.py`

**新增：** SSE endpoint

```python
@router.post("/conversations/{conversation_id}/messages/stream")
def send_message_stream(
    conversation_id: str,
    body: AgentConversationMessageCreate,
    session: Session = Depends(get_session),
):
    return StreamingResponse(
        process_conversation_message_stream(session, conversation_id, body.content),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
```

### 4.4 `backend/app/schemas/agent_conversation.py`

**新增：** SSE event 类型定义（用于类型提示和文档，实际 SSE 以 JSON string 传输）

## 5. 前端文件改动

### 5.1 新增组件

| 文件 | 职责 |
|---|---|
| `components/project/agent/ChatMessage.tsx` | 消息气泡组件，区分 user/assistant/tool 角色 |
| `components/project/agent/MarkdownContent.tsx` | assistant 消息的 markdown 渲染（react-markdown） |
| `components/project/agent/AgentStepIndicator.tsx` | 实时 Agent 执行步骤指示器，替代静态 AgentRunStatusCard |
| `components/project/agent/StreamingText.tsx` | 逐字渲染 streaming 文本 + 打字机光标 |
| `components/project/agent/StarterPrompts.tsx` | 空状态引导问题卡片 |
| `components/project/agent/MessageActions.tsx` | 消息底部操作栏（复制/重试/转为任务） |
| `components/project/agent/ChatComposer.tsx` | 增强输入区（自动增高、停止按钮） |
| `components/project/agent/ModuleRunCard.tsx` | Agent 模块执行折叠卡片（模块名+状态+耗时） |
| `components/project/agent/useAgentStream.ts` | SSE streaming hook（fetch + ReadableStream 消费） |

### 5.2 重构组件

| 文件 | 改动 |
|---|---|
| `agent-sidebar.tsx` | 从 619 行瘦身到 ~250 行，只负责布局编排，消息渲染/输入/状态委派给子组件 |
| `agent-conversation-cards.tsx` | AgentContextCard 保留；AgentRunStatusCard 被 AgentStepIndicator 替代；AgentArtifactCard 保留但支持 inline 到消息流 |

### 5.3 依赖新增

| 包 | 用途 |
|---|---|
| `react-markdown` | assistant 消息 markdown 渲染 |
| `remark-gfm` | GFM 支持（表格、任务列表等） |

### 5.4 `frontend/src/lib/api.ts`

**新增：** `sendAgentConversationMessageStream()` 函数

```typescript
export async function sendAgentConversationMessageStream(
  conversationId: string,
  content: string,
  callbacks: {
    onStatus: (status: { phase: string; module?: string; message: string }) => void;
    onToken: (token: string) => void;
    onDone: (turn: AgentConversationTurn) => void;
    onError: (error: string) => void;
  },
  signal?: AbortSignal,
): Promise<void>
```

### 5.5 `frontend/src/lib/types.ts`

**新增：** SSE event 类型

```typescript
type AgentStreamStatusEvent = {
  event: "status";
  data: { phase: "planning" | "executing" | "generating" | "answering"; module?: string; message: string };
};

type AgentStreamTokenEvent = {
  event: "token";
  data: { content: string };
};

type AgentStreamDoneEvent = {
  event: "done";
  data: AgentConversationTurn;
};
```

## 6. 组件设计细节

### 6.1 ChatMessage

```tsx
// 角色区分的视觉样式
// user: ml-8, 白色背景, 右对齐感
// assistant: mr-0, moss/5 背景, 左对齐
// tool: 折叠式 ModuleRunCard

// assistant 消息内容用 MarkdownContent 渲染
// 消息底部可选 MessageActions
```

### 6.2 AgentStepIndicator

替代静态 `AgentRunStatusCard`。根据 SSE status events 动态更新：

```
[✓] 正在理解你的需求     (planning, completed)
[✓] 正在拆解任务         (executing, completed)
[●] 正在整理结果         (generating, in_progress)
[○] 生成回复             (answering, pending)
```

每个步骤有完成/进行中/待定三种状态，用 Framer Motion 过渡。

### 6.3 StreamingText

```tsx
// 接收 streamingBuffer string
// 逐字渲染 + 尾部闪烁光标
// 使用 react-markdown 渲染已完成部分
// 最后一个 token 后显示光标直到 done event
```

### 6.4 StarterPrompts

空状态展示 3-5 个引导卡片，根据 `focus` 动态生成：
- 方向澄清: ["帮我澄清项目方向", "根据已有资料生成方向卡", "这个项目的核心价值是什么？"]
- 阶段计划: ["按三周节奏生成阶段计划", "按截止日期倒排阶段", "解释阶段划分的依据"]
- 执行推进: ["生成下一步行动卡", "分析当前风险", "查看项目整体进度"]

### 6.5 ChatComposer

- textarea 自动增高（min 2 行，max 6 行）
- streaming 中显示"停止"按钮（AbortController cancel）
- Enter 发送，Shift+Enter 换行
- 字符计数（max 4000，接近时显示）

### 6.6 ModuleRunCard

Agent 执行模块时显示的折叠卡片：

```
┌─────────────────────────────┐
│ 🔧 任务拆解        ● 执行中 │
│ 将当前阶段拆解为可执行任务   │
│ 耗时: 12s                   │
└─────────────────────────────┘
```

默认展开执行中，完成后自动折叠。点击可展开查看详细信息。

### 6.7 MessageActions

每条 assistant 消息底部：

```
[复制] [重试] [转为任务]
```

- 复制：复制消息文本到剪贴板
- 重试：重新发送上一条用户消息
- 转为任务：发送 "把这条建议转为任务" 指令

## 7. 数据流

### 7.1 发送消息（新流程）

```
1. 用户输入 → submitMessage()
2. 乐观渲染用户消息（立即显示）
3. 设置 pendingConversation=true
4. 清空 draft
5. 调用 sendAgentConversationMessageStream()
6. onStatus → 更新 AgentStepIndicator
7. onToken → 追加到 streamingBuffer, StreamingText 渲染
8. onDone → 刷新 conversation state, 清空 buffer, 更新 suggestions/artifacts
9. onError → 显示 AgentErrorCard
10. pendingConversation=false
```

### 7.2 停止生成

```
1. 用户点击"停止"按钮
2. 调用 AbortController.abort()
3. 后端收到连接断开，停止 LLM streaming
4. 前端用已收到的 tokens 作为部分回复显示
5. 标记为中断状态
```

## 8. 不变的部分

- Agent 两阶段架构（plan_turn → run_module）不变
- 数据库模型不变（AgentConversation, AgentMessage, AgentRun）
- Proposal confirm/reject 流程不变
- 高级操作面板保留（移到底部）
- 现有类型定义只增不改
- 同步 endpoint 保留（向后兼容）

## 9. 实施顺序

1. **后端 streaming 基础** — LLMClient.stream_complete() + SSE endpoint
2. **前端 SSE hook** — useAgentStream + api.ts streaming 函数
3. **消息组件拆分** — ChatMessage, MarkdownContent, StreamingText
4. **Agent 状态组件** — AgentStepIndicator, ModuleRunCard
5. **输入区增强** — ChatComposer（自动增高、停止按钮）
6. **空状态 + 消息操作** — StarterPrompts, MessageActions
7. **agent-sidebar.tsx 瘦身** — 组装新组件，删除旧 inline 代码
8. **集成测试** — 端到端验证 streaming 流程
