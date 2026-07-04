# ProjectFlow Agent 底座重构总方案

> 结论：ProjectFlow 应采用 **TypeScript Agent Bridge Sidecar + Pi 组件级 Runtime + ProjectFlow Tool Contract + ProjectFlow RunState + Proposal-Confirm Commit**。
> 这是当前目标架构，不是临时过渡方案。实施可以按工具和业务流逐步切片验证，但架构边界、状态机、事务边界、工具契约从第一天就按最终形态设计。

---

## 1. 目标

ProjectFlow 当前 Agent 能力主要由固定 `CoordinatorAgent` 模块驱动：clarify、plan、breakdown、assign、push、checkin、risk、replan 等能力已经存在，但运行方式仍偏固定流程触发，不是真正的工具化 Agent Runtime。

本次重构目标是建立 ProjectFlow 自己的 Agent 底座：

- Agent 能基于 WorkspaceState、Conversation、Timeline 自主选择 ProjectFlow 工具。
- 所有项目管理能力通过稳定 Tool Contract 暴露，而不是绑定某个 SDK 的私有格式。
- FastAPI 和 DB 继续作为项目、任务、成员、风险、Proposal、Timeline 的事实源。
- 高影响写入必须先进入 Proposal，由人类确认后再由 FastAPI 确定性 commit。
- Runtime 执行过程必须可观测、可追踪、可回放、可测试。
- 旧 Coordinator 中已有的 schema、校验、fallback、AgentEvent、proposal persistence 迁移为工具后端资产，不直接丢弃。

---

## 2. 推荐架构

```text
ProjectFlow Frontend
  - Agent chat
  - tool timeline
  - proposal preview
  - confirm / reject
        |
        v
FastAPI ProjectFlow Core
  - DB fact source
  - WorkspaceState assembler
  - AgentProposal / AgentEvent / AgentRun persistence
  - deterministic commit services
  - internal tool endpoints
        |
        v
TypeScript Agent Bridge Sidecar
  - Pi runtime session
  - model/provider routing
  - ProjectFlow tool registry
  - ProjectFlow skills
  - run state bridge
  - policy gate
  - trace envelope
  - event bridge
        |
        v
Pi component runtime
  - @earendil-works/pi-ai
  - @earendil-works/pi-agent-core
```

关键点：

- 使用 `@earendil-works/pi-ai` 做模型/provider 层。
- 使用 `@earendil-works/pi-agent-core` 做 Agent loop、tool call、hooks、runtime events。
- 不直接嵌入完整 `@earendil-works/pi-coding-agent`。
- 不让 sidecar 直接访问 DB。
- 不注册 shell、file edit、delete、任意网络工具。
- OpenAI Agents SDK、LangGraph、MCP、Pi coding-agent 只作为设计参考或 adapter 参考，不作为当前主 runtime。
- ProjectFlow 自己定义 durable `AgentRunState`，不把 Pi session、OpenAI RunState 或 LangGraph checkpoint 当事实源。

---

## 3. 为什么是这个方案

### 3.1 为什么不是继续扩展旧 Coordinator

旧 Coordinator 是固定模块门面。它的价值在于：

- `CoordinatorAgent` 已经覆盖核心项目管理模块。
- `generate_structured_output()` 已有 JSON repair、schema validation、fallback、provider error handling、AgentEvent logging。
- `validate_agent_output()` 已有输出 schema 和 reference validation。
- `agent_flow_service` 已有 proposal、assignment proposal、risk、action card、task status update 持久化链路。
- `agent_conversation_service` 已有 conversation、turn plan、SSE status/token/done、artifacts、suggestions。

但它不适合作为最终 runtime：

- 工具选择逻辑固定，不能自然扩展为多工具循环。
- 业务模块和 runtime 调度耦合。
- 事件粒度不够表达现代 Agent 的 tool lifecycle。
- 没有统一 capability manifest、policy gate、trace envelope。

处理方式：保留旧资产，拆成 ProjectFlow tools 和 service backends；Coordinator 最终缩成 legacy adapter 或删除。

### 3.2 为什么不是完整 Pi coding-agent

`@earendil-works/pi-coding-agent` 是完整 coding-agent host，包含 file、shell、TUI、project trust、extension lifecycle 等语义。ProjectFlow 是项目管理产品，不是 coding agent。

直接嵌入完整 coding-agent 会带来错误抽象：

- ProjectFlow 不需要开放文件编辑和 shell 执行作为核心能力。
- ProjectFlow 的安全边界是 Proposal-Confirm，不是 coding project trust。
- ProjectFlow 的事实源是 FastAPI/DB，不是本地 workspace 文件。
- Product UI 需要 ProjectFlow 事件，不应消费 coding-agent 原生 UI 事件。

正确做法是使用 Pi 的组件：`pi-ai` + `pi-agent-core`。

### 3.3 为什么不是 OpenAI Agents SDK 主线

OpenAI Agents SDK 并不是只能调用 OpenAI 官方 API。它支持 OpenAI-compatible endpoints、`ModelProvider`、具体 model object 和第三方 adapter。

不作为主线的原因不是模型兼容性，而是架构贴合度：

- 最强路径仍围绕 OpenAI Responses 能力。
- 第三方 provider 的能力一致性需要额外适配。
- Python SDK 虽然贴近 FastAPI，但 ProjectFlow 需要一个独立 sidecar 管 runtime、tool lifecycle 和多 provider routing。
- Pi 组件已经提供 TypeScript 侧 provider collection、tool schema 转换、before/after tool hooks 和 runtime events。

OpenAI Agents SDK 保留为参考实现和备用 adapter 方向。

### 3.4 为什么不是 LangGraph 主线

LangGraph 强在 checkpoint、interrupt/resume、显式 graph state、多 Agent state machine。

ProjectFlow 当前最关键的问题不是 graph checkpointing，而是：

- 稳定 Tool Contract；
- proposal-confirm 安全边界；
- tool lifecycle event；
- policy gate；
- trace envelope；
- 旧 Coordinator 资产迁移。

因此当前主线不应被 graph runtime 复杂度拖住。LangGraph 保留为 explicit graph semantics 的参考。

---

## 4. 架构原则

### 4.1 DB 是唯一事实源

Agent memory、conversation history、skill context 都不能替代 DB 状态。每次关键 run 必须基于最新 WorkspaceState。

```text
正确：Agent 读取 WorkspaceState 后生成 proposal
错误：Agent 根据会话记忆判断任务真实状态
```

### 4.2 Model 提议，Harness 执行

模型只能提出工具调用和建议。Harness 负责：

- 参数校验；
- 权限判断；
- 工具执行；
- 结果记录；
- 错误归一化；
- observation 返回；
- trace 持久化。

每次 tool call 必须恰好产生一个 result。blocked、timeout、validation_error、aborted 都是结构化 observation，不能静默吞掉。

### 4.3 Draft 和 Commit 分离

ProjectFlow 的 Proposal-Confirm 不是 UI 细节，而是 runtime 安全边界。

```text
Agent tool call
  -> generate draft/proposal
  -> AgentProposal pending
  -> user confirm/reject
  -> FastAPI deterministic commit
```

LLM-callable tools 不允许 confirm、reject、commit。

### 4.4 工具窄而类型化

工具应围绕 ProjectFlow 业务语义设计：

- `get_workspace_state`
- `generate_stage_plan_proposal`
- `analyze_checkins_and_risks`

不要提供宽泛工具：

- `execute_sql`
- `call_any_api`
- `write_project_state`
- `execute_anything`

### 4.5 Sidecar 是 runtime，不是业务后端

Sidecar 管 runtime session、tool registry、model routing、policy hooks、event mapping。
Sidecar 不直接读写 DB，不保存核心业务状态，不绕过 FastAPI 服务。

### 4.6 Skills 渐进披露

ProjectFlow skills 是程序性知识，不是大 prompt 堆砌。

启动时只暴露 skill metadata；匹配任务后再加载 `SKILL.md`；只有被引用的 references/scripts 才进入上下文。

### 4.7 不注册通用危险工具

当前目标 runtime 不注册：

- shell；
- file edit；
- delete；
- arbitrary network；
- direct DB write；
- generic HTTP caller。

如果需要引入外部连接器，必须先通过 capability manifest 和 policy gate 引入。

---

## 5. 系统边界

### 5.1 Frontend

职责：

- 发起 Agent run；
- 展示 conversation；
- 展示 runtime status 和 token stream；
- 展示 tool timeline；
- 展示 proposal preview；
- 触发 confirm/reject；
- 展示 linked `AgentEvent`、`AgentRun`、`AgentProposal`。

约束：

- 不依赖 Pi 原生 event。
- 不直接调用 sidecar 工具。
- 不在前端决定 commit 结果，只触发 FastAPI confirm/reject API。

### 5.2 FastAPI Core

职责：

- 持有 DB 事实源；
- 组装 WorkspaceState；
- 暴露 internal tool endpoints；
- 管理 AgentConversation、AgentMessage、AgentRun；
- 管理 AgentEvent timeline；
- 管理 AgentProposal 生命周期；
- 执行 confirm/reject/commit；
- 校验 schema、references、权限、幂等；
- 兼容旧 Coordinator 后端能力。

约束：

- 不承担复杂 multi-tool Agent loop。
- 不直接绑定 Pi SDK 类型。

### 5.3 Agent Bridge Sidecar

职责：

- 初始化 Pi model/provider；
- 创建和恢复 runtime session；
- 注册 ProjectFlow tools；
- 加载 ProjectFlow skills；
- 执行 `beforeToolCall` policy；
- 执行 `afterToolCall` result normalization；
- 将 Pi event 映射为 ProjectFlow unified event；
- 维护 trace envelope；
- 将 stream 返回 FastAPI/frontend gateway；
- 处理 cancel、timeout、budget。

约束：

- 不直接访问数据库。
- 不提交业务状态。
- 不保存持久事实源。
- 不注册通用 shell/file tools。

### 5.4 Pi Components

使用：

- `@earendil-works/pi-ai`
- `@earendil-works/pi-agent-core`

只作为 runtime 组件，不把 ProjectFlow 变成 Pi coding-agent app。

---

## 6. 本地 Repos 拆解决策

这一节不是引用清单，而是把本地 clone 的 Pi、OpenAI Agents SDK、LangGraph 代码拆成 ProjectFlow 必须遵守的设计规则。

### 6.1 Pi 拆解决策

依据：

- `vendor_imports/research/agent-runtime/repos/pi/packages/agent/src/types.ts`
- `vendor_imports/research/agent-runtime/repos/pi/packages/agent/src/agent-loop.ts`
- `vendor_imports/research/agent-runtime/repos/pi/packages/agent/src/agent.ts`
- `vendor_imports/research/agent-runtime/repos/pi/packages/ai/src/models.ts`
- `vendor_imports/research/agent-runtime/repos/pi/packages/ai/src/providers/all.ts`
- `vendor_imports/research/agent-runtime/repos/pi/packages/coding-agent/src/core/skills.ts`

落地规则：

- 使用 Pi 的 `Agent` session 和 `runAgentLoop` 语义，不直接嵌入完整 `coding-agent` host。
- Pi `StreamFn` 的失败语义是事件化和结果化：request/model/runtime failure 不应只表现为 throw，而要转成 stream event 和最终 error/aborted assistant result。ProjectFlow 侧必须把这些映射成 `agent.failed`、`tool.failed`、`runtime.error` 并持久化。
- Pi `beforeToolCall` 对应 ProjectFlow policy gate。validation error、policy denied、tool approval required、aborted 都必须返回模型可见 observation，不能只写日志。
- Pi `afterToolCall` 对应 ProjectFlow result normalization。它可以改写 result、标记 error、决定 terminate，因此 ProjectFlow 需要统一 error formatter 和 result limiter。
- Pi `ToolExecutionMode` 必须进入 capability manifest。read-only 工具允许 parallel；proposal/write-adjacent 工具必须 sequential；一批工具中只要存在 sequential 工具，整批按 sequential 执行。
- Pi `transformContext` 对应 ProjectFlow Context Builder，只能把 FastAPI 组装的 WorkspaceState、Conversation、Timeline 转成模型上下文，不允许在 sidecar 中读 DB 或制造隐藏事实。
- Pi `prepareNextTurn` 只用于 turn 间 context/model/budget 调整，不用于隐藏业务写入。
- Pi `Agent.abort()` 对应 ProjectFlow `/agent-runs/{run_id}/cancel`，cancel 后仍要写入 final run state 和 trace。
- Pi `steer` / `followUp` 只能映射为 queued user input 或 system steering，不能绕过当前 run state machine。
- Pi provider 层支持多 provider 和动态 API key，因此 ProjectFlow 可以保留 OpenRouter、OpenAI-compatible、自定义 provider 路线；密钥解析必须在 sidecar 内部完成，trace 默认不记录 key、headers、raw provider payload。
- Pi skill loader 的核心价值是 metadata-first progressive disclosure。ProjectFlow skills 应采用同类规则：启动时只暴露 name/description/location，命中后再读 `SKILL.md`，并按 skill 目录解析 references/scripts。

### 6.2 OpenAI Agents SDK 拆解决策

依据：

- `vendor_imports/research/agent-runtime/repos/openai-agents-python/src/agents/lifecycle.py`
- `vendor_imports/research/agent-runtime/repos/openai-agents-python/src/agents/run_config.py`
- `vendor_imports/research/agent-runtime/repos/openai-agents-python/src/agents/run_state.py`
- `vendor_imports/research/agent-runtime/repos/openai-agents-python/src/agents/run_internal/approvals.py`
- `vendor_imports/research/agent-runtime/repos/openai-agents-python/docs/human_in_the_loop.md`
- `vendor_imports/research/agent-runtime/repos/openai-agents-python/docs/running_agents.md`

落地规则：

- ProjectFlow 需要自己的 serializable `AgentRunState`，带 `schema_version`。暂停、审批、取消、恢复、失败都不能只靠内存中的 Pi session。
- tool approval / rejection 必须绑定 `tool_call_id`。reject 不执行工具，并且要生成模型可见 rejection observation。
- `tool_not_found`、validation failure、tool approval rejection、policy denial 应统一走 model-visible error formatter，而不是直接抛异常终止 run。
- 需要 `max_tool_concurrency` 和 tool pre-approval guardrails。即使 provider 支持 parallel tool calls，ProjectFlow harness 也必须按 manifest 限流。
- trace 默认 `include_sensitive_data=false`。raw input、raw output、provider request、tool result 只能在明确允许的调试模式进入受控存储；默认 trace 只保存 hash、redacted summary、schema version 和关联 ID。
- 每个 conversation 只能选择一个持久化事实源。ProjectFlow 的事实源是 FastAPI DB，sidecar transcript、provider response id、runtime memory 都只能是运行材料，不能反向覆盖业务事实。
- pending tool approval 和 paused run 必须记录 tool schema/version/model/provider/budget。恢复时如果 manifest version 不兼容，不能盲目 resume，必须要求重新生成或人工处理。

### 6.3 LangGraph 拆解决策

依据：

- `vendor_imports/research/agent-runtime/repos/langgraph/libs/langgraph/langgraph/graph/state.py`
- `vendor_imports/research/agent-runtime/repos/langgraph/libs/langgraph/langgraph/types.py`
- `vendor_imports/research/agent-runtime/repos/langgraph/libs/langgraph/langgraph/runtime.py`
- `vendor_imports/research/agent-runtime/repos/langgraph/libs/langgraph/langgraph/callbacks.py`
- `vendor_imports/research/agent-runtime/repos/langgraph/libs/checkpoint/README.md`
- `vendor_imports/research/agent-runtime/repos/langgraph/libs/checkpoint-postgres/README.md`
- `vendor_imports/research/agent-runtime/repos/langgraph/libs/checkpoint-sqlite/README.md`

落地规则：

- LangGraph 证明 durable agent 不能只靠“流式事件”。必须有可序列化 state、checkpoint id、thread/run id、resume event、interrupt event。
- ProjectFlow 当前不采用 LangGraph runtime，但必须采用显式状态机和 checkpoint 思维：每个 run 的当前位置、pending tool、pending tool approval、已持久化副作用都要可查询。
- LangGraph `interrupt()` 依赖 checkpointer，并且 resume 会从节点开头重执行。ProjectFlow 因此不能把 proposal creation、commit、外部副作用放在可重执行的不幂等区域。
- LangGraph checkpoint 的 `thread_id` / `checkpoint_id` 对应 ProjectFlow 的 `conversation_id` / `run_state_checkpoint_id`。`run_id` 负责单次执行，`conversation_id` 负责同一对话的上下文链路。
- LangGraph pending writes 说明部分成功需要被记账。ProjectFlow 工具执行失败时，必须区分 `no_side_effect`、`proposal_persisted`、`commit_persisted`、`unknown`。
- LangGraph serializer 有 strict allowlist 安全要求。ProjectFlow `AgentRunState` 只允许 JSON-safe schema，不反序列化任意 class/object。

---

## 7. Run State、事务和回放边界

### 7.1 Run State Machine

ProjectFlow 必须持久化 run state，而不是只依赖 SSE 或 sidecar 内存。

```text
created
  -> context_building
  -> model_streaming
  -> tool_preparing
  -> tool_running
  -> persisting_tool_result
  -> model_streaming
  -> waiting_for_tool_approval
  -> completed

any active state -> cancelling -> cancelled
any active state -> failed
waiting_for_tool_approval -> resumed -> model_streaming
waiting_for_tool_approval -> rejected -> completed
```

最低 `AgentRunState` 字段：

Canonical wire format：持久化 JSON、HTTP payload、manifest YAML 一律使用 `snake_case`。sidecar 内部 TypeScript 可以使用 camelCase，但必须通过生成代码或 adapter 与 API payload 互转。

```json
{
  "schema_version": 1,
  "run_id": "run_xxx",
  "conversation_id": "conv_xxx",
  "project_id": "project_xxx",
  "status": "tool_running",
  "current_turn": 2,
  "current_step": 5,
  "model": {
    "provider": "openrouter",
    "name": "model_name"
  },
  "pending_tool_call": {
    "tool_call_id": "call_xxx",
    "tool_name": "generate_stage_plan_proposal",
    "tool_version": 1,
    "idempotency_key": "run_xxx:call_xxx:generate_stage_plan_proposal:v1"
  },
  "pending_tool_approval": null,
  "side_effects": [],
  "last_event_seq": 42,
  "resume_policy": {
    "manifest_version": 1,
    "requires_regeneration_on_mismatch": true
  }
}
```

### 7.2 事实源归属

| 数据 | 事实源 | sidecar 是否可写 |
|---|---|---|
| Project / Task / Member / Risk | FastAPI DB | 否 |
| AgentConversation / AgentMessage | FastAPI DB | 只能通过 FastAPI endpoint |
| AgentRun / AgentRunState | FastAPI DB | 只能提交 state patch |
| AgentEvent timeline / event_seq | FastAPI DB | 只能提交 append request，最终序号由 FastAPI 分配 |
| AgentProposal | FastAPI DB | 只能通过 proposal tool endpoint 创建 |
| Pi session / provider response id | Sidecar volatile cache | 是，但不是业务事实 |
| Skill metadata / loaded skill content | Sidecar runtime | 是，但只能影响上下文 |

### 7.3 事务边界

- FastAPI endpoint 是唯一能落业务事务的地方。
- Sidecar 执行工具时只能调用 internal tool endpoint，不能绕过 service 层。
- `event_seq` 由 FastAPI 按 `run_id` 单调分配。sidecar 不直接决定最终 `event_seq`，只能提交 `client_event_id`、`idempotency_key` 或 `ordering_hint`。
- `state_patch`、event append、tool result persistence 优先收敛到 `POST /internal/agent-runs/{run_id}/events:append`，由 FastAPI 在同一事务里落库；响应返回 assigned `event_seq` 和持久化后的 `state_version`。
- 如果实现拆成多个 endpoint，FastAPI 仍必须按同一 idempotency key 做原子、幂等落库；sidecar 不能把分步成功视为最终事实。
- proposal tool 的成功定义是 pending `AgentProposal` 已经持久化，且 tool result 返回 `proposal_id`。
- 同一个 `(run_id, tool_call_id, tool_name, tool_version)` 必须幂等。retry 命中同一 idempotency key 时返回已有 proposal/event/result。
- tool result 只有在 FastAPI 成功持久化后才能作为 success observation 返回给模型。
- 如果工具运行中断，必须记录 side effect status：
  - `no_side_effect`
  - `event_persisted`
  - `proposal_persisted`
  - `commit_persisted`
  - `unknown`
- `unknown` 状态禁止自动 fallback，必须人工或 deterministic reconciliation 处理。

### 7.4 Tool Approval / Proposal Confirmation 边界

- `tool_approval` 是工具执行前审批，只绑定 `approval_id` 和 `tool_call_id`。需要审批时 run 进入 `waiting_for_tool_approval`，批准后 resume model loop。
- `proposal_confirmation` 是 `AgentProposal` 生命周期，由用户通过 FastAPI public API confirm、reject、commit。它不默认 resume 当前 model loop。
- 模型只能创建 proposal 或请求 tool approval，不能 confirm/reject/commit proposal。
- tool approval rejection 必须生成模型可见 observation，并且不得执行被拒绝的工具。
- proposal reject/commit 只更新 proposal 和业务状态；如果需要模型继续处理，由 FastAPI 以新的 user/system feedback 发起新 run。
- resume 时必须校验 manifest version、tool schema version、proposal payload schema version。版本不兼容时重新生成 proposal 或转人工处理。

### 7.5 Cutover / Fallback 边界

逐步迁移允许 fallback，但 fallback 必须遵守副作用边界：

- feature flag 按 flow/tool 切，不按全局 runtime 粗切。
- 允许 fallback 的位置：sidecar 未开始工具调用、工具明确 `no_side_effect`、或幂等查询确认已有结果可复用。
- 不允许 fallback 的位置：proposal 已创建但旧 path 不知道该 proposal、commit 已发生、side effect status 是 `unknown`。
- parity test 通过前，旧 Coordinator 可以作为 legacy adapter；parity test 通过后，fallback 只保留为故障开关，不作为主路径。

### 7.6 内部信任边界

- Sidecar 只接受 FastAPI 内部调用，不接受浏览器直连。
- Sidecar 调 FastAPI internal tool endpoints 必须使用 service-to-service token 或等价内部认证。
- Sidecar 不持有用户 session cookie，不透传浏览器 token 到 provider。
- Internal tool endpoint 必须做 project/workspace/user permission check，不能因为来源是 sidecar 就跳过。
- 所有 tool input/output 默认按敏感数据处理，trace 只存 hash、schema version、redacted summary。

---

## 8. ProjectFlow Tool Contract

每个工具必须有 capability manifest：

Manifest wire payload 使用 `snake_case`。sidecar registry 内部可以转为 camelCase，但 registry 输出给 FastAPI、测试 fixture、YAML 文件都保持 `snake_case`。

```yaml
schema_version: 1
name: generate_stage_plan_proposal
version: 1
description: Generate a pending stage plan proposal from current workspace state.
risk_category: draft_only
model_callable: true
human_triggered_only: false
read_only: false
destructive: false
idempotent: true
open_world: false
timeout_ms: 120000
execution:
  mode: sequential
  concurrency_group: project_proposal_write
  max_concurrency: 1
  provider_parallel_tool_calls_allowed: false
retry:
  max_attempts: 1
result_limit:
  max_bytes: 65536
backend:
  owner: fastapi
  endpoint: POST /internal/agent-tools/generate-stage-plan-proposal
effects:
  effect_type: proposal_create
  idempotency_key_required: true
  replay_safe: true
tool_approval:
  required_before_execution: false
  approval_scope: none
proposal_confirmation:
  creates_proposal: true
  required_before_commit: true
  public_action_only: true
  resumes_model_loop_by_default: false
privacy:
  data_classification: project_sensitive
  trace_include_inputs: false
  trace_include_outputs: false
errors:
  model_visible_error_policy: normalized_summary
resume:
  manifest_version: 1
  incompatible_version_policy: regenerate
trace:
  emits:
    - tool.started
    - tool.completed
    - proposal.created
```

工具分类：

| 分类 | 默认策略 | 示例 |
|---|---|---|
| read_only | 自动允许 | `get_workspace_state`, `get_timeline_slice` |
| analysis | 自动允许 + trace | `analyze_checkins_and_risks` |
| draft_only | 允许生成 proposal，不允许 commit | `generate_stage_plan_proposal` |
| internal_write | 默认 sidecar-only 或 human-triggered | 写入 AgentRun / conversation metadata |
| destructive | LLM-callable 禁用 | 删除、覆盖、回滚 |
| open_world | 默认禁用，需额外审查 | 外部服务、第三方 connector |

执行策略：

- read-only tool 默认 `execution.mode=parallel`，但必须无副作用、可重放、结果有大小限制。
- analysis tool 可以 parallel，但如果会写入 `AgentEvent` 或中间 artifact，必须通过 FastAPI 幂等 endpoint。
- draft_only / proposal tool 必须 sequential，且 `concurrency_group` 按 project 或 proposal 类型隔离。
- internal_write tool 默认不能 model-callable。确需 runtime 写入时，只能写 AgentRun/AgentEvent 这类 runtime metadata。
- destructive 和 open_world 默认不注册给 LLM。
- provider 侧 parallel tool calls 只有在当前暴露工具全是 read-only 且 manifest 明确允许时才能打开。
- `tool_not_found`、schema validation error、policy denied、timeout、aborted 都必须产生模型可见 tool result。
- 每个 tool call 必须恰好一个 terminal result：`success`、`blocked`、`failed`、`aborted`、`timeout`、`validation_error`。
- policy denied 使用 `status=blocked`，具体原因写入 `error.code=POLICY_DENIED` 和 `error.reason`，不能扩展成新的 terminal status。

首批工具：

- `get_workspace_state`
- `get_agent_conversation`
- `list_pending_proposals`
- `get_timeline_slice`
- `generate_direction_card_proposal`
- `generate_stage_plan_proposal`
- `generate_task_breakdown_proposal`
- `recommend_assignment`
- `analyze_checkins_and_risks`
- `generate_replan_proposal`

confirm/reject/commit 不是 LLM-callable tool，只能由人类操作触发 FastAPI API。

---

## 9. Trace Envelope

每个 run、tool call、proposal 都必须能串起来。

统一 trace envelope：

```json
{
  "run_id": "run_xxx",
  "conversation_id": "conv_xxx",
  "workspace_id": "workspace_xxx",
  "project_id": "project_xxx",
  "tool_call_id": "call_xxx",
  "tool_name": "generate_stage_plan_proposal",
  "tool_version": 1,
  "provider": "openrouter",
  "model": "model_name",
  "run_state": {
    "status": "tool_running",
    "current_step": 5,
    "state_schema_version": 1
  },
  "event_seq": 42,
  "latency_ms": 1234,
  "budget": {
    "max_steps": 8,
    "max_tool_calls": 6,
    "max_tokens": 12000
  },
  "policy": {
    "decision": "allow",
    "reason": null,
    "tool_approval_id": null
  },
  "result": {
    "status": "success",
    "error_code": null,
    "side_effect_status": "proposal_persisted",
    "input_hash": "sha256:...",
    "output_hash": "sha256:..."
  },
  "privacy": {
    "trace_include_sensitive_data": false,
    "input_redacted": true,
    "output_redacted": true
  },
  "links": {
    "agent_event_id": "evt_xxx",
    "agent_run_id": "run_db_xxx",
    "proposal_id": "proposal_xxx",
    "created_ids": []
  }
}
```

最低事件类型：

- `agent.started`
- `agent.status`
- `agent.delta`
- `agent.completed`
- `agent.failed`
- `tool.started`
- `tool.completed`
- `tool.blocked`
- `tool.failed`
- `proposal.created`
- `tool_approval.required`
- `tool_approval.rejected`
- `proposal_confirmation.confirmed`
- `proposal_confirmation.rejected`
- `proposal_confirmation.committed`
- `run.state_changed`
- `runtime.error`

Trace 约束：

- trace event 的 `event_seq` 必须来自 FastAPI append response，并按 `run_id` 单调递增，便于前端 timeline 和 replay。
- sidecar 发起 append 时只提交 `client_event_id`、`idempotency_key` 或 `ordering_hint`。
- 默认不保存 raw prompt、raw tool input、raw tool output、provider headers。
- Debug 模式如果需要 raw payload，必须单独开关、单独存储、单独 retention，不进入默认 AgentEvent。
- `AgentRunState` 和 `TraceEnvelope` 都要带 schema version，方便兼容和迁移。

---

## 10. 旧 Coordinator 迁移规则

旧 Coordinator 不作为最终 runtime，但保留为迁移资产。

### 10.1 直接保留

- 输出 schema；
- reference validation；
- `_normalize_user_facing_text()`；
- fallback payload；
- provider error classification；
- AgentEvent logging；
- proposal persistence；
- assignment/risk/action-card/task-status 服务链。

### 10.2 需要封装

把固定模块封装为 internal tool backend：

| 旧能力 | 新工具 |
|---|---|
| `generate_direction_card` | `generate_direction_card_proposal` |
| `generate_stage_plan` | `generate_stage_plan_proposal` |
| `generate_task_breakdown` | `generate_task_breakdown_proposal` |
| `recommend_assignments` | `recommend_assignment` |
| `analyze_checkin` + `analyze_risks` | `analyze_checkins_and_risks` |
| `replan` | `generate_replan_proposal` |

### 10.3 删除条件

只有当每条生产路径都有 parity tests，并且 sidecar path 已稳定替代旧 path 后，才删除或缩小 Coordinator。

---

## 11. Delivery Slices

这是实施切片，不是架构版本。目标架构不变。

1. 定义 Tool Contract、Capability Manifest、Trace Envelope、Unified Event、AgentRunState schema。
2. 在 FastAPI 增加 `AgentRunState` persistence、internal agent tool endpoints，但先复用旧服务。
3. 新增 TS sidecar skeleton，引入 `pi-ai` 和 `pi-agent-core`。
4. 实现 read-only tools：workspace state、conversation、proposal、timeline。
5. 实现 policy gate、event bridge、run state bridge、cancel/timeout。
6. 封装第一个 proposal tool，建议从 clarify 或 plan 开始。
7. 接入 frontend stream/timeline/proposal confirmation，但保持旧 path fallback。
8. 为每条迁移 flow 增加 parity tests、idempotency tests、side-effect reconciliation tests。
9. 迁移 breakdown、assign、risk、replan。
10. 移除或缩小 Coordinator legacy adapter。

AI 辅助会降低实现成本，因此不需要因为“一次性写完风险”而压缩架构目标。真正要控制的是每个切片都能验证，且不能绕过 Proposal-Confirm。

---

## 12. 验证策略

### 12.1 Contract Tests

- manifest 字段完整；
- schema 可转换为 Pi tool schema；
- read-only tool 无副作用；
- draft-only tool 只能创建 proposal；
- human-triggered tool 不能被模型调用；
- blocked tool call 产生结构化 result；
- LLM-callable ToolManifest 不包含 commit effect type；
- internal tool endpoints 全部是 POST JSON body；
- read-only 语义来自 manifest 的 `risk_category`、`read_only`、`effects.effect_type=none`；
- canonical API payload 是 `snake_case`，与 sidecar TS shape 的转换有测试；
- execution mode、concurrency group、privacy、resume policy 必填且被 harness 执行；
- provider parallel tool calls 只在 manifest 允许时打开。

### 12.2 Run State Tests

- 每个 state transition 合法；
- cancel 从任意 active state 进入 `cancelled`；
- timeout 写入 `failed` 或 `timeout` terminal result；
- `waiting_for_tool_approval` 可序列化、可恢复；
- manifest version mismatch 触发 regenerate/manual handling；
- sidecar 重启后 FastAPI 仍能查询最后 run state。

### 12.3 Transaction / Idempotency Tests

- 同一 idempotency key 重试不重复创建 proposal；
- FastAPI append API 按 `run_id` 分配单调 `event_seq`；
- state patch、event append、tool result persistence 作为同一 FastAPI 事务提交，或拆 endpoint 时仍由 FastAPI 原子/幂等落库；
- tool success observation 只在 FastAPI 持久化成功后返回；
- `unknown` side effect status 禁止自动 fallback；
- repeated confirm 幂等；
- rejected tool approval 不执行工具；
- rejected proposal confirmation 不执行 commit；
- tool approval resume 和 proposal confirmation 不默认 resume 的行为分别覆盖；
- tool crash 后可 reconciliation。

### 12.4 Parity Tests

每条旧 flow 迁移时必须比较：

- 输出 schema；
- reference validation；
- fallback 行为；
- AgentEvent 记录；
- proposal payload；
- created domain IDs；
- frontend artifact 显示。

### 12.5 Safety Tests

- sidecar 不能直接访问 DB；
- LLM-callable tools 不包含 confirm/reject/commit；
- LLM-callable tools 不包含 commit effect type；
- shell/file/delete tools 不注册；
- repeated confirm 幂等；
- tool timeout 写入 trace；
- validation error 作为 observation 返回；
- trace 默认不包含 raw prompt、raw tool payload、provider headers；
- internal endpoints 不因为 sidecar 来源而跳过权限校验。

### 12.6 Product Tests

- 用户能看到 Agent 正在读取状态、调用工具、生成 proposal；
- proposal 能确认或拒绝；
- confirm 后业务状态真实更新；
- timeline 能关联 run、tool、event、proposal；
- sidecar 失败时 fallback path 清晰。

---

## 13. 文档拆分

本总方案只定义架构决策和实施边界。详细设计拆分为：

- [ProjectFlow Agent 底座设计](./ProjectFlow_Agent_Runtime_Foundation_Design.md)
- [ProjectFlow Tools & Skills 设计](./ProjectFlow_Agent_Tools_Skills_Design.md)

研究缓存：

- [Agent Runtime Vendor Research](../../vendor_imports/research/agent-runtime/ANALYSIS.md)

---

## 14. 参考依据

本方案基于以下本地调研和代码事实：

- `vendor_imports/research/agent-runtime/ANALYSIS.md`
- `vendor_imports/research/agent-runtime/repos/pi`
- `vendor_imports/research/agent-runtime/repos/openai-agents-python`
- `vendor_imports/research/agent-runtime/repos/langgraph`
- `/Users/robertwu/Documents/Projects/agent_tech/concepts/agent-harness-three-layer-model.md`
- `/Users/robertwu/Documents/Projects/agent_tech/concepts/agents-best-practices-framework.md`
- `/Users/robertwu/Documents/Projects/agent_tech/concepts/composable-harness-architecture.md`
- `/Users/robertwu/Documents/Projects/agent_tech/concepts/mcp-protocol-deep-dive.md`
- `/Users/robertwu/Documents/Projects/agent_tech/concepts/agentic-memory-systems.md`
- `/Users/robertwu/Documents/Projects/agent_tech/concepts/agent-skills-specification.md`
- `backend/app/agent/coordinator.py`
- `backend/app/agent/workflow.py`
- `backend/app/agent/output_schemas.py`
- `backend/app/services/agent_flow_service.py`
- `backend/app/services/agent_conversation_service.py`
