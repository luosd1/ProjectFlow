# ProjectFlow Agent 底座设计

> 本文只设计 Agent 底座：sidecar runtime、runtime loop、event bridge、policy、trace、FastAPI 边界。
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
  - proposal/commit services
  - AgentEvent persistence

Sidecar process
  - HTTP/SSE or WebSocket bridge
  - Pi agent runtime
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
    tools/
      registry.ts
      manifest.ts
      fastapi-client.ts
      result-normalizer.ts
    skills/
      skill-index.ts
      skill-loader.ts
      context-builder.ts
    policy/
      policy-engine.ts
      budget.ts
      approvals.ts
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
| `registry` | 注册 ProjectFlow tools | 不执行业务逻辑 |
| `fastapi-client` | 调 internal tool endpoints | 不绕过 FastAPI |
| `policy-engine` | allow/deny/block/require_approval | 不让模型自审批 |
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
4. FastAPI calls sidecar /runs
5. Sidecar builds context and skill metadata
6. Sidecar starts Pi Agent
7. Pi emits assistant/tool events
8. Sidecar beforeToolCall validates manifest + policy
9. Sidecar calls FastAPI internal tool endpoint
10. FastAPI executes service and returns structured result
11. Sidecar afterToolCall normalizes observation
12. Sidecar maps events and trace back to ProjectFlow
13. FastAPI persists AgentRun/AgentEvent/AgentProposal links
14. Frontend receives stream and renders timeline/proposal
```

loop invariants：

- 每次 tool call 有且只有一个 tool result。
- 每次 tool call 执行前参数已校验。
- 每次副作用前已有 policy decision。
- 每个 result 有 bounded payload。
- 每个 run 有 budget。
- 最终回答必须基于 tool observations 或明确说明无 observation。
- error 以结构化 observation 返回。

---

## 5. Runtime API

FastAPI 调 sidecar 的最小 API：

```http
POST /runs
POST /runs/{run_id}/cancel
GET /runs/{run_id}
GET /health
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
    "timeout_ms": 180000
  }
}
```

`RuntimeEvent` output：

```json
{
  "type": "tool.started",
  "run_id": "run_xxx",
  "sequence": 5,
  "timestamp": "2026-07-04T00:00:00Z",
  "trace": {},
  "payload": {}
}
```

---

## 6. Model / Provider

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

---

## 7. Tool Execution Hooks

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
- 允许、拒绝或返回需要人工审批的 structured result。

拒绝也必须返回 tool result：

```json
{
  "status": "denied",
  "error_code": "POLICY_DENIED",
  "message": "confirm_proposal is human-triggered only"
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

---

## 8. Policy Engine

默认策略：

| 类别 | 模型可调用 | 默认动作 |
|---|---:|---|
| read_only | 是 | allow |
| analysis | 是 | allow + trace |
| draft_only | 是 | allow proposal only |
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

ProjectFlow event 必须带：

- `run_id`;
- `sequence`;
- `conversation_id`;
- `project_id`;
- `workspace_id`;
- `tool_call_id` if present;
- `proposal_id` if present;
- `created_at`;
- bounded `payload`;
- `trace` summary。

---

## 11. State Ownership

| 状态 | Owner | 说明 |
|---|---|---|
| Project/Stage/Task/Member/Risk | FastAPI/DB | 唯一事实源 |
| WorkspaceState | FastAPI | 每次 run 组装 |
| AgentConversation/Message | FastAPI/DB | 产品会话记录 |
| AgentRun | FastAPI/DB | run 持久化 |
| AgentEvent | FastAPI/DB | timeline |
| AgentProposal | FastAPI/DB | pending/confirmed/rejected |
| Runtime session metadata | Sidecar | 可重建，不是业务事实 |
| Tool observations | Sidecar + FastAPI trace | 用于模型上下文和 timeline |
| Skills | Sidecar filesystem/package | 程序性知识 |

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
- 所有 commit 只能通过 FastAPI confirm path。

---

## 14. Testing

底座测试分层：

### Unit

- manifest parser；
- policy engine；
- event mapper；
- trace envelope builder；
- result normalizer；
- budget checker。

### Contract

- FastAPI internal tool response -> sidecar observation；
- Pi tool schema conversion；
- denied tool call still produces result；
- proposal tool links `AgentProposal`。

### Integration

- `POST /runs` with mock model；
- read-only tool call；
- proposal tool call；
- timeout/cancel；
- provider error；
- stream event order。

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

1. 新建 sidecar workspace 和基础 server。
2. 定义 runtime API、event schema、trace envelope。
3. 引入 `pi-ai` 和 `pi-agent-core`，跑通 mock provider/tool。
4. 实现 manifest registry 和 policy engine。
5. 实现 FastAPI internal client。
6. 接入 read-only tools。
7. 接入第一个 proposal tool。
8. 接入 stream/timeline。
9. 增加 parity tests。
10. 逐步迁移旧 Coordinator flow。
