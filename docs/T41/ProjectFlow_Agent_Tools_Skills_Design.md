# ProjectFlow Tools & Skills 设计

> 本文设计 ProjectFlow Agent 的工具契约和技能体系。
> Agent 底座、sidecar、runtime loop、event bridge 见 `ProjectFlow_Agent_Runtime_Foundation_Design.md`。

---

## 1. 设计目标

Tools 和 Skills 是 ProjectFlow Agent 的业务能力边界：

- Tools 是可执行的原子业务操作。
- Skills 是按需加载的项目管理流程知识。
- Tool Contract 必须稳定，不能绑定某个 runtime 私有格式。
- Skills 不能直接写业务状态，只能指导 Agent 如何选择工具和组织结果。
- 所有高影响写入必须通过 Proposal-Confirm。
- 每个 tool call 必须产生一个模型可见 terminal result。
- Tool execution policy 必须由 manifest 驱动，不由模型自行判断。

---

## 2. Tool Contract 总则

每个 tool 必须满足：

- 窄类型化；
- schema 明确；
- owner 明确；
- risk category 明确；
- model-callable 范围明确；
- result bounded；
- 每次调用可追踪；
- 错误是结构化 observation；
- 不绕过 FastAPI；
- execution mode、privacy、resume policy 明确；
- side effect status 明确。

禁止工具：

- `execute_sql`
- `execute_shell`
- `edit_file`
- `delete_anything`
- `call_any_url`
- `commit_project_state`
- `confirm_proposal`

---

## 3. Capability Manifest

标准 manifest：

Canonical wire format：manifest YAML、HTTP JSON body、FastAPI response 一律使用 `snake_case`。下面的 TypeScript interface 是 sidecar 内部 shape，允许 camelCase，但必须由生成代码或 adapter 与 wire payload 互转。

```ts
export type ToolRiskCategory =
  | "read_only"
  | "analysis"
  | "draft_only"
  | "internal_write"
  | "destructive"
  | "open_world";

export interface ProjectFlowToolManifest {
  schemaVersion: number;
  name: string;
  version: number;
  description: string;
  riskCategory: ToolRiskCategory;
  modelCallable: boolean;
  sidecarOnly: boolean;
  humanTriggeredOnly: boolean;
  annotations: {
    readOnly: boolean;
    destructive: boolean;
    idempotent: boolean;
    openWorld: boolean;
  };
  inputSchema: unknown;
  outputSchema: unknown;
  execution: {
    mode: "parallel" | "sequential";
    concurrencyGroup?: string;
    maxConcurrency: number;
    providerParallelToolCallsAllowed: boolean;
  };
  timeoutMs: number;
  retry: {
    maxAttempts: number;
    retryOn: string[];
  };
  resultLimit: {
    maxBytes: number;
    redaction: "none" | "secrets" | "pii";
  };
  backend: {
    owner: "fastapi";
    endpoint: string;
    method: "POST";
  };
  effects: {
    effectType:
      | "none"
      | "event_write"
      | "proposal_create"
      | "runtime_metadata_write";
    idempotencyKeyRequired: boolean;
    replaySafe: boolean;
  };
  toolApproval: {
    requiredBeforeExecution: boolean;
    approvalScope?: "none" | "tool_call";
  };
  proposalConfirmation?: {
    createsProposal: boolean;
    requiredBeforeCommit: boolean;
    publicActionOnly: boolean;
    resumesModelLoopByDefault: false;
  };
  privacy: {
    dataClassification: "public" | "project_sensitive" | "secret";
    traceIncludeInputs: boolean;
    traceIncludeOutputs: boolean;
  };
  errors: {
    modelVisibleErrorPolicy: "normalized_summary" | "redacted" | "none";
  };
  resume: {
    manifestVersion: number;
    incompatibleVersionPolicy: "regenerate" | "manual_review" | "fail";
  };
  trace: {
    emits: string[];
  };
}
```

LLM-callable `ProjectFlowToolManifest` 不允许 commit effect type。需要描述人类动作时，使用 `HumanActionManifest` 或 FastAPI public action contract，不进入 LLM tool registry。

MCP-compatible annotations 一开始就纳入 manifest：

| Annotation | ProjectFlow 含义 |
|---|---|
| `readOnly` | 不产生业务副作用 |
| `destructive` | 不可逆或高影响操作，LLM-callable 禁用 |
| `idempotent` | 可安全重试 |
| `openWorld` | 访问外部服务，默认禁用 |

### 3.1 Execution Policy

| 工具类型 | `execution.mode` | provider parallel tool calls | 默认 concurrency group |
|---|---|---|---|
| read_only | `parallel` | allowed if every exposed tool is read-only | none |
| analysis | `parallel` if no write, otherwise `sequential` | only for no-write analysis | `project_analysis` |
| draft_only / proposal | `sequential` | false | `project_proposal_write` |
| internal_write | `sequential` | false | `agent_runtime_write` |
| destructive | not model-callable | false | none |
| open_world | disabled by default | false | connector-specific |

执行规则：

- 一批 tool calls 中只要存在 sequential 工具，整批按 sequential 执行。
- read-only 工具必须无副作用、可重放、结果有大小限制。
- proposal 工具必须带 idempotency key，重试不得重复创建 proposal。
- provider 侧 parallel tool calls 只能在当前暴露工具全是 read-only 且 manifest 允许时开启。
- `tool_not_found`、schema validation error、policy denied、tool approval rejected、timeout、aborted 都必须返回 terminal result。
- terminal result status 固定为 `success`、`blocked`、`failed`、`aborted`、`timeout`、`validation_error`；policy denied 写入 `error.code=POLICY_DENIED` 和 `error.reason`，不是一种 status。

### 3.2 Privacy / Resume Policy

- manifest payload 中 `trace_include_inputs` 和 `trace_include_outputs` 默认 false，adapter 映射到 sidecar 内部 TS 字段。
- raw prompt、raw tool input/output、provider headers 默认不进入 AgentEvent。
- paused run / pending tool approval 必须记录 manifest version、tool schema version、proposal payload schema version。
- resume 时版本不兼容，按 manifest payload 的 `incompatible_version_policy` 处理，默认重新生成。
- Tool input/output 只允许 JSON-safe schema，不反序列化任意 class/object。

---

## 4. 首批工具

### 4.1 `get_workspace_state`

用途：读取最新 ProjectFlow 工作区状态。

Manifest：

```yaml
schema_version: 1
name: get_workspace_state
version: 1
risk_category: read_only
model_callable: true
read_only: true
destructive: false
idempotent: true
open_world: false
execution:
  mode: parallel
  max_concurrency: 4
  provider_parallel_tool_calls_allowed: true
effects:
  effect_type: none
  idempotency_key_required: false
  replay_safe: true
tool_approval:
  required_before_execution: false
  approval_scope: none
privacy:
  data_classification: project_sensitive
  trace_include_inputs: false
  trace_include_outputs: false
backend: POST /internal/agent-tools/workspace-state
```

Input：

```json
{
  "workspace_id": "workspace_xxx",
  "project_id": "project_xxx"
}
```

Output：`WorkspaceStateResponse` 的受限版本，去掉 secret 和不需要的 UI-only 字段。

### 4.2 `get_agent_conversation`

用途：读取当前 Agent conversation 的近期消息和 linked artifacts。

策略：

- read-only；
- 默认只返回最近 N 条；
- older history 通过 summary 或 timeline slice 补充。
- execution 默认 parallel；
- 不返回 secret 或 provider raw payload。

### 4.3 `list_pending_proposals`

用途：查询当前项目未处理 proposal，避免重复生成冲突方案。

策略：

- read-only；
- idempotent；
- output 必须包含 `proposal_id`、`proposal_type`、`status`、`created_at`、summary；
- 用于防止重复 proposal，必须在 proposal tools 前优先考虑。

### 4.4 `get_timeline_slice`

用途：读取近期 AgentEvent 和业务 timeline，帮助 Agent 理解刚发生过什么。

策略：

- read-only；
- result bounded；
- 支持 `since`, `limit`, `event_types`；
- `event_seq` 由 FastAPI 分配，必须可用于前端 timeline 和 replay。

### 4.5 `generate_direction_card_proposal`

用途：根据 WorkspaceState 和用户意图生成方向卡 proposal。

策略：

- draft_only；
- model-callable；
- 创建 `AgentProposal`；
- 不 commit 项目状态；
- execution 必须 sequential；
- effect type 是 `proposal_create`；
- idempotency key 是 `(run_id, tool_call_id, tool_name, tool_version)`。

后端复用：

- `CoordinatorAgent.generate_direction_card`
- `generate_structured_output`
- `validate_agent_output`
- `agent_flow_service._create_agent_proposal`

### 4.6 `generate_stage_plan_proposal`

用途：生成阶段计划 proposal。

策略：

- draft_only；
- model-callable；
- reference validation 必须开启；
- linked `AgentEvent` 必须存在；
- tool success observation 只能在 pending `AgentProposal` 持久化后返回；
- retry 命中同一 idempotency key 时返回已有 `proposal_id`。

### 4.7 `generate_task_breakdown_proposal`

用途：生成任务拆解 proposal。

策略：

- draft_only；
- model-callable；
- task references 必须能映射到阶段；
- 只写 proposal，不创建正式 task；
- side effect status 成功时必须是 `proposal_persisted`。

### 4.8 `recommend_assignment`

用途：生成分工建议。

策略需要收敛：

- 如果当前业务路径已经使用 assignment proposal，则保持 proposal 模式。
- 如果当前路径只是建议展示，则落 AgentEvent/artifact，不直接覆盖任务 owner。
- 不允许模型直接写 `task.owner_user_id`。
- 如果会写 AgentEvent/artifact，必须通过 FastAPI 幂等 endpoint。

### 4.9 `analyze_checkins_and_risks`

用途：分析 check-in、进度、阻塞和风险。

策略：

- analysis 或 draft_only，取决于是否写 Risk/ActionCard。
- 如果写入 Risk/ActionCard，必须通过 FastAPI service，且 trace linked created IDs。
- 不允许直接修改 task status。
- 如果只读分析可 parallel；如果创建 Risk/ActionCard，必须 sequential 并记录 created IDs。

### 4.10 `generate_replan_proposal`

用途：风险或延期后生成重排 proposal。

策略：

- draft_only；
- model-callable；
- high impact；
- 不 commit stage/task/date；
- 必须读取 pending proposals，避免重复或冲突 replan。

---

## 5. Human-triggered APIs

以下能力不注册为 LLM-callable tool：

- confirm proposal；
- reject proposal；
- commit proposal；
- delete proposal；
- direct task update；
- direct stage update；
- direct assignment overwrite。

这些只通过 FastAPI public API 由用户操作触发，属于 `proposal_confirmation` 或其他人类动作合同，不属于 LLM tool registry。

概念边界：

- `tool_approval` 是工具执行前审批，可能让 run 进入 `waiting_for_tool_approval`，批准后 resume model loop。
- `proposal_confirmation` 是 `AgentProposal` 的 confirm/reject/commit 生命周期，不默认 resume 当前 model loop。
- proposal 创建成功只产生 `proposal.created` 产品事件；用户 reject/commit proposal 时由 FastAPI 记录 proposal confirmation 事件。
- 如果用户拒绝 tool approval，sidecar 接收 rejection observation，不执行被拒绝的工具。
- 如果用户拒绝 proposal confirmation，不执行 commit；需要模型继续处理时由 FastAPI 发起新 run 并携带 rejection feedback。

---

## 6. Tool Result

统一 result：

```ts
export interface ProjectFlowToolResult<T = unknown> {
  status: "success" | "blocked" | "failed" | "aborted" | "timeout" | "validation_error";
  data?: T;
  error?: {
    code: string;
    reason?: string;
    message: string;
    details?: unknown;
  };
  sideEffectStatus:
    | "no_side_effect"
    | "event_persisted"
    | "proposal_persisted"
    | "commit_persisted"
    | "unknown";
  idempotencyKey?: string;
  links?: {
    agentEventId?: string;
    agentRunId?: string;
    proposalId?: string;
    createdIds?: string[];
  };
  observation: string;
  trace: {
    inputHash?: string;
    outputHash?: string;
    redacted: boolean;
  };
}
```

这个 TypeScript interface 是 sidecar 内部 shape；FastAPI JSON response 使用 `side_effect_status`、`idempotency_key`、`agent_event_id`、`proposal_id` 等 `snake_case` 字段。

`observation` 是返回给模型的短文本；`data` 是结构化结果；`links` 用于产品追踪。无论成功、阻断、失败、超时、取消、校验错误，都必须返回一个 terminal result。policy denied 使用 `status=blocked`，原因写入 `error.code` 和 `error.reason`。

LLM-callable tool 不应返回 `commit_persisted`；该 side effect status 只保留给 `HumanActionManifest` 或 FastAPI public action result。

错误映射：

| 场景 | `status` | `error.code` | side effect |
|---|---|---|---|
| 不存在工具 | `blocked` | `TOOL_NOT_FOUND` | `no_side_effect` |
| schema 错误 | `validation_error` | `INVALID_ARGUMENTS` | `no_side_effect` |
| policy 阻断 | `blocked` | `POLICY_DENIED` | `no_side_effect` |
| tool approval 被拒绝 | `blocked` | `APPROVAL_REJECTED` | `no_side_effect` |
| tool timeout | `timeout` | `TOOL_TIMEOUT` | depends on FastAPI status |
| provider/runtime abort | `aborted` | `CANCELLED` | depends on FastAPI status |
| FastAPI 事务失败 | `failed` | `FASTAPI_UNAVAILABLE` or domain code | `unknown` unless proven otherwise |

---

## 7. FastAPI Internal Tool Endpoints

建议前缀：

```text
/internal/agent-tools/*
```

首批 endpoints：

```text
POST /internal/agent-tools/workspace-state
POST /internal/agent-tools/conversation
POST /internal/agent-tools/pending-proposals
POST /internal/agent-tools/timeline-slice
POST /internal/agent-tools/direction-card-proposal
POST /internal/agent-tools/stage-plan-proposal
POST /internal/agent-tools/task-breakdown-proposal
POST /internal/agent-tools/assignment-recommendation
POST /internal/agent-tools/checkins-and-risks-analysis
POST /internal/agent-tools/replan-proposal
```

internal endpoint 统一接收：

```json
{
  "run_id": "run_xxx",
  "tool_call_id": "call_xxx",
  "conversation_id": "conv_xxx",
  "workspace_id": "workspace_xxx",
  "project_id": "project_xxx",
  "tool_name": "generate_stage_plan_proposal",
  "tool_version": 1,
  "manifest_version": 1,
  "idempotency_key": "run_xxx:call_xxx:generate_stage_plan_proposal:v1",
  "arguments": {},
  "client_event_id": "client_evt_xxx",
  "ordering_hint": 12,
  "trace": {
    "trace_include_sensitive_data": false
  }
}
```

统一返回 `ProjectFlowToolResult`。

endpoint 规则：

- 必须验证 service-to-service token。
- 必须执行 project/workspace/user permission check。
- 必须接收并执行 idempotency key。
- 全部 internal tool endpoint 都使用 POST 和统一 JSON body；read-only 语义由 manifest 的 `risk_category=read_only`、`read_only=true`、`effects.effect_type=none` 表达，不用 HTTP GET 表达。
- sidecar 只能提交 `client_event_id`、`idempotency_key` 或 `ordering_hint`；最终 `event_seq` 由 FastAPI append/persistence path 分配。
- 如果 tool endpoint 同时需要写 state patch、AgentEvent、tool result，必须通过 FastAPI runtime append service 在同一事务内完成；拆 endpoint 时也由 FastAPI 做原子、幂等落库。
- proposal endpoint 成功时必须返回 `proposal_id`。
- 如果事务状态未知，返回 `side_effect_status=unknown`，禁止 sidecar 自动 fallback。

---

## 8. 旧 Coordinator 到工具的迁移

迁移原则：

- 先包一层 internal endpoint，不立刻重写内部算法。
- 保留旧 schema validation 和 fallback。
- 保留 AgentEvent logging。
- 保留 proposal persistence。
- 给每个 tool 加 contract tests。
- 给 proposal/write-adjacent tool 加 idempotency tests。
- 给 side effect unknown 加 reconciliation tests。
- 等 sidecar path 稳定后，再重构 Coordinator 内部。

映射：

| Coordinator method | Tool |
|---|---|
| `generate_direction_card` | `generate_direction_card_proposal` |
| `generate_stage_plan` | `generate_stage_plan_proposal` |
| `generate_task_breakdown` | `generate_task_breakdown_proposal` |
| `recommend_assignments` | `recommend_assignment` |
| `analyze_checkin` | `analyze_checkins_and_risks` |
| `analyze_risks` | `analyze_checkins_and_risks` |
| `replan` | `generate_replan_proposal` |

---

## 9. Skills 定位

Skills 是程序性记忆，负责告诉 Agent “如何做 ProjectFlow 项目管理任务”。

Skills 不做：

- 直接写 DB；
- 直接定义新权限；
- 覆盖 Tool Contract；
- 存储项目真实状态；
- 包含 secret；
- 一次加载所有参考资料。
- 绕过 manifest 的 `allowed-tools`。

Skills 做：

- 描述触发场景；
- 选择工具；
- 规定流程；
- 规定输出质量标准；
- 规定不确定时如何提问或生成 proposal；
- 引用必要 rubrics/checklists。

加载规则：

- 启动时只暴露 skill metadata：`name`、`description`、`location`、`allowed-tools`。
- 只有当任务匹配 description 时才加载对应 `SKILL.md`。
- references/scripts 必须按 `SKILL.md` 的引用逐个加载，不能整个目录塞进上下文。
- skill name 使用小写字母、数字、连字符，最长 64 字符。
- description 最长 1024 字符，必须描述触发条件，而不是泛泛说明能力。
- `allowed-tools` 是可见约束：skill 不能调用未列出的 LLM-callable tool。

---

## 10. Skill 目录

建议 sidecar 内部 skill 目录：

```text
agent-bridge/skills/
  project-intake/
    SKILL.md
    references/intake-rubric.md
  project-planning/
    SKILL.md
    references/planning-rubric.md
  task-breakdown/
    SKILL.md
    references/breakdown-checklist.md
  assignment-planning/
    SKILL.md
    references/assignment-rubric.md
  risk-replan/
    SKILL.md
    references/risk-replan-playbook.md
  project-status/
    SKILL.md
```

Skill frontmatter 示例：

```yaml
---
name: project-planning
description: Use when the user wants ProjectFlow to turn a direction card or rough project goal into a staged project plan proposal using ProjectFlow tools.
allowed-tools:
  - get_workspace_state
  - list_pending_proposals
  - generate_stage_plan_proposal
references:
  - references/planning-rubric.md
---
```

`allowed-tools` 只限制模型可调用工具；confirm/reject/commit 仍只能由用户通过 FastAPI public API 触发。

---

## 11. 首批 Skills

### 11.1 `project-intake`

触发：

- 项目目标模糊；
- 用户说“帮我梳理方向”；
- 缺少 direction card。

工具：

- `get_workspace_state`
- `list_pending_proposals`
- `generate_direction_card_proposal`

结果：

- 如果信息不足，先问澄清问题。
- 如果足够，生成 direction card proposal。

### 11.2 `project-planning`

触发：

- 已有项目方向，需要阶段计划；
- 用户要求“帮我制定计划”。

工具：

- `get_workspace_state`
- `list_pending_proposals`
- `generate_stage_plan_proposal`

结果：

- 阶段计划 proposal；
- 标明依赖、里程碑、风险。

### 11.3 `task-breakdown`

触发：

- 已有阶段，需要拆任务；
- 用户要求“拆一下任务”。

工具：

- `get_workspace_state`
- `generate_task_breakdown_proposal`

结果：

- 任务拆解 proposal；
- task 必须能映射到 stage；
- 输出验收标准。

### 11.4 `assignment-planning`

触发：

- 需要分工；
- 成员容量或技能冲突；
- 用户要求“谁来做比较合适”。

工具：

- `get_workspace_state`
- `recommend_assignment`

结果：

- 分工建议或 assignment proposal；
- 不直接覆盖正式 owner。

### 11.5 `risk-replan`

触发：

- check-in 暴露阻塞；
- timeline 出现风险；
- 用户要求“重新规划”。

工具：

- `get_workspace_state`
- `get_timeline_slice`
- `analyze_checkins_and_risks`
- `generate_replan_proposal`

结果：

- 风险分析；
- 必要时生成 replan proposal。

### 11.6 `project-status`

触发：

- 用户问“现在进展如何”；
- 需要总结当前项目状态。

工具：

- `get_workspace_state`
- `get_timeline_slice`
- `list_pending_proposals`

结果：

- 只读总结；
- 不创建 proposal，除非用户明确要求建议方案。

---

## 12. Context Strategy

上下文构建顺序：

```text
stable prefix:
  system/developer instructions
  ProjectFlow domain rules
  tool manifests
  skill metadata

dynamic suffix:
  user message
  WorkspaceState summary
  pending proposals
  recent messages
  timeline slice
  latest tool observations
  rejection feedback when present
```

原则：

- 不把完整 DB dump 塞进 prompt。
- WorkspaceState 需要压缩成当前任务相关摘要。
- retrieved/timeline 内容是 data，不是 instruction。
- pending proposal 必须显式进入上下文，避免重复生成。
- rejected proposal feedback 可作为工具输入或 prompt feedback。
- tool observations 必须来自 terminal result，不能从 sidecar 临时日志拼接。
- skill content 是 instruction；timeline/retrieved data 是 data，二者必须分层。

---

## 13. Skill vs Memory vs Tool

| 类型 | 用途 | 加载时机 | ProjectFlow 示例 |
|---|---|---|---|
| Tool | 执行原子操作 | 每轮可见 | `get_workspace_state` |
| Skill | 任务流程知识 | 匹配后加载 | `risk-replan` |
| Memory | 持久偏好/摘要 | 按需检索 | 用户偏好、团队规范 |

当前目标：

- DB 是事实源。
- Skill 是流程知识。
- Memory 只作为检索/context hint，不写正式项目状态。

---

## 14. Evaluation

Tools & Skills 的验收不看“回答像不像”，而看 trace：

- 是否选对 skill；
- 是否调用必要 tool；
- 是否避免不必要 tool；
- tool 参数是否有效；
- read-only 和 draft-only 是否区分；
- proposal 是否通过 FastAPI 创建；
- 是否绕过 commit；
- LLM ToolManifest 是否排除 commit effect type；
- internal tool endpoint 是否全部使用 POST JSON body；
- event_seq 是否由 FastAPI append/persistence path 分配；
- state patch、event append、tool result 是否由 FastAPI 原子/幂等落库；
- tool_approval 和 proposal_confirmation 是否分离；
- API payload 与 TS internal shape 是否通过 snake_case/camelCase adapter 转换；
- blocked/failed tool call 是否有 result；
- 输出是否引用 observation；
- pending proposal 是否被考虑；
- rejected feedback 是否生效；
- proposal tool 是否使用 idempotency key；
- write-adjacent tool 是否 sequential；
- provider parallel tool calls 是否只在 read-only 工具集开启；
- trace 是否默认不含 raw sensitive payload。

---

## 15. Test Matrix

| 场景 | 预期 |
|---|---|
| 模糊项目目标 | `project-intake` 提问或生成 direction proposal |
| 已有方向要求计划 | `project-planning` 生成 stage plan proposal |
| 已有阶段要求拆任务 | `task-breakdown` 生成 task breakdown proposal |
| 已有 pending proposal 再次请求同类方案 | 先提示 pending proposal，不盲目重复 |
| 用户要求直接确认 proposal | Agent 提示需用户操作，不调用 commit |
| 模型请求不存在工具 | 返回 `TOOL_NOT_FOUND` observation |
| 模型请求 confirm tool | 返回 `POLICY_DENIED` observation |
| tool timeout | timeline 有 `tool.failed`，模型收到 timeout observation |
| risk replan | 先读取 state/timeline，再生成 replan proposal |
| proposal tool 重试 | 返回同一个 `proposal_id`，不重复创建 |
| tool approval rejected | 不执行工具，返回 rejection observation |
| proposal confirmation rejected | 不执行 commit，不默认 resume model loop |
| manifest version mismatch on resume | 重新生成或转人工处理 |
| read-only batch | 允许 parallel |
| proposal batch | sequential，且 provider parallel tool calls disabled |

---

## 16. Implementation Order

1. 定义 manifest schema，包括 execution、effects、tool_approval、proposal_confirmation、privacy、resume。
2. 定义 tool result schema，包括 terminal status、side effect status、trace hash。
3. 为 read-only tools 增加 FastAPI internal endpoints。
4. 为 proposal tools 增加 FastAPI internal endpoints，内部先复用旧服务，并支持 idempotency key。
5. sidecar 注册 manifest 并转换为 Pi tools。
6. 实现 provider parallel tool calls gating。
7. 实现 ProjectFlow skills metadata loading。
8. 写首批 `SKILL.md`。
9. 增加 contract、idempotency、privacy、wire-format conversion、append atomicity tests。
10. 增加 skill selection/eval fixtures。
11. 逐条迁移旧 Coordinator flow。
