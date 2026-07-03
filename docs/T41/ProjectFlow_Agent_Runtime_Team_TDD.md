# ProjectFlow Agent 底座重构总方案

> 结论：ProjectFlow 应采用 **TypeScript Agent Bridge Sidecar + Pi 组件级 Runtime + ProjectFlow Tool Contract + Proposal-Confirm Commit**。
> 这是当前目标架构，不是临时过渡方案。实施可以按工具和业务流逐步切片验证，但架构边界从第一天就按最终形态设计。

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
- OpenAI Agents SDK、LangGraph、MCP、Pi coding-agent 只作为设计参考或后续 adapter 参考，不作为当前主 runtime。

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

每次 tool call 必须恰好产生一个 result。denied、timeout、validation_error、aborted 都是结构化 observation，不能静默吞掉。

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

## 6. ProjectFlow Tool Contract

每个工具必须有 capability manifest：

```yaml
name: generate_stage_plan_proposal
version: 1
risk_category: draft_only
model_callable: true
human_triggered_only: false
read_only: false
destructive: false
idempotent: false
open_world: false
timeout_ms: 120000
retry:
  max_attempts: 1
result_limit:
  max_bytes: 65536
backend:
  owner: fastapi
  endpoint: POST /internal/agent-tools/generate-stage-plan-proposal
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

## 7. Trace Envelope

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
  "latency_ms": 1234,
  "budget": {
    "max_steps": 8,
    "max_tool_calls": 6,
    "max_tokens": 12000
  },
  "policy": {
    "decision": "allow",
    "reason": null,
    "approval_id": null
  },
  "result": {
    "status": "success",
    "error_code": null,
    "input_hash": "sha256:...",
    "output_hash": "sha256:..."
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
- `approval.required`
- `runtime.error`

---

## 8. 旧 Coordinator 迁移规则

旧 Coordinator 不作为最终 runtime，但保留为迁移资产。

### 8.1 直接保留

- 输出 schema；
- reference validation；
- `_normalize_user_facing_text()`；
- fallback payload；
- provider error classification；
- AgentEvent logging；
- proposal persistence；
- assignment/risk/action-card/task-status 服务链。

### 8.2 需要封装

把固定模块封装为 internal tool backend：

| 旧能力 | 新工具 |
|---|---|
| `generate_direction_card` | `generate_direction_card_proposal` |
| `generate_stage_plan` | `generate_stage_plan_proposal` |
| `generate_task_breakdown` | `generate_task_breakdown_proposal` |
| `recommend_assignments` | `recommend_assignment` |
| `analyze_checkin` + `analyze_risks` | `analyze_checkins_and_risks` |
| `replan` | `generate_replan_proposal` |

### 8.3 删除条件

只有当每条生产路径都有 parity tests，并且 sidecar path 已稳定替代旧 path 后，才删除或缩小 Coordinator。

---

## 9. Delivery Slices

这是实施切片，不是架构版本。目标架构不变。

1. 定义 Tool Contract、Capability Manifest、Trace Envelope、Unified Event。
2. 在 FastAPI 增加 internal agent tool endpoints，但先复用旧服务。
3. 新增 TS sidecar skeleton，引入 `pi-ai` 和 `pi-agent-core`。
4. 实现 read-only tools：workspace state、conversation、proposal、timeline。
5. 实现 policy gate 和 event bridge。
6. 封装第一个 proposal tool，建议从 clarify 或 plan 开始。
7. 接入 frontend stream/timeline，但保持旧 path fallback。
8. 为每条迁移 flow 增加 parity tests。
9. 迁移 breakdown、assign、risk、replan。
10. 移除或缩小 Coordinator legacy adapter。

AI 辅助会降低实现成本，因此不需要因为“一次性写完风险”而压缩架构目标。真正要控制的是每个切片都能验证，且不能绕过 Proposal-Confirm。

---

## 10. 验证策略

### 10.1 Contract Tests

- manifest 字段完整；
- schema 可转换为 Pi tool schema；
- read-only tool 无副作用；
- draft-only tool 只能创建 proposal；
- human-triggered tool 不能被模型调用；
- denied tool call 产生结构化 result。

### 10.2 Parity Tests

每条旧 flow 迁移时必须比较：

- 输出 schema；
- reference validation；
- fallback 行为；
- AgentEvent 记录；
- proposal payload；
- created domain IDs；
- frontend artifact 显示。

### 10.3 Safety Tests

- sidecar 不能直接访问 DB；
- LLM-callable tools 不包含 confirm/reject/commit；
- shell/file/delete tools 不注册；
- repeated confirm 幂等；
- tool timeout 写入 trace；
- validation error 作为 observation 返回。

### 10.4 Product Tests

- 用户能看到 Agent 正在读取状态、调用工具、生成 proposal；
- proposal 能确认或拒绝；
- confirm 后业务状态真实更新；
- timeline 能关联 run、tool、event、proposal；
- sidecar 失败时 fallback path 清晰。

---

## 11. 文档拆分

本总方案只定义架构决策和实施边界。详细设计拆分为：

- [ProjectFlow Agent 底座设计](./ProjectFlow_Agent_Runtime_Foundation_Design.md)
- [ProjectFlow Tools & Skills 设计](./ProjectFlow_Agent_Tools_Skills_Design.md)

研究缓存：

- [Agent Runtime Vendor Research](../../vendor_imports/research/agent-runtime/ANALYSIS.md)

---

## 12. 参考依据

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
