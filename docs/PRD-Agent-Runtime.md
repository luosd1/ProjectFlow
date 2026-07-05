# PRD: ProjectFlow Agent Runtime 重构

## Problem Statement

ProjectFlow 的 Agent 能力目前由固定 `CoordinatorAgent` 模块驱动。虽然 clarify、plan、breakdown、assign、push、checkin、risk、replan 等模块已存在，但运行方式仍是固定流程触发，不是真正的工具化 Agent Runtime。这导致：

- 工具选择逻辑固定，不能自然扩展为多工具循环。
- 业务模块和 runtime 调度耦合。
- 事件粒度不够表达 tool lifecycle。
- 没有统一 capability manifest、policy gate、trace envelope。
- Pre-S9 Agent flows could modify `Task.status` through `CheckInAnalysisOutput.task_updates`, bypassing human confirmation.
- Read path 中 `_catch_up_stage_progress()` 在 GET 时隐式推进 Stage/Project。
- Risk/ActionCard 创建与 Primary Project State 修改之间的边界不清晰。

## Solution

建立 ProjectFlow 自己的 Agent 底座：TypeScript Agent Bridge Sidecar + Pi 组件级 Runtime + ProjectFlow Tool Contract + Durable AgentRunState + Proposal-Confirm Commit。

- Agent 能基于 WorkspaceState、Conversation、Timeline 自主选择 ProjectFlow 工具。
- 所有项目管理能力通过稳定 Tool Contract 暴露，不绑定任何 SDK 私有格式。
- FastAPI 和 DB 继续作为事实源和 commit 权限中心。
- 高影响写入必须先进入 Proposal，由人类确认后才由 FastAPI 确定性 commit。
- Runtime 执行过程可观测、可追踪、可回放、可测试。
- 旧 Coordinator 中的 schema、校验、fallback、AgentEvent、proposal persistence 迁移为工具后端资产。

## User Stories

1. As a 项目成员, I want Agent 能读取最新 WorkspaceState 后生成建议, so that 建议基于最新项目事实而不是会话记忆
2. As a 项目成员, I want Agent 调用工具时有明确的 policy gate 判断, so that 高影响操作不会被静默执行
3. As a 项目成员, I want 所有 Agent 生成的阶段计划、任务拆解、方向卡先进入 pending proposal, so that 我可以 review 后再确认应用
4. As a 项目成员, I want Agent 生成的 Risk 和 ActionCard 直接可见, so that 我能立即看到风险和行动建议而不需要额外确认步骤
5. As a 项目成员, I want Agent 推断的任务状态变化通过 replan proposal 呈现, so that 任务状态不会被 Agent 静默修改
6. As a 项目成员, I want 分工建议以 AssignmentProposal 形式创建, so that 推荐的 owner 不会直接写入 Task 直到我确认
7. As a 项目成员, I want 高严重度 Risk 的 mitigation 如果涉及任务/阶段变更必须走 proposal 确认, so that 主事实变更始终经过人类审批
8. As a 项目成员, I want 每次 Agent run 的执行过程有完整 timeline, so that 我能看到 Agent 读取了什么、调用了什么工具、生成了什么结果
9. As a 项目成员, I want proposal 确认/拒绝后有明确的产品事件, so that timeline 完整记录决策过程
10. As a 项目成员, I want Agent run 超时或取消时有结构化错误记录, so that 失败原因可追溯
11. As a 项目成员, I want 我可以取消正在执行的 Agent run, so that 不需要等待超时
12. As a 项目成员, I want 同一个工具调用重试不会重复创建 proposal, so that 网络抖动不会产生重复数据
13. As a 项目成员, I want Agent 工具结果有大小限制, so that 模型上下文不会被单个工具的超大输出撑爆
14. As a 项目成员, I want Agent run 的预算（steps、tool calls、tokens）有上限, so that 无限循环或异常调用被自动终止
15. As a 项目成员, I want Dashboard 刷新不再隐式推进 Stage/Project 状态, so that 读操作和写操作语义一致
16. As a 项目成员, I want stale Stage/Project 状态有显式修复路径, so that seed 数据或手动 DB 编辑后的状态不一致可以被正确修复
17. As a 项目成员, I want Agent 的 check-in 分析不再直接修改 Task.status, so that 任务状态变更始终经过确认
18. As a 项目成员, I want 每个 tool call 恰好产生一个结构化 terminal result, so that 模型始终收到明确的 observation
19. As a 项目成员, I want tool result 包含 side_effect_status 和 links, so that 我知道这个工具调用产生了什么持久化效果
20. As a 项目成员, I want Agent conversation 有持久化的消息记录, so that 上下文可以在 run 之间保持
21. As a 项目成员, I want 前端能展示 Agent 正在调用哪个工具、工具进度如何, so that 我知道 Agent 在做什么
22. As a 项目成员, I want proposal 确认后前端立即反映最新项目状态, so that 不需要手动刷新
23. As a 开发者, I want internal tool endpoint 统一使用 POST JSON body, so that 读写语义由 manifest 而非 HTTP 方法决定
24. As a 开发者, I want tool manifest 包含 execution mode、concurrency group、privacy、resume policy, so that harness 可以自动化执行策略
25. As a 开发者, I want AgentRunState 是可序列化的 durable state, so that sidecar 重启后 FastAPI 仍能查询最后状态
26. As a 开发者, I want event_seq 由 FastAPI 按 run_id 单调分配, so that 前端 timeline 和 replay 有序
27. As a 开发者, I want 旧 Coordinator flow 迁移时有 parity test 覆盖, so that 迁移不破坏现有行为
28. As a 开发者, I want sidecar 不持有 DB 凭据, so that 安全边界清晰
29. As a 开发者, I want trace 默认不记录 raw prompt、raw tool payload、provider headers, so that 敏感数据不泄露
30. As a 开发者, I want tool 的 idempotency key 是 (run_id, tool_call_id, tool_name, tool_version), so that 重试安全
31. As a 开发者, I want proposal tool 的 side effect status 在 FastAPI 持久化成功后才返回 success, so that 模型不会误以为 proposal 已创建
32. As a 开发者, I want `unknown` side effect status 禁止自动 fallback, so that 部分成功的副作用被人工处理
33. As a 开发者, I want manifest version 不兼容时触发重新生成或人工处理, so that resume 不会用过期的 tool schema
34. As a 开发者, I want skills 采用 metadata-first 渐进加载, so that 上下文不会一次塞入所有参考资料
35. As a 开发者, I want ProjectFlow event 统一格式包含 run_id、event_seq、conversation_id、project_id、workspace_id, so that 事件可跨维度关联
36. As a 开发者, I want LLM-callable tool manifest 不包含 commit effect type, so that 模型不可能通过工具直接提交 Primary Project State
37. As a 开发者, I want policy denied 返回 status=blocked 而非抛异常, so that 模型收到结构化 observation 而非崩溃
38. As a 开发者, I want provider 侧 parallel tool calls 只在所有暴露工具全是 read-only 且 manifest 允许时才开启, so that 写操作不会并行执行

## Implementation Decisions

### 1. 系统边界

**Frontend**: 发起 Agent run、展示 conversation、runtime status、token stream、tool timeline、proposal preview、confirm/reject。不依赖 Pi 原生 event，不直接调用 sidecar 工具，不决定 commit 结果。

**FastAPI Core**: 持有 DB 事实源，组装 WorkspaceState，暴露 internal tool endpoints，管理 AgentConversation/Message/Run/Event/Proposal 生命周期，执行 confirm/reject/commit。不承担 multi-tool Agent loop，不绑定 Pi SDK 类型。

**Agent Bridge Sidecar**: 初始化 Pi model/provider，创建和恢复 runtime session，注册 ProjectFlow tools，加载 skills，执行 policy gate，执行 result normalization，映射 Pi event 为 ProjectFlow event，维护 trace envelope。不直接访问数据库，不提交业务状态，不注册 shell/file tools。

**Pi Components**: 使用 `@earendil-works/pi-ai` 和 `@earendil-works/pi-agent-core`。不嵌入完整 `pi-coding-agent`。

### 2. Tiered Write Boundary

LLM-callable tool 按写入效果分层：

| 层级 | 含义 | LLM-callable tool |
|---|---|---|
| Runtime Metadata | conversation、message、run、run state、event、trace、tool result | 可通过 FastAPI internal endpoint 写 |
| Reviewable Draft Record | pending AgentProposal、typed AssignmentProposal | 可创建，不可 confirm/commit |
| Advisory Project Record | Risk（任意 severity）、ActionCard | 可在 manifest 允许时幂等创建 |
| Primary Project State | Project direction/status/current stage、Stage、Task、finalized owner/status/date | 不可直接写 |

### 3. Read Path Purity

- `get_project_state`、`get_workspace_state`、`get_timeline_slice` 只能返回 Read-Only State View。
- 移除 `get_project_state()` 中的 `_catch_up_stage_progress()`。
- `try_advance_stage()` 保留在人类 command path（`POST /tasks/{task_id}/status-updates`）。
- Stale Stage/Project 修复通过显式 State Repair Command / maintenance job。

### 4. AgentRunState

Durable state 持久化在 FastAPI DB，sidecar 只能通过 internal endpoint 提交 patch。

状态机：
```
created -> context_building -> model_streaming -> tool_preparing -> tool_running -> persisting_tool_result -> model_streaming -> completed
any active state -> cancelling -> cancelled
any active state -> failed
```

最低字段：schema_version, run_id, conversation_id, workspace_id, project_id, status, current_turn, current_step, model, pending_tool_call, side_effects, last_event_seq, resume_policy。

### 5. Runtime API

FastAPI 调 sidecar：
- `POST /runs`
- `POST /runs/{run_id}/cancel`
- `GET /runs/{run_id}`
- `GET /health`

Sidecar 调 FastAPI：
- `POST /internal/agent-runs/{run_id}/events:append`

Append API 是 runtime append 的收敛合同：一次请求携带 state patch、events、tool results，FastAPI 在同一事务里分配 event_seq、写入 AgentEvent、持久化 tool result。

### 6. Tool Contract

每个工具必须有 capability manifest，包含：schema_version, name, version, description, risk_category, model_callable, human_triggered_only, read_only, destructive, idempotent, open_world, timeout_ms, execution (mode, concurrency_group, max_concurrency, provider_parallel_tool_calls_allowed), retry, result_limit, backend (owner, endpoint), effects (effect_type, idempotency_key_required, replay_safe), proposal_confirmation, privacy, errors, resume, trace。

工具分类：
- read_only: 自动允许，可 parallel
- analysis: 自动允许 + trace
- draft_only: 允许生成 proposal，不允许 commit，必须 sequential
- advisory_write: 允许创建 advisory record，不允许改主事实，必须 sequential
- internal_write: 默认 sidecar-only
- destructive: LLM-callable 禁用
- open_world: 默认禁用

### 7. Tool Result

统一 result 结构：status (success/blocked/failed/aborted/timeout/validation_error), data, error (code/reason/message/details), side_effect_status, idempotency_key, links (agent_event_id/agent_run_id/proposal_id/created_ids), observation, trace。

LLM-callable tool 不应返回 `commit_persisted`。

### 8. Internal Tool Endpoints

前缀 `/internal/agent-tools/*`。首批 endpoints：
- `POST /internal/agent-tools/workspace-state`
- `POST /internal/agent-tools/conversation`
- `POST /internal/agent-tools/pending-proposals`
- `POST /internal/agent-tools/timeline-slice`
- `POST /internal/agent-tools/direction-card-proposal`
- `POST /internal/agent-tools/stage-plan-proposal`
- `POST /internal/agent-tools/task-breakdown-proposal`
- `POST /internal/agent-tools/assignment-recommendation`
- `POST /internal/agent-tools/checkins-and-risks-analysis`
- `POST /internal/agent-tools/replan-proposal`

统一接收 run_id, tool_call_id, conversation_id, workspace_id, project_id, tool_name, tool_version, manifest_version, idempotency_key, arguments, client_event_id, ordering_hint, trace。统一返回 ProjectFlowToolResult。

### 9. Event Bridge

Pi event 统一映射为 ProjectFlow event：agent.started, agent.status, agent.delta, agent.completed, agent.failed, tool.started, tool.progress, tool.completed, tool.blocked, tool.failed, proposal.created, advisory_record.created, proposal_confirmation.confirmed/rejected/committed, run.state_changed, runtime.error。

event_seq 由 FastAPI append API 按 run_id 单调分配。

### 10. Trace Envelope

每个 run/tool call/proposal 都必须能串起来：run_id, conversation_id, workspace_id, project_id, tool_call_id, tool_name, tool_version, provider, model, run_state, event_seq, latency_ms, budget, policy, result, privacy, links。默认不保存 raw prompt、raw tool input/output、provider headers。

### 11. Policy Engine

默认策略：read_only → allow, analysis → allow+trace, draft_only → allow proposal only, advisory_write → allow advisory record only, internal_write → block unless sidecar-only, destructive → block, open_world → block, human_triggered_only → block。

policy 失败返回结构化 observation，不抛异常。

### 12. Budget / Timeout / Cancel

每个 run 包含 max_steps, max_tool_calls, max_runtime_duration, max_output_tokens, max_tool_result_bytes, per_tool_timeout。cancel 由 FastAPI 或前端触发，cancel 后仍写 terminal AgentRunState 和 event。

### 13. 旧 Coordinator 迁移

| 旧能力 | 新工具 |
|---|---|
| `generate_direction_card` | `generate_direction_card_proposal` |
| `generate_stage_plan` | `generate_stage_plan_proposal` |
| `generate_task_breakdown` | `generate_task_breakdown_proposal` |
| `recommend_assignments` | `recommend_assignment` |
| `analyze_checkin` + `analyze_risks` | `analyze_checkins_and_risks` |
| `replan` | `generate_replan_proposal` |

保留：输出 schema、reference validation、normalize_user_facing_text、fallback payload、provider error classification、AgentEvent logging、proposal persistence、assignment/risk/action-card 服务链。

迁移 blockers：
- `CheckInAnalysisOutput.task_updates` → 不再调 `create_status_update()`，改走 replan proposal。
- `RiskAnalysisOutput.requires_confirmation` → 改为 mitigation confirmation 语义，不阻止 advisory Risk row 创建。

删除条件：每条生产路径有 parity tests，sidecar path 已稳定替代旧 path。

### 14. Skills

首批 Skills：project-intake, project-planning, task-breakdown, assignment-planning, risk-replan, project-status。

加载规则：启动时只暴露 skill metadata（name, description, location, allowed-tools）；匹配任务后才加载 SKILL.md；references 按引用逐个加载。

### 15. Sidecar 目录结构

```
agent-bridge/
  src/
    runtime/        # pi-runtime, model-router, session-store, run-state, context-builder
    tools/          # registry, manifest, fastapi-client, result-normalizer
    skills/         # skill-index, skill-loader
    policy/         # policy-engine, budget, proposal-boundary, advisory-boundary
    events/         # event-mapper, trace-envelope, stream
    server/         # routes, health, config
```

### 16. Internal Trust Boundary

- Sidecar 只接受 FastAPI 内部调用。
- Sidecar 调 FastAPI internal API 使用 service-to-service token。
- Sidecar 不持有用户 session cookie。
- Internal tool endpoint 做 project/workspace/user permission check。
- 所有 tool input/output 默认敏感数据处理。

## Testing Decisions

### 测试分层

**Contract Tests** — 验证 tool manifest、schema 转换、side effect 边界：
- manifest 字段完整且可转换为 Pi tool schema
- read-only tool 无副作用（不 session.add/delete、不 flush/commit、不调用写入服务）
- draft-only tool 只能创建 proposal
- LLM-callable ToolManifest 不包含 commit effect type
- internal tool endpoints 全部 POST JSON body
- snake_case API payload 与 sidecar TS shape 有转换测试
- execution mode、concurrency group、privacy、resume policy 必填且被 harness 执行
- provider parallel tool calls 只在 manifest 允许时打开
- read-only public GET / internal tool 不推进 Stage/Project，不执行 stale-state repair

**Run State Tests** — 验证状态机转换：
- 每个 state transition 合法
- cancel 从任意 active state 进入 cancelled
- timeout 写入 failed 或 timeout terminal result
- manifest version mismatch 触发 regenerate/manual handling
- sidecar 重启后 FastAPI 仍能查询最后 run state

**Transaction / Idempotency Tests** — 验证幂等和事务边界：
- 同一 idempotency key 重试不重复创建 proposal
- recommend_assignment 重试不重复创建 AssignmentProposal
- high-severity Risk 创建是 advisory write，mitigation 主事实变化才创建 replan proposal
- Agent check-in task update 不调用 create_status_update()
- FastAPI append API 按 run_id 分配单调 event_seq
- state patch、event append、tool result 同一事务提交
- tool success observation 只在 FastAPI 持久化成功后返回
- unknown side effect status 禁止自动 fallback
- repeated confirm 幂等
- rejected proposal 不执行 commit

**Parity Tests** — 每条旧 flow 迁移时验证：
- 输出 schema
- reference validation
- fallback 行为
- AgentEvent 记录
- proposal payload
- created domain IDs
- frontend artifact 显示

**Safety Tests** — 验证安全边界：
- sidecar 不能直接访问 DB
- LLM-callable tools 不包含 confirm/reject/commit
- shell/file/delete tools 不注册
- trace 默认不包含 raw prompt、raw tool payload、provider headers
- internal endpoints 不因 sidecar 来源跳过权限校验

**Product Tests** — 验证前端集成：
- 用户能看到 Agent 正在读取状态、调用工具、生成 proposal
- proposal 能确认或拒绝
- confirm 后业务状态真实更新
- timeline 能关联 run、tool、event、proposal
- sidecar 失败时 fallback path 清晰

### 测试 Prior Art

- 现有 `test_project_state_endpoint.py` — 聚合 state route 测试
- 现有 `test_nplus1_workspace_state.py` — WorkspaceState N+1 测试
- 现有 `test_agent_proposal_confirm.py` — proposal 确认流程测试
- 现有 `test_replan_proposal_flow.py` — replan proposal 流程测试
- 现有 `test_assignment_flow.py` — 分工流程测试
- 现有 `test_agent_output_schemas.py` — Agent 输出 schema 测试
- 前端使用 `../scripts/npm run test` / `lint` / `build`

## Out of Scope

- 完整 Pi coding-agent host 集成
- ToolExecutionApproval 当前实现（保留为未来扩展点）
- Open-world connectors、shell/file tools、destructive tools
- Sidecar 直接访问 DB
- 替换 FastAPI 作为事实源
- 重新辩论 OpenAI Agents SDK vs Pi 作为主 runtime
- 完整多 Agent role-play
- 新增 ADR（除非出现真正的全新不可逆决策）

## Further Notes

### 实施切片顺序

1. 定义 schemas：AgentRunState、manifest、tool result、side effect status、event schema、trace envelope
2. FastAPI append/persistence path：internal run/event/tool-result append API with idempotency
3. Sidecar skeleton + Pi runtime adapter：mock provider/tool loop, cancel/timeout, policy gate
4. Read-only purity + State Repair Command：移除 read-path catch-up，增加显式 repair path/tests
5. Read-only tools：workspace state, conversation, pending proposals, timeline slice
6. 第一个 proposal tool：direction or stage plan proposal with idempotency and confirmation visibility
7. Advisory write tool path：Risk/ActionCard advisory records with created IDs
8. Typed assignment proposal tool path：create AssignmentProposal, keep final owner human-confirmed
9. Check-in/replan migration：route inferred task status changes through replan proposal
10. Event bridge + trace envelope：product timeline events from runtime/tool/proposal/advisory flows
11. Frontend integration：stream/timeline/proposal/advisory state presentation
12. Legacy Coordinator parity + cutover：migrate remaining flows only after parity/idempotency/safety tests

Progress note (2026-07-06): S3, S5, S6, S7, S8, S9, S10, S12, S13, S14, and S16 are implemented. The current tool registry includes read-only state/timeline tools, draft-only stage plan/direction card/task breakdown/replan tools, typed assignment recommendation, and advisory check-in/risk analysis. FastAPI internal agent-tools and agent-runs endpoints require service-token auth, and tool denial/not-found/crash paths return structured terminal `ProjectFlowToolResult` records.

### 安全约束

- 不发布 npm 包或部署生产资源
- 不删除旧 Coordinator 代码直到 parity/cutover criteria 包含
- 不提交 vendor imports 到 Git
- 密钥、provider API keys、raw prompts、raw tool payloads、provider headers 不进入 traces 和 issue
