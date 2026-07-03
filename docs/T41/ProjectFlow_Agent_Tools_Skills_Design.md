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
- 不绕过 FastAPI。

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

```ts
export type ToolRiskCategory =
  | "read_only"
  | "analysis"
  | "draft_only"
  | "internal_write"
  | "destructive"
  | "open_world";

export interface ProjectFlowToolManifest {
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
    method: "GET" | "POST";
  };
  emits: string[];
}
```

MCP-compatible annotations 一开始就纳入 manifest：

| Annotation | ProjectFlow 含义 |
|---|---|
| `readOnly` | 不产生业务副作用 |
| `destructive` | 不可逆或高影响操作，LLM-callable 禁用 |
| `idempotent` | 可安全重试 |
| `openWorld` | 访问外部服务，默认禁用 |

---

## 4. 首批工具

### 4.1 `get_workspace_state`

用途：读取最新 ProjectFlow 工作区状态。

Manifest：

```yaml
name: get_workspace_state
version: 1
risk_category: read_only
model_callable: true
read_only: true
destructive: false
idempotent: true
open_world: false
backend: GET /internal/agent-tools/workspace-state
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

### 4.3 `list_pending_proposals`

用途：查询当前项目未处理 proposal，避免重复生成冲突方案。

策略：

- read-only；
- idempotent；
- output 必须包含 `proposal_id`、`proposal_type`、`status`、`created_at`、summary。

### 4.4 `get_timeline_slice`

用途：读取近期 AgentEvent 和业务 timeline，帮助 Agent 理解刚发生过什么。

策略：

- read-only；
- result bounded；
- 支持 `since`, `limit`, `event_types`。

### 4.5 `generate_direction_card_proposal`

用途：根据 WorkspaceState 和用户意图生成方向卡 proposal。

策略：

- draft_only；
- model-callable；
- 创建 `AgentProposal`；
- 不 commit 项目状态。

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
- linked `AgentEvent` 必须存在。

### 4.7 `generate_task_breakdown_proposal`

用途：生成任务拆解 proposal。

策略：

- draft_only；
- model-callable；
- task references 必须能映射到阶段；
- 只写 proposal，不创建正式 task。

### 4.8 `recommend_assignment`

用途：生成分工建议。

策略需要收敛：

- 如果当前业务路径已经使用 assignment proposal，则保持 proposal 模式。
- 如果当前路径只是建议展示，则落 AgentEvent/artifact，不直接覆盖任务 owner。
- 不允许模型直接写 `task.owner_user_id`。

### 4.9 `analyze_checkins_and_risks`

用途：分析 check-in、进度、阻塞和风险。

策略：

- analysis 或 draft_only，取决于是否写 Risk/ActionCard。
- 如果写入 Risk/ActionCard，必须通过 FastAPI service，且 trace linked created IDs。
- 不允许直接修改 task status。

### 4.10 `generate_replan_proposal`

用途：风险或延期后生成重排 proposal。

策略：

- draft_only；
- model-callable；
- high impact；
- 不 commit stage/task/date。

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

这些只通过 FastAPI public API 由用户操作触发。
如果 sidecar 需要表达“需要确认”，只能发 `approval.required` / `proposal.created` event。

---

## 6. Tool Result

统一 result：

```ts
export interface ProjectFlowToolResult<T = unknown> {
  status: "success" | "denied" | "validation_error" | "tool_error" | "timeout" | "cancelled";
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  links?: {
    agentEventId?: string;
    agentRunId?: string;
    proposalId?: string;
    createdIds?: string[];
  };
  observation: string;
}
```

`observation` 是返回给模型的短文本；`data` 是结构化结果；`links` 用于产品追踪。

---

## 7. FastAPI Internal Tool Endpoints

建议前缀：

```text
/internal/agent-tools/*
```

首批 endpoints：

```text
GET  /internal/agent-tools/workspace-state
GET  /internal/agent-tools/conversation
GET  /internal/agent-tools/pending-proposals
GET  /internal/agent-tools/timeline-slice
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
  "arguments": {},
  "trace": {}
}
```

统一返回 `ProjectFlowToolResult`。

---

## 8. 旧 Coordinator 到工具的迁移

迁移原则：

- 先包一层 internal endpoint，不立刻重写内部算法。
- 保留旧 schema validation 和 fallback。
- 保留 AgentEvent logging。
- 保留 proposal persistence。
- 给每个 tool 加 contract tests。
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

Skills 做：

- 描述触发场景；
- 选择工具；
- 规定流程；
- 规定输出质量标准；
- 规定不确定时如何提问或生成 proposal；
- 引用必要 rubrics/checklists。

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
---
```

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
```

原则：

- 不把完整 DB dump 塞进 prompt。
- WorkspaceState 需要压缩成当前任务相关摘要。
- retrieved/timeline 内容是 data，不是 instruction。
- pending proposal 必须显式进入上下文，避免重复生成。
- rejected proposal feedback 可作为工具输入或 prompt feedback。

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
- denied/failed tool call 是否有 result；
- 输出是否引用 observation；
- pending proposal 是否被考虑；
- rejected feedback 是否生效。

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

---

## 16. Implementation Order

1. 定义 manifest schema。
2. 定义 tool result schema。
3. 为 read-only tools 增加 FastAPI internal endpoints。
4. 为 proposal tools 增加 FastAPI internal endpoints，内部先复用旧服务。
5. sidecar 注册 manifest 并转换为 Pi tools。
6. 实现 ProjectFlow skills metadata loading。
7. 写首批 `SKILL.md`。
8. 增加 contract tests。
9. 增加 skill selection/eval fixtures。
10. 逐条迁移旧 Coordinator flow。
