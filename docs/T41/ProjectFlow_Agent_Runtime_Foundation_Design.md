# ProjectFlow Agent 底座设计

> 本文只设计 Agent 底座：sidecar runtime、runtime loop、AgentRunState、event bridge、policy、trace、FastAPI 边界。
> Tools & Skills 的具体清单和 manifest 见 `ProjectFlow_Agent_Tools_Skills_Design.md`。

---

## 1. 底座目标

Agent 底座要把 ProjectFlow 从固定 Coordinator 调用升级为可控 Agent Harness：

- 支持多轮 Agent loop 和 tool calling。
- 支持模型/provider 路由。
- 支持 ProjectFlow tools 的注册、校验、调用、结果归一化。
- 支持 policy gate、budget、timeout、cancel。
- 支持统一事件流和 trace envelope。
- 支持 ProjectFlow skills 的渐进式加载。
- 保持 FastAPI/DB 为事实源和 commit 权限中心。

底座不负责：

- 直接访问数据库；
- 直接修改项目业务状态；
- 提供 shell/file edit/delete；
- 变成 Pi coding-agent host；
- 实现复杂多 Agent role-play。

---

## 2. 进程边界

```text
FastAPI process
  - public API
  - internal tool API
  - DB session
  - AgentRunState persistence
  - proposal/commit services
  - AgentEvent persistence

Sidecar process
  - HTTP/SSE or WebSocket bridge
  - Pi agent runtime
  - run state bridge
  - tool registry
  - skill loader
  - policy gate
  - event mapper
```

通信方式：

- FastAPI 调 sidecar：发起 run、cancel run、获取 health。
- Sidecar 调 FastAPI internal API：执行 ProjectFlow tools。
- Sidecar stream event 回 FastAPI 或 frontend gateway：统一为 ProjectFlow event。

sidecar 不应持有数据库凭据。internal API 使用单独 token，并限制在内网或本机 loopback。

---

## 3. Sidecar 内部模块

```text
agent-bridge/
  src/
    runtime/
      pi-runtime.ts
      model-router.ts
      session-store.ts
      run-state.ts
      context-builder.ts
    tools/
      registry.ts
      manifest.ts
      fastapi-client.ts
      result-normalizer.ts
    skills/
      skill-index.ts
      skill-loader.ts
    policy/
      policy-engine.ts
      budget.ts
      proposal-boundary.ts
      advisory-boundary.ts
    events/
      event-mapper.ts
      trace-envelope.ts
      stream.ts
    server/
      routes.ts
      health.ts
      config.ts
```

模块边界：

| 模块 | 职责 | 不做什么 |
|---|---|---|
| `pi-runtime` | 封装 `pi-ai` + `pi-agent-core` | 不暴露 Pi 类型给 FastAPI |
| `model-router` | 根据配置选择 provider/model | 不读取用户密钥日志 |
| `session-store` | 保存 runtime session metadata | 不保存业务事实 |
| `run-state` | 维护 sidecar 视角的 run state patch | 不替代 FastAPI 持久状态 |
| `context-builder` | 将 FastAPI 输入转成模型上下文 | 不读 DB，不制造隐藏事实 |
| `registry` | 注册 ProjectFlow tools | 不执行业务逻辑 |
| `fastapi-client` | 调 internal tool endpoints | 不绕过 FastAPI |
| `policy-engine` | allow/deny/block | 不让模型自审批 |
| `proposal-boundary` | 维护 proposal creation 与 confirmation 边界 | 不执行 proposal confirm/commit |
| `advisory-boundary` | 校验 advisory writes 不改主事实 | 不创建 commit effect |
| `event-mapper` | Pi event -> ProjectFlow event | 不改变业务结果 |
| `trace-envelope` | run/tool/proposal 关联 | 不记录 secret |
| `skill-loader` | 渐进加载 skills | 不一次塞入全部 references |

---

## 4. Runtime Loop

底座运行一次 Agent run 的流程：

```text
1. FastAPI receives user message
2. FastAPI persists user AgentMessage
3. FastAPI assembles WorkspaceState
4. FastAPI creates AgentRun + AgentRunState(created)
5. FastAPI calls sidecar /runs
6. Sidecar patches AgentRunState(context_building)
7. Sidecar builds context and skill metadata
8. Sidecar starts Pi Agent
9. Pi emits assistant/tool events
10. Sidecar beforeToolCall validates manifest + policy
11. Sidecar patches AgentRunState(tool_preparing/tool_running)
12. Sidecar calls FastAPI internal tool endpoint
13. FastAPI executes service transaction and returns structured result
14. Sidecar afterToolCall normalizes observation
15. Sidecar maps events and trace back to ProjectFlow
16. FastAPI persists AgentRun/AgentEvent/AgentProposal links
17. Frontend receives stream and renders timeline/proposal
```

loop invariants：

- 每次 tool call 有且只有一个 tool result。
- 每次 tool call 执行前参数已校验。
- 每次副作用前已有 policy decision。
- 每个 result 有 bounded payload。
- 每个 run 有 budget。
- 最终回答必须基于 tool observations 或明确说明无 observation。
- error 以结构化 observation 返回。
- run state transition 必须可持久化、可查询、可测试。
- tool success observation 只能在 FastAPI 持久化成功后返回给模型。

### 4.1 Durable AgentRunState

`AgentRunState` 是 FastAPI DB 中的 durable state，sidecar 只能通过 internal runtime endpoint 提交 patch。Pi session、provider response id、sidecar memory 都不是业务事实源。

```text
created
  -> context_building
  -> model_streaming
  -> tool_preparing
  -> tool_running
  -> persisting_tool_result
  -> model_streaming
  -> completed

any active state -> cancelling -> cancelled
any active state -> failed
```

最低字段：

Canonical wire format：所有 JSON/YAML payload 字段一律使用 `snake_case`。下面的 TypeScript interface 是 sidecar 内部 shape，允许 camelCase，但必须由生成代码或 adapter 与 API payload 互转。

```ts
export interface AgentRunState {
  schemaVersion: number;
  runId: string;
  conversationId: string;
  workspaceId: string;
  projectId: string;
  status:
    | "created"
    | "context_building"
    | "model_streaming"
    | "tool_preparing"
    | "tool_running"
    | "persisting_tool_result"
    | "completed"
    | "cancelling"
    | "cancelled"
    | "failed";
  currentTurn: number;
  currentStep: number;
  model: {
    provider: string;
    name: string;
  };
  pendingToolCall?: {
    toolCallId: string;
    toolName: string;
    toolVersion: number;
    idempotencyKey: string;
  };
  sideEffects: Array<{
    toolCallId: string;
    status:
      | "no_side_effect"
      | "event_persisted"
      | "proposal_persisted"
      | "advisory_record_persisted"
      | "commit_persisted"
      | "unknown";
  }>;
  lastEventSeq: number;
  resumePolicy: {
    manifestVersion: number;
    requiresRegenerationOnMismatch: boolean;
  };
}
```

### 4.2 事务和回放边界

- FastAPI endpoint 是唯一业务事务边界。
- Sidecar 不直接创建 proposal、AgentEvent 或业务对象，只调用 FastAPI internal endpoint。
- `event_seq` 由 FastAPI 按 `run_id` 单调分配。sidecar 不能决定最终 `event_seq`，只能提交 `client_event_id`、`idempotency_key` 和 `ordering_hint`。
- `state_patch`、event append、tool result persistence 优先通过 `POST /internal/agent-runs/{run_id}/events:append` 在 FastAPI 内完成同一事务；响应返回已分配的 `event_seq` 和持久化后的 `state_version`。
- 如果实现拆成多个 endpoint，FastAPI 仍必须用同一 `idempotency_key` 做原子、幂等落库；sidecar 不能把分步成功当成最终事实。
- proposal/advisory tool 的成功定义是 FastAPI 已经持久化对应 draft/advisory record，且 tool result 带 `proposal_id` 或 `created_ids`。
- 同一个 `(run_id, tool_call_id, tool_name, tool_version)` 必须幂等。
- `unknown` side effect status 禁止自动 fallback，必须进入 reconciliation 或人工处理。
- resume 前必须校验 manifest version、tool schema version、proposal payload schema version。
- LangGraph-style resume 会重执行节点的风险必须被显式规避：任何 proposal creation、commit、外部副作用都不能放在未幂等的可重放区间。

### 4.3 Sidecar 重启语义

Sidecar 可以丢失内存 session，但不能丢失事实：

- FastAPI 仍能查询最后 `AgentRunState`、`AgentEvent`、`AgentProposal`。
- active run 在 sidecar 重启后默认进入 `failed` 或 `cancelled`，不能假装继续。
- 若要 resume，必须由 FastAPI 重新发起 run，并携带 durable state、manifest version 和 pending proposal/advisory links。

---

## 5. Runtime API

FastAPI 调 sidecar 的最小 API：

```http
POST /runs
POST /runs/{run_id}/cancel
GET /runs/{run_id}
GET /health
```

Sidecar 调 FastAPI 的 runtime persistence API：

```http
POST /internal/agent-runs/{run_id}/events:append
```

这个 API 只接受 service-to-service token，不接受浏览器 cookie。它是 runtime append 的收敛合同：一次请求可以携带 state patch、events、tool results，FastAPI 在同一事务里分配 `event_seq`、写入 `AgentEvent`、持久化 tool result，并更新 `AgentRunState`。

Append request：

```json
{
  "idempotency_key": "run_xxx:call_xxx:append:v1",
  "state_patch": {
    "status": "tool_running",
    "schema_version": 1
  },
  "events": [
    {
      "client_event_id": "client_evt_xxx",
      "type": "tool.started",
      "ordering_hint": 5,
      "payload": {}
    }
  ],
  "tool_results": []
}
```

Append response：

```json
{
  "state_version": 7,
  "events": [
    {
      "client_event_id": "client_evt_xxx",
      "agent_event_id": "evt_xxx",
      "event_seq": 5
    }
  ],
  "tool_results": []
}
```

`POST /runs` input：

```json
{
  "conversation_id": "conv_xxx",
  "workspace_id": "workspace_xxx",
  "project_id": "project_xxx",
  "user_message_id": "msg_xxx",
  "user_content": "帮我重新规划一下",
  "workspace_state": {},
  "recent_messages": [],
  "pending_proposals": [],
  "runtime_config": {
    "model": "provider/model",
    "max_steps": 8,
    "max_tool_calls": 6,
    "timeout_ms": 180000,
    "trace_include_sensitive_data": false
  }
}
```

`RuntimeEvent` output：

```json
{
  "type": "tool.started",
  "run_id": "run_xxx",
  "event_seq": 5,
  "timestamp": "2026-07-04T00:00:00Z",
  "state": {
    "status": "tool_running",
    "schema_version": 1
  },
  "trace": {},
  "payload": {}
}
```

`RuntimeEvent.event_seq` 是 FastAPI append response 中的 assigned value，不是 sidecar 本地计数器。

---

## 6. Model / Provider

> **安装**：`npm install @earendil-works/pi-ai`（详见 Member A handoff 文档的"Pi 组件安装与参考"章节）

使用 `@earendil-works/pi-ai`：

- 注册内置 provider collection。
- 支持 OpenAI-compatible endpoint。
- 支持 OpenRouter、DeepSeek、Anthropic、Google、Mistral 等 provider。
- 支持 provider-specific API shape 转换。
- 支持 tool schema 转 provider tool format。

配置原则：

- provider/model/base_url/api_key 从 sidecar runtime config 或环境变量读取。
- secret 不进入 AgentEvent、trace、日志、前端。
- 每次 run 记录 provider 和 model，但不记录 key。
- model 能力差异通过 model catalog 或 runtime config 标注。
- provider 侧 parallel tool calls 只有在当前暴露工具全是 read-only 且 manifest 允许时才能打开。
- 动态 API key 解析只能在 sidecar 内部完成，不进入 `AgentRunState` 或 trace。

---

## 7. Tool Execution Hooks

> **安装**：`npm install @earendil-works/pi-agent-core`（详见 Member A handoff 文档的"Pi 组件安装与参考"章节）

使用 `pi-agent-core` 的 hooks：

### 7.1 beforeToolCall

职责：

- 找到 tool manifest；
- 校验工具是否存在；
- 校验参数 schema；
- 计算 risk category；
- 检查 caller permission；
- 检查 budget；
- 检查 timeout/cancel signal；
- 生成 `tool.started` 或 `tool.blocked` event；
- 允许或拒绝 tool call，并返回 structured policy decision。
- 生成或校验 idempotency key。
- 写入 `AgentRunState.pendingToolCall`。

拒绝也必须返回 tool result：

```json
{
  "status": "blocked",
  "error": {
    "code": "POLICY_DENIED",
    "reason": "human_triggered_only",
    "message": "confirm_proposal is human-triggered only"
  },
  "observation": "The requested tool is human-triggered only and was not executed."
}
```

### 7.2 afterToolCall

职责：

- 归一化 FastAPI response；
- 截断过大 payload；
- 打 hash；
- 记录 latency；
- 关联 AgentEvent/AgentProposal；
- 生成 `tool.completed` 或 `tool.failed` event；
- 将 result 转为模型可用 observation。
- 写入 side effect status。
- 对 `tool_not_found`、validation error、policy denied、timeout、aborted 使用统一 model-visible error formatter。

---

## 8. Policy Engine

默认策略：

| 类别 | 模型可调用 | 默认动作 |
|---|---:|---|
| read_only | 是 | allow |
| analysis | 是 | allow + trace |
| draft_only | 是 | allow proposal only |
| advisory_write | 是 | allow advisory record only |
| internal_write | 否，除非 sidecar-only | block |
| destructive | 否 | block |
| open_world | 否 | block |
| human_triggered_only | 否 | block |

policy 失败模式：

- manifest 缺失：deny。
- schema 校验失败：return validation_error observation。
- policy engine 超时：deny。
- FastAPI internal API 失败：return tool_error observation。
- budget 超限：return budget_exceeded observation。
- manifest version mismatch：return regenerate_required observation。

proposal confirmation / tool execution approval 规则：

- `proposal_confirmation` 是当前唯一的人类确认业务边界，由用户通过 public API confirm、reject、commit。它不默认 resume 当前 model loop。
- 模型只能创建 proposal、typed domain proposal 或 advisory records，不能 confirm/reject/commit proposal。
- `ToolExecutionApproval` 是未来扩展点；当前目标架构不实现 `waiting_for_tool_approval` 状态机。
- 当前 policy gate 只能 allow、block/deny 或返回 terminal observation，不能暂停等待人工批准。
- proposal reject/commit 必须记录产品事件；如果需要模型继续分析，由 FastAPI 以 rejection feedback 发起新 run。

read-only 规则：

- public GET route 和 internal read-only tool 的语义一致：只能读取或计算派生视图。
- read-only 路径不得 `session.add()` / `session.delete()`，不得修改 ORM attribute，不得 `flush()` / `commit()`，不得调用可能写入的服务。
- `get_project_state`、`get_workspace_state`、`get_timeline_slice` 不能执行 Primary Project State catch-up。
- Stage/Project catch-up 只能存在于 human-origin command、proposal confirmation commit、migration/admin maintenance 或 scheduled/internal State Repair Command。

---

## 9. Budget / Timeout / Cancel

每个 run 至少包含：

- max steps；
- max tool calls；
- max runtime duration；
- max output tokens；
- max tool result bytes；
- per-tool timeout。

预算超限必须可见：

```json
{
  "type": "runtime.error",
  "payload": {
    "code": "BUDGET_EXCEEDED",
    "scope": "tool_calls"
  }
}
```

cancel 由 FastAPI 或前端触发，sidecar 通过 abort signal 取消 Pi run 和 pending tool call。
cancel 后仍必须写 terminal `AgentRunState` 和 `runtime.error` / `agent.failed` event。

---

## 10. Event Bridge

Pi event 不能直接泄漏到前端。sidecar 统一映射为 ProjectFlow events。

| Pi lifecycle | ProjectFlow event |
|---|---|
| `agent_start` | `agent.started` |
| `turn_start` | `agent.status` |
| `message_delta` | `agent.delta` |
| `tool_execution_start` | `tool.started` |
| `tool_execution_update` | `tool.progress` |
| `tool_execution_end` | `tool.completed` / `tool.failed` |
| `turn_end` | `agent.status` |
| `agent_end` | `agent.completed` |
| policy block | `tool.blocked` |
| advisory record created | `advisory_record.created` |
| proposal created | `proposal.created` |
| proposal confirmation | `proposal_confirmation.confirmed` / `proposal_confirmation.rejected` / `proposal_confirmation.committed` |
| state patch | `run.state_changed` |

ProjectFlow event 必须带：

- `run_id`;
- `event_seq`;
- `conversation_id`;
- `project_id`;
- `workspace_id`;
- `tool_call_id` if present;
- `proposal_id` if present;
- `created_at`;
- bounded `payload`;
- `trace` summary。
- `state_schema_version`。

event invariants：

- `event_seq` 由 FastAPI append API 按同一 `run_id` 单调递增。
- sidecar event 必须带 `client_event_id` 或 append-level `idempotency_key`，可选 `ordering_hint` 只用于表达本地顺序。
- `run.state_changed` 必须和 durable `AgentRunState` patch 对齐。
- raw prompt、raw tool input/output、provider headers 默认不进 event payload。
- 如果开启 debug raw payload，必须单独存储和单独 retention。

---

## 11. State Ownership

| 状态 | Owner | 说明 |
|---|---|---|
| Primary Project State: Project/Stage/Task/finalized owner/status/date | FastAPI/DB | 唯一主事实源 |
| Advisory Project Record: Risk/ActionCard | FastAPI/DB | 可处理运营记录，不直接改主事实 |
| Reviewable Draft Record: AgentProposal/AssignmentProposal | FastAPI/DB | pending/confirmed/rejected 或领域确认流 |
| WorkspaceState | FastAPI | 每次 run 组装 |
| AgentConversation/Message | FastAPI/DB | 产品会话记录 |
| AgentRun | FastAPI/DB | run 持久化 |
| AgentRunState | FastAPI/DB | durable run state |
| AgentEvent | FastAPI/DB | timeline |
| event_seq | FastAPI/DB | run 内单调序号 |
| Side effect status | FastAPI/DB | replay/fallback 决策依据 |
| Runtime session metadata | Sidecar | 可重建，不是业务事实 |
| Tool observations | Sidecar + FastAPI trace | 用于模型上下文和 timeline |
| Skills | Sidecar filesystem/package | 程序性知识 |

读写边界：

- WorkspaceState、ProjectState、timeline slice 是 Read-Only State View，不是 repair path。
- Primary Project State 的 stale repair 是显式 State Repair Command，不是 GET side effect。
- Agent 只能通过 replan proposal 请求 inferred Task/Stage/Project 变化，不能通过 read-only tool 或 advisory write 间接触发。
- AssignmentProposal 是 typed Reviewable Draft Record：Agent 可以创建建议，但 owner 写入只能由 owner response/finalize 等人类或领域确认路径完成。
- Risk severity 不改变 Risk row 的 advisory 属性；high-severity mitigation 如果触碰 Primary Project State，必须生成 replan proposal。

---

## 12. Error Model

统一错误码：

| Code | 场景 |
|---|---|
| `TOOL_NOT_FOUND` | 模型请求不存在的工具 |
| `INVALID_ARGUMENTS` | 参数不符合 schema |
| `POLICY_DENIED` | policy 阻断 |
| `HUMAN_APPROVAL_REQUIRED` | 需要人类触发 |
| `TOOL_TIMEOUT` | 工具超时 |
| `FASTAPI_UNAVAILABLE` | internal API 不可达 |
| `PROVIDER_ERROR` | 模型 provider 失败 |
| `BUDGET_EXCEEDED` | budget 超限 |
| `RESULT_TOO_LARGE` | 工具结果过大 |
| `CANCELLED` | 用户取消 |
| `PROPOSAL_REJECTED` | 人类拒绝 proposal confirmation |
| `MANIFEST_VERSION_MISMATCH` | resume 时 manifest 不兼容 |
| `SIDE_EFFECT_UNKNOWN` | 工具中断后副作用状态未知 |

错误对模型是 observation，对产品是 timeline event，对测试是断言对象。

---

## 13. Security

底座安全默认值：

- sidecar 不拿 DB credential；
- internal API token 独立配置；
- logs redaction；
- secret 不进 trace；
- shell/file/delete tools 不注册；
- third-party extensions 默认不启用；
- open-world connector 默认禁用；
- policy fail-closed；
- tool result 有大小限制；
- sidecar 容器不挂载用户 home；
- 所有 commit 只能通过 FastAPI confirm path；
- internal endpoints 仍要做 project/workspace/user permission check；
- `AgentRunState` 只允许 JSON-safe schema，不反序列化任意 class/object；
- trace 默认 `include_sensitive_data=false`。

---

## 14. Testing

底座测试分层：

### Unit

- manifest parser；
- policy engine；
- event mapper；
- trace envelope builder；
- result normalizer；
- budget checker；
- run state transition validator；
- side effect status classifier。

### Contract

- FastAPI internal tool response -> sidecar observation；
- Pi tool schema conversion；
- blocked tool call still produces result；
- proposal tool links `AgentProposal`；
- event_seq owner is FastAPI and append response assigns the run-scoped order；
- runtime append API persists state patch, event, and tool result atomically or idempotently；
- internal tool endpoints use POST-only JSON body；
- ToolExecutionApproval stays a future extension and does not enter current run state；
- LLM ToolManifest has no commit effect type；
- snake_case API payload converts to internal TS shape through generated/adapter layer；
- trace envelope excludes raw sensitive payload by default。
- read-only public GET / internal tool does not mutate `Project.status`, `Project.current_stage_id`, `Stage.status`, `Task.status`, owner, or dates；
- explicit State Repair Command catches up stale Stage/Project state when invoked, and only when invoked。

### Integration

- `POST /runs` with mock model；
- read-only tool call；
- proposal tool call；
- timeout/cancel；
- provider error；
- stream event order；
- cancel from active states；
- sidecar restart leaves FastAPI state queryable。

### Transaction / Idempotency

- same idempotency key does not duplicate proposal；
- same idempotency key does not duplicate typed `AssignmentProposal` or advisory Risk/ActionCard records；
- tool success observation only after FastAPI persistence；
- proposal confirmation rejection does not execute commit；
- Agent-generated check-in task changes do not call `create_status_update()` directly；
- high-severity Risk creation is advisory, while Primary Project State mitigation is proposal-confirmed；
- `unknown` side effect blocks automatic fallback；
- manifest version mismatch triggers regeneration/manual handling。

### Parity

迁移每个旧 Coordinator flow 时验证：

- schema；
- fallback；
- AgentEvent；
- proposal payload；
- created IDs；
- frontend artifact。

---

## 15. Implementation Order

1. 定义 `AgentRunState`、runtime API、event schema、trace envelope。
2. 新建 sidecar workspace 和基础 server。
3. 实现 run state bridge、event_seq、state transition validator。
4. 引入 `pi-ai` 和 `pi-agent-core`，跑通 mock provider/tool。
5. 实现 manifest registry、policy engine、advisory write guard、proposal confirmation event handling。
6. 实现 FastAPI internal client 和 service-to-service auth。
7. 接入 read-only tools。
8. 移除 read path 中的 stage/project catch-up，并补 State Repair Command 或 maintenance job。
9. 重分层旧 Agent 副作用：check-in task updates 改 replan proposal，high Risk confirmation 改 mitigation confirmation，Assignment 保持 typed proposal。
10. 接入第一个 proposal tool，并验证幂等和 side effect status。
11. 接入 stream/timeline/proposal confirmation。
12. 增加 parity、idempotency、reconciliation tests。
13. 逐步迁移旧 Coordinator flow。
