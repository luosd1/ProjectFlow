# 调研任务：ProjectFlow Project Memory V1 设计方案深度审查

你是一位同时熟悉 AI Agent runtime 架构、记忆系统和项目管理产品的资深架构师。请对 ProjectFlow 的 Project Memory V1 设计方案进行深度调研，给出可作为方案补充的改进建议。你的调研结果会被喂给另一个 AI Agent（基于 Claude），由它结合完整代码上下文对方案进行优化，所以请尽量提供具体、可执行、有优先级的建议，并引用具体的技术文档、开源项目对比和最佳实践。

---

## 一、ProjectFlow 项目背景

ProjectFlow 是面向大学生项目小队的**主动推进型 AI Agent**。核心价值不是"记录任务"，而是持续回答：项目该往哪走？下一步做什么？谁适合做什么？哪些有风险？计划是否需要调整？

技术栈：
- 前端：Next.js + React + TypeScript + Tailwind + shadcn/ui
- 后端：FastAPI + Python + SQLModel + SQLite（本地演示优先，零配置）
- Agent：legacy `CoordinatorAgent`（固定模块门面）→ 正在重构为 T41 Agent Runtime

当前 MVP 已闭环，能围绕方向卡、阶段计划、任务拆解、分工建议、行动卡、风险和巡检产物输出判断。但这些判断只依赖当前状态和最近一轮对话，存在"Agent 不知道当初为什么这么做"的致命问题。

---

## 二、T41 Agent Runtime 目标架构（记忆系统必须基于此底座）

**重要：T41 重构尚未全部完成，记忆系统是 T42 在 T41 完成后的功能增强。所以本调研必须以 T41 目标架构为基础，而不是 legacy Coordinator。**

### 2.1 架构总览

```
Frontend (Next.js)
  ↕ HTTP/SSE
FastAPI Core (Python)
  - DB 事实源 (SQLite/SQLModel)
  - WorkspaceState 组装
  - AgentProposal / AgentEvent / AgentRun 持久化
  - 确定性 commit services
  - internal tool endpoints
  ↕ service-to-service token
TypeScript Agent Bridge Sidecar
  - Pi runtime session (@earendil-works/pi-agent-core)
  - model/provider routing (@earendil-works/pi-ai)
  - ProjectFlow tool registry
  - ProjectFlow skills (渐进披露)
  - run state bridge
  - policy gate
  - trace envelope
  - event bridge
```

### 2.2 核心架构原则（记忆系统必须遵守）

1. **DB 是唯一事实源**：Agent memory、conversation history、skill context 都不能替代 DB 状态。每次关键 run 必须基于最新 WorkspaceState。

2. **Model 提议，Harness 执行**：模型只能提出工具调用和建议；Harness 负责参数校验、权限判断、工具执行、结果记录、错误归一化、observation 返回、trace 持久化。每次 tool call 必须恰好产生一个 terminal result。

3. **Draft 和 Commit 分离**：
   ```
   Agent tool call → generate draft/proposal → AgentProposal pending
     → user confirm/reject → FastAPI deterministic commit
   ```
   LLM-callable tools 不能 confirm、reject、commit。

4. **Tiered Write Boundary**（4 层写入边界）：
   | 层级 | 含义 | LLM-callable tool |
   |---|---|---|
   | Runtime Metadata | conversation、message、run、event、trace、tool result | 可通过 internal endpoint 写 |
   | Reviewable Draft Record | pending AgentProposal、typed domain proposal | 可创建，不可 confirm/commit |
   | Advisory Project Record | Risk、ActionCard（不改主事实） | 可在 manifest 允许时幂等创建 |
   | Primary Project State | Project direction/status/current stage、Stage、Task、finalized owner/status/date | 不可直接写 |

5. **Sidecar 是 runtime，不是业务后端**：Sidecar 管 runtime session、tool registry、model routing、policy hooks、event mapping；**不直接读写 DB，不保存核心业务状态，不绕过 FastAPI 服务**。

6. **Read-only state view 必须纯读**：`get_project_state`、`get_workspace_state`、timeline slice、read-only tools 不得修复或推进 Stage/Project；stale state 通过显式 State Repair Command / maintenance job 处理。

7. **Proposal Confirmation 是当前唯一人类确认边界**：`ToolExecutionApproval` 只是未来扩展，不进入当前 runtime state machine。

8. **Risk 任意 severity 都可以作为 Advisory Project Record 直接创建**；只有会修改 Task/Stage/Project/owner/date 的 mitigation 必须走 replan proposal confirmation。

9. **Agent 推断的 task status/date/owner/stage/mitigation 变化必须进入现有 `replan` proposal**，不新增 `TaskStatusChangeProposal`。

### 2.3 Durable AgentRunState

```
created → context_building → model_streaming → tool_preparing
  → tool_running → persisting_tool_result → model_streaming → completed

any active state → cancelling → cancelled
any active state → failed
```

- `AgentRunState` 持久化在 FastAPI DB，sidecar 只能通过 internal runtime endpoint 提交 patch
- `event_seq` 由 FastAPI 按 `run_id` 单调分配
- 同一 `(run_id, tool_call_id, tool_name, tool_version)` 必须幂等
- side effect status：`no_side_effect` / `event_persisted` / `proposal_persisted` / `advisory_record_persisted` / `commit_persisted` / `unknown`
- `unknown` side effect status 禁止自动 fallback

### 2.4 Tool Contract（manifest schema 摘要）

每个工具有 capability manifest，包含：
- `risk_category`: read_only / analysis / draft_only / advisory_write / internal_write / destructive / open_world
- `model_callable`: 是否可被 LLM 调用
- `execution.mode`: parallel / sequential
- `effects.effect_type`: none / event_write / proposal_create / advisory_record_create / runtime_metadata_write
- `proposal_confirmation`: creates_proposal / required_before_commit / resumes_model_loop_by_default=false
- `privacy`: data_classification / trace_include_inputs / trace_include_outputs
- `resume`: manifest_version / incompatible_version_policy

首批 10 个工具：
1. `get_workspace_state` (read_only)
2. `get_agent_conversation` (read_only)
3. `list_pending_proposals` (read_only)
4. `get_timeline_slice` (read_only)
5. `generate_direction_card_proposal` (draft_only)
6. `generate_stage_plan_proposal` (draft_only)
7. `generate_task_breakdown_proposal` (draft_only)
8. `recommend_assignment` (draft_only / typed proposal)
9. `analyze_checkins_and_risks` (analysis / advisory_write)
10. `generate_replan_proposal` (draft_only)

confirm/reject/commit 不是 LLM-callable tool，只能由人类通过 FastAPI public API 触发。

### 2.5 Skills 系统（渐进披露）

- 启动时只暴露 skill metadata：name、description、location、allowed-tools
- 匹配任务后才加载 `SKILL.md`
- references/scripts 按引用逐个加载
- `allowed-tools` 是硬约束：skill 不能调用未列出的 LLM-callable tool

6 个 skill：project-intake / project-planning / task-breakdown / assignment-planning / risk-replan / project-status

### 2.6 Context Strategy（上下文构建）

```
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

原则：不把完整 DB dump 塞进 prompt；WorkspaceState 压缩成当前任务相关摘要；retrieved/timeline 内容是 data，不是 instruction；skill content 是 instruction；tool observations 必须来自 terminal result。

### 2.7 Event Bridge + Trace Envelope

Pi event 映射为 ProjectFlow events：
- `agent.started` / `agent.delta` / `agent.completed` / `agent.failed`
- `tool.started` / `tool.completed` / `tool.failed` / `tool.blocked`
- `proposal.created` / `advisory_record.created`
- `proposal_confirmation.confirmed` / `rejected` / `committed`
- `run.state_changed` / `runtime.error`

Trace envelope 串起 run/tool/proposal 关联，默认不含 raw prompt/tool input/output/provider headers。

### 2.8 T41 当前进度（截至 2026-07-05）

已完成并验收（193 sidecar tests pass）：
- S3: Sidecar skeleton + Pi runtime adapter + mock tool loop
- S5: Read-only tools（4 个 internal endpoints）
- S14: Skills 系统（6 个 SKILL.md）
- S16: Debug raw payload mode
- S1 部分：AgentRunV2 模型、runtime schemas
- S2 部分：`POST /internal/agent-runs/{run_id}/events:append`（in-process idempotency cache，生产需 Redis）

待完成：
- S6/S7: Stage plan / task breakdown proposal tools
- S8: Assignment proposal tool
- S9: Check-in/replan migration（`CheckInAnalysisOutput.task_updates` 改走 replan proposal）
- S10: Event bridge + trace envelope
- S11: Frontend integration
- S12: Parity tests
- S13: 其他 proposal tools
- S15: Unit + evaluation + privacy/resume tests

### 2.9 当前 backend 关键模型（legacy + T41 共存，已核对源码）

- `AgentEvent`（`backend/app/models/timeline.py`）：`event_type: AgentEventType`、`status: AgentEventStatus`、`input_snapshot`、`output_snapshot`、`reasoning_summary`、`user_confirmed`、`created_at`。**`AgentEventType` 枚举只有 `clarify/plan/breakdown/assign/negotiate/push/checkin/risk/replan/export/retrospective`，没有 `direction`、`memory`、`proposal_rejected` 等类型**——新增记忆相关事件需要扩枚举。
- `AgentProposal`（`backend/app/models/agent_proposal.py`）：`proposal_type` 只有 `clarify|plan|breakdown|replan`（**没有 `direction` 类型**），`status: pending|confirmed|rejected`，`payload`（JSON string）、`agent_event_id`、`confirmed_by`、`confirmed_at`、`rejection_reason`。
- `AgentConversation` / `AgentMessage` / `AgentRun`（legacy，`agent_conversation.py`）+ `AgentRunV2` / `AgentRunStatePatch`（T41，`agent_run_state.py`）。
- `AssignmentProposal`（`assignment.py`）：独立 typed proposal，status 含 `finalized`，有 `finalize_assignment_proposal()` / `finalize_assignment_proposals_by_stage()`。
- `Risk`（`risk.py`）：`RiskType` = `deadline/dependency/workload/scope/review/assignment/checkin`，必须有 evidence；`RiskSeverity`、`RiskStatus` 独立。
- `ActionCard`（`action_card.py`）：`ActionCardType` / `ActionCardStatus` 独立。
- `TaskStatusUpdate`（`task.py`）：legacy 链路会改 `Task.status` 并触发 stage 推进（T41 需改走 replan proposal）。

legacy `agent_flow_service._persist_agent_output()` 包含三类副作用：
- `AssignmentRecommendationOutput` → 创建 AssignmentProposal（typed proposal）
- `RiskAnalysisOutput` / `ActivePushOutput` → 创建 Risk/ActionCard（advisory write）
- `CheckInAnalysisOutput.task_updates` → 调用 `create_status_update()`（**T41 必须改为 replan proposal**）

### 2.10 V3 假设的 4 类正式事件在当前代码里的实际落点（关键对齐事实）

V3 方案把记忆抽取挂在 4 类"正式项目事件"上，但当前代码里这些事件的形态和 V3 假设有出入。**这是本次调研必须重点核对的对齐缺口**：

| V3 source_type | 当前代码实际路径 | 对齐缺口 |
|---|---|---|
| `direction_card_confirmed` | `agent_proposal_service.confirm_proposal(proposal_type="clarify")` → `_persist_clarification` 写入 `Project.direction_card`，并写一条 `AgentEvent(event_type=AgentEventType.clarify)` 作为确认事件 | **没有独立的 direction card 确认事件**。方向卡是 `clarify` proposal 的副产物。V3 的 `direction_card_confirmed` 需要明确：是 hook 在 `confirm_proposal(proposal_type="clarify")` 上，还是需要新增独立的 direction card 确认流程？`AgentEventType` 也没有 `direction` 类型。 |
| `proposal_rejected` | `agent_proposal_service.reject_proposal()`：只把 `status` 翻为 `rejected`、存 `rejection_reason`，**不写任何 AgentEvent**，不进 timeline | **当前代码里 proposal 拒绝不是 timeline 事件，没有 `source_id` 可指**。V3 假设的 `proposal_rejected` 正式事件在当前代码中不存在。要让记忆抽取挂在拒绝事件上，必须先改造 `reject_proposal` 写一条 timeline AgentEvent（需扩 `AgentEventType` 或复用现有类型 + status 标记）。 |
| `assignment_confirmed` | `assignment_service.finalize_assignment_proposal()`（独立 `AssignmentProposal` 模型，status→`finalized`），**不走 `AgentProposal` 确认路径** | 分工确认的 `source_id` 应指 `AssignmentProposal.id`，不是 `AgentProposal.id`。V3 的 extractor 需要区分两类 proposal。成员 accept/reject/finalize 都是 human-triggered API。 |
| `replan_confirmed` / `replan_rejected` | **存在两条 replan 路径**：(a) `agent_proposal_service.confirm_proposal(proposal_type="replan")` → `_persist_replan`；(b) `replan_service.confirm_replan(ReplanConfirmRequest)`，直接改 Stage/Task 并创建 ActionCard，**不创建 AgentProposal** | V3 需要明确：记忆抽取挂在哪条路径？两条路径都要 hook？`replan_service.confirm_replan` 不经过 AgentProposal，是否有等价的 timeline 事件可挂？ |

其他代码事实：
- 仓库中**目前没有任何 memory / Mem0 / ProjectMemory 相关代码**（grep 仅命中 test、debug-payload-store、skill-loader）。记忆系统是纯新增。
- `agent-bridge/` 已实现：runtime（pi-runtime/model-router/session-store/context-builder）、tools（registry/fastapi-client/register-defaults/mock-tools/result-normalizer）、policy（policy-engine/budget/proposal-boundary/advisory-boundary）、events（event-mapper/stream/trace-envelope/debug-payload-store）、skills（skill-index/loader/selector + 6 个 SKILL.md）、server（app/config/routes）。**context-builder 已存在，是记忆注入的天然挂点**。
- 内部 tool endpoints 前缀 `/internal/agent-tools/*`，已有 4 个 read-only（workspace-state/conversation/pending-proposals/timeline-slice）。`get_project_memory_context` 若作为 read-only tool，可复用此模式。

---

## 三、Project Memory V1 设计方案（待调研对象）

### 3.1 设计结论

```
ProjectFlow 自建 ProjectMemory 表 + Mem0 OSS 作为检索引擎
```

- 事实源是 ProjectFlow 自己的 SQLite/SQLModel
- Mem0 不是事实源，不决定记忆是否有效、可见、能注入
- 链路：Formal Project Event → MemoryExtractor → ProjectMemory 表 → Mem0 index/search → MemoryRetriever 二次过滤 → Agent Context

### 3.2 外部依赖策略

- 抽象 `MemoryIndexBackend`，首个实现是 `mem0`
- SQLite/SQLModel 永远保存完整 ProjectMemory
- Mem0 不可用时，正式事件照常完成，ProjectMemory 照常落库
- Mem0 检索失败时，降级为 SQLite 字段过滤和最近相关记忆召回
- Mem0 的 `metadata.status` 只是提示，不能作为最终判断依据

技术选型确认：
```
ProjectFlow ProjectMemory 治理表
+ Mem0 OSS Python SDK 作为第一版 MemoryIndexBackend
+ Qdrant 作为启用语义检索时的优先向量存储
+ SQLite 字段检索作为强制 fallback
```

候选项目对比（方案中已给出）：
- Mem0 OSS：V1 采用
- Graphiti / Zep：V2 候选（temporal context graph，需 Neo4j/FalkorDB）
- Cognee：V2 知识库候选（document ingestion pipeline）
- Letta：不采用（stateful agent harness，和 T41 sidecar 重叠）
- LangGraph / LangMem：借鉴，不采用为主实现

### 3.3 V1 只接入 4 类正式项目事件

1. 方向卡确认（`direction_card_confirmed`）
2. proposal 拒绝原因（`proposal_rejected`）
3. 分工最终确认（`assignment_confirmed`）
4. replan 确认或拒绝（`replan_confirmed` / `replan_rejected`）

不接入：MVP 边界确认、阶段计划确认、任务拆解确认、高风险处理结论、成员约束更新、Pulse/check-in 确认事实（这些放 V1.1）。

不写入：普通聊天、一次性问答、按钮反馈、Agent 中间思考。

### 3.4 数据模型（ProjectMemory 表）

```python
class ProjectMemory(SQLModel, table=True):
    id: str
    workspace_id: str
    project_id: str
    memory_type: str  # direction / boundary / plan / assignment / tradeoff / rejection / member_constraint
    scope: str  # project / stage / task / member / risk
    content: str
    rationale: str
    source_type: str  # 5 种枚举
    source_id: str
    source_hash: str | None = None
    status: str = "active"  # active / superseded / archived
    visibility: str = "team"  # team / owner_only / subject_and_owner
    subject_user_id: str | None = None
    related_stage_id: str | None = None
    related_task_id: str | None = None
    related_risk_id: str | None = None
    valid_until: datetime | None = None
    superseded_by_memory_id: str | None = None
    backend: str = "mem0"
    backend_memory_id: str | None = None
    sync_status: str = "pending"
    extractor_version: str = "v1"
    schema_version: str = "v1"
    created_at: datetime
    updated_at: datetime
```

幂等规则：同一 `project_id + source_type + source_id + memory_type + source_hash` 不应重复生成语义相同的 active memory。

### 3.5 可见性

```
team：团队可见
owner_only：负责人可见
subject_and_owner：相关成员本人和负责人可见
```

默认规则：
- 方向 / MVP 边界 / replan 取舍：team
- 分工限制 / 成员可用时间 / 个人偏好：subject_and_owner
- proposal 拒绝原因：team 或 owner_only

如果当前用户可见性不足，记忆不能注入该用户触发的 Agent 上下文。V1 如果角色模型不足，先只实现 `team` 和 `subject_and_owner`；`owner_only` 不作为阻塞项。

### 3.6 检索流程

```
Agent event_type + 当前项目状态
→ 构造 query
→ Mem0 search top_k=12
→ 从 metadata 取 memory_id
→ 回查 ProjectMemory 表
→ 过滤 status != active
→ 过滤当前用户不可见 memory
→ 过滤 valid_until 已过期 memory
→ 过滤 workspace_id / project_id 不匹配 memory
→ 按 event_type 和关联对象重排
→ 最多注入 6 条
```

降级（Mem0 不可用）：读 ProjectMemory 表，按字段过滤，按 memory_type 优先级排序，最多注入 4-6 条。

按场景重排：
- clarification / direction：direction > boundary > tradeoff > rejection
- replanning：direction > boundary > plan > tradeoff > rejection
- assignment / negotiation：member_constraint > assignment > plan > tradeoff
- proposal_rejection：rejection > tradeoff > boundary > direction

### 3.7 Agent Context 注入

```xml
<project_memories>
  <memory>
    <type>boundary</type>
    <scope>project</scope>
    <content>本项目 MVP 不做复杂外部集成。</content>
    <rationale>团队在方向卡确认时认为当前截止日期前应优先完成核心闭环。</rationale>
    <source>方向卡确认</source>
    <valid_until></valid_until>
  </memory>
</project_memories>
```

最多注入 6 条；不注入 superseded/archived/过期/不可见；Agent 可说"参考了 X 条项目记忆"但不暴露当前用户不可见内容。

### 3.8 API 边界

V1 只开放只读：
```
GET /projects/{project_id}/memories
```

内部 service：
```
memory_service.extract_from_event(...)
memory_service.get_context_for_agent(...)
memory_service.sync_to_mem0_best_effort(...)
```

不提供 POST/PATCH/DELETE/extract/sync retry/edge API。

### 3.9 与 Project Pulse 的关系

- PulseRun 摘要不直接进入 ProjectMemory
- PulseItem 回复不默认进入 ProjectMemory
- PulseItem 处理结果即使被确认，V1 仍不接入，放 V1.1
- ProjectMemory 可被 Pulse 巡检读取，避免重复追问和重复建议

### 3.10 V1 不做的事

- LongTermMemoryNode + Edge 图结构
- 独立 ShortTermMemory 表
- 人工创建/编辑/删除长期记忆
- 自我约束能力（输出前方向/阶段/依据/人工确认检查）
- 范围裁决模块
- Mem0 自动聊天捕获
- 自动重建流程
- 记忆冲突自动裁决

---

## 四、调研任务

请按以下维度进行深度调研，每个维度给出：**现状评估**、**风险点**、**改进建议**、**优先级（P0/P1/P2）**。重点关注与 T41 Agent Runtime 的兼容性。

### 维度 1：Mem0 OSS 实际能力评估

请调研 Mem0 OSS 的最新版本（截至 2026 年）：
- 实际 API 稳定性和 breaking change 历史
- `add` / `search` 的实际行为和参数
- metadata filtering 的实际支持程度（按 workspace_id/project_id/status/visibility 粗过滤是否可靠）
- BM25 + embedding + entity matching 的实际召回质量
- Qdrant vs Chroma vs 其他向量库的实际差异
- self-hosted 部署的真实复杂度和运维成本
- Python SDK 和 REST server 的差异
- 是否真的能"只做索引层，不接管记忆生命周期"
- 与 ProjectFlow "正式事件驱动写入"模式的实际契合度
- Mem0 是否有自动抽取/自动捕获的默认行为需要显式关闭
- 是否有隐藏的 cloud 依赖或数据上报

### 维度 2：ProjectMemory 表结构合理性

- 字段设计是否覆盖了 V1 所有必要语义
- `memory_type` 7 种类型是否合适，是否有遗漏或冗余
- `source_hash` 计算方式（SHA256 of 稳定 JSON 序列化）是否足够防重复
- `superseded_by_memory_id` 单向链是否够用，是否需要反向 `supersedes`
- `valid_until` 和 `superseded` 的关系是否清晰
- 索引设计是否覆盖主要查询路径
- 是否需要 `confidence` 或 `evidence` 字段
- `extractor_version` 和 `schema_version` 的迁移策略是否完整
- 是否需要 `created_by_agent_event_id` 直接关联来源事件
- 与现有 `AgentEvent` / `AgentProposal` / `AssignmentProposal` 的关系建模

### 维度 3：4 类正式事件的选择和边界

- 这 4 类事件是否是"记忆价值最高"的子集
- 为什么不接入"阶段计划确认"和"任务拆解确认"（它们也是高价值决策）
- "成员约束更新"被推迟到 V1.1 是否会导致 member_constraint 类记忆在 V1 实际无法生成（因为分工确认中抽取的成员约束算不算"成员约束更新"事件？）
- `proposal_rejected` 的可见性（team vs owner_only）如何决定
- replan 确认和 replan 拒绝都写入记忆是否会导致冲突
- 方向卡确认产生的 `direction` 和 `boundary` 两条记忆是否需要关联
- 是否应该接入"assignment 拒绝"（成员拒绝分工后的 negotiation）

### 维度 3.5：V3 正式事件与当前代码的对齐缺口（重点，基于 2.10 节事实）

本维度的调研结论会直接决定 V1 能不能落地。请逐条给出**改造建议 + 优先级**：

1. **`direction_card_confirmed` 的归属**：方向卡确认实际是 `confirm_proposal(proposal_type="clarify")`。V3 应该：
   - (a) 把记忆抽取 hook 在 `confirm_proposal` 内部，按 `proposal_type` 分派 extractor？
   - (b) 单独新增 direction card 确认流程和 `AgentEventType.direction`？
   - (a) 更省事但把方向卡语义藏在 clarify 里，(b) 更清晰但要改 enum + service + 前端。哪个更符合 T41 "窄类型化" 原则？

2. **`proposal_rejected` 事件不存在**：当前 `reject_proposal` 不写 AgentEvent。V3 要从拒绝事件抽记忆，必须先让拒绝成为 timeline 事件。请评估：
   - 改造 `reject_proposal` 写一条 AgentEvent 的成本和副作用（会不会影响现有 timeline、前端、parity tests）
   - 是否复用 `AgentEventType` 现有类型 + `AgentEventStatus` 标记 rejected，还是新增 `proposal_rejected` 类型
   - `source_id` 应该是 `AgentProposal.id` 还是新写的 `AgentEvent.id`？`source_hash` 对哪些字段计算？

3. **`assignment_confirmed` 的 source 模型**：分工确认走 `AssignmentProposal`（独立模型），不是 `AgentProposal`。V3 的 `source_type=assignment_confirmed` 的 `source_id` 应指 `AssignmentProposal.id`。请评估：
   - extractor 需要同时支持 `AgentProposal` 和 `AssignmentProposal` 两类 source，会不会让 `source_type` / `source_id` 语义混乱？
   - 是否应该统一到一类 source（比如让 assignment 也走 AgentProposal）？这会改动多大？
   - 成员 accept/reject/finalize 三个动作分别产生什么记忆？finalize 才算 `assignment_confirmed`，那 accept/reject 要不要也抽记忆（V3 目前不抽）？

4. **replan 两条路径**：`confirm_proposal(proposal_type="replan")` 和 `replan_service.confirm_replan` 并存。请评估：
   - V3 应该 hook 两条路径还是统一到一条？
   - `replan_service.confirm_replan` 不创建 AgentProposal，是否有等价 timeline 事件可挂？如果没有，是否应该先统一 replan 确认路径（这属于 T41 范围，不是 T42）？
   - 如果 T41 还没统一，T42 V1 应该先只 hook 哪一条？

5. **`AgentEventType` 扩枚举的边界**：新增 `memory.retrieved` / `memory.injected` / `proposal_rejected` 等事件类型会不会破坏现有 AgentEvent 查询、前端 timeline、parity tests？是否应该用 `AgentEventStatus` 或 metadata 而不是新 enum 值？

6. **MemoryExtractor 的 hook 位置与 T41 事务边界**：V3 说"业务 service 内部调用 `memory_service.extract_from_event(...)`"。具体到代码：
   - 应该在 `confirm_proposal` / `reject_proposal` / `finalize_assignment_proposal` / `confirm_replan` 这几个 service 函数末尾调用？
   - 在同一事务内同步抽取 + 落库 ProjectMemory，还是事务提交后异步抽取？
   - 同步：失败会回滚正式事件吗（V3 说不阻塞，那必须放事务外）？异步：`sync_status` 怎么保证最终一致？
   - 这几个 service 函数目前都 `session.commit()` 自闭，extractor 怎么拿到事务后的稳定 `source_id`？

### 维度 4：可见性模型完整性

- `team` / `owner_only` / `subject_and_owner` 三档是否够用
- ProjectFlow 当前的 workspace membership role 模型能否支持 `owner_only`
- "负责人"指代什么（workspace owner / project creator / stage owner / task owner）
- 如果 V1 只实现 `team` 和 `subject_and_owner`，`owner_only` 类记忆（如 proposal 拒绝原因）如何处理
- 跨项目记忆是否需要（同一成员在多个项目的约束是否互相可见）
- Agent 在生成建议时如果参考了 `subject_and_owner` 记忆，输出可见性如何处理

### 维度 5：检索流程和二次过滤设计

- Mem0 `top_k=12` 是否合理
- 回查 SQLite 后"最多注入 6 条"是否过少或过多
- 二次过滤的 5 条规则是否完整
- "按 event_type 和关联对象重排"的具体 scoring 函数如何设计
- 同分优先级的 4 条规则是否可操作
- 降级 SQLite fallback 的排序策略（按 memory_type 优先级）是否够用
- 是否需要 reranker（如 LLM reranker 或 cross-encoder）
- 是否需要去重（同一决策的 direction + boundary 两条记忆）
- 时间衰减是否需要（旧记忆权重下降）

### 维度 6：与 T41 Agent Runtime 的集成边界（重点）

这是最关键的维度。请详细分析：

1. **记忆上下文如何进入 sidecar**：方案提到"如果未来要让 TS sidecar 发起只读检索，先通过 FastAPI internal tool 暴露 `get_project_memory_context`"。这个设计是否合理？是否应该：
   - (a) 作为新的 read-only tool 注册到 tool registry（`get_project_memory_context`）
   - (b) 作为 context-builder 的固定输入（类似 WorkspaceState、pending proposals）
   - (c) 由 FastAPI 在组装 WorkspaceState 时一并注入
   - 各方案利弊？

2. **记忆检索的触发时机**：
   - 每次 run 开始时检索一次？
   - 每个 tool call 前检索？
   - 只在特定 skill（risk-replan、project-intake）触发时检索？
   - 是否需要 LLM 主动调用工具检索（agentic retrieval）

3. **记忆注入到 context-builder 的位置**：
   - 现有 context-builder 的 dynamic suffix：user message / WorkspaceState / pending proposals / recent messages
   - 记忆应该放在哪一层？是 `<project_memories>` 独立 section，还是融入 WorkspaceState？
   - 是否需要按 skill 调整记忆注入量

4. **MemoryExtractor 的归属**：
   - 方案说"业务 service 内部调用 `memory_service.extract_from_event(...)`"
   - 这意味着 Extractor 在 FastAPI 侧，不在 sidecar
   - 这与 T41 "sidecar 不写业务状态"一致，但是否会让 sidecar 失去对记忆的感知？
   - proposal confirmation commit 时同步抽取记忆 vs 异步抽取，哪个更符合 T41 事务边界？

5. **与 AgentRunState 的关系**：
   - 记忆使用情况是否应该进入 `AgentRunState.side_effects`
   - 记忆检索失败是否影响 run state
   - `memory_backend = none` 时 run 是否应该继续

6. **与 AgentEvent 的关系**：
   - 方案说 AgentEvent 记录 `memory_used` / `memory_backend` / `used_memory_ids`
   - 这是否应该作为新的 AgentEventType，还是作为 AgentEvent 的 metadata
   - 是否需要 `memory.retrieved` / `memory.injected` event 类型进入 trace envelope

7. **与 Tool Contract 的关系**：
   - 记忆检索是否需要 manifest（如果作为 tool）
   - 记忆注入是否影响 tool 的 `privacy.trace_include_inputs`
   - 记忆是否进入 tool result 的 observation

8. **与 Skills 的关系**：
   - skill 是否应该在 `allowed-tools` 中声明需要记忆工具
   - skill 的 SKILL.md 是否应该指导 Agent 如何使用记忆（如"参考历史拒绝原因"）

### 维度 7：失败处理和降级策略

- "Mem0 同步失败只更新 sync_status，不回滚正式项目事件"是否安全
- "抽取器输出缺少来源/理由/可见性时不写入"是否会导致记忆 silently 丢失
- Mem0 返回旧记忆/不可见记忆/已 superseded 记忆时，回查丢弃是否够
- 检索失败时 Agent 输出"未使用项目记忆"是否影响用户体验
- active 记忆之间冲突不自动裁决是否合理
- 是否需要补偿机制（sync_status=failed 的记忆如何重试同步）
- 是否需要告警（抽取失败率、同步失败率）

### 维度 8：与 Project Pulse 的关系

- Pulse 巡检读取 ProjectMemory 避免重复追问的具体机制
- PulseItem 确认事实放 V1.1 是否过早关闭了高价值记忆源
- 是否应该有"Pulse 发现与历史记忆冲突"的事件
- Pulse 和 Memory 的耦合度应该如何设计

### 维度 9：V1 范围是否合适

- V1 范围是否过小（只 4 类事件 + 治理表 + Mem0 检索）
- V1 范围是否过大（Mem0 集成 + 可见性 + 降级 + AgentEvent 记录）
- 哪些是 V1 必须做的，哪些可以推迟到 V1.1
- V1 验收标准（12 条）是否可测试、可交付
- 是否有遗漏的关键验收项

### 维度 10：替代方案对比验证

请独立验证方案中的候选对比，并补充：
- Mem0 OSS vs Graphiti vs Cognee vs Letta vs LangMem 的最新状态（2026 年）
- 是否有遗漏的候选（如 Zep Cloud、Mem0 Platform、自研检索层、SQLite-vss、pgvector）
- "Mem0 OSS + Qdrant" vs "纯 SQLite FTS5 + embedding" 的 tradeoff
- 是否应该完全不用外部记忆库，只用 SQLite + 简单 embedding（如 sentence-transformers）

### 维度 11：后续扩展路径可行性

- V1.1 接入更多事件的难度
- V2 引入 LongTermMemoryEdge 的迁移成本
- V2 引入 Graphiti 时 ProjectMemory 表能否平滑迁移
- 记忆冲突解决流程的复杂度
- 记忆重建后台任务的必要性
- 与范围裁决模块、自我约束能力的联动设计

### 维度 12：产品入口和用户体验

- "项目记忆"页面只读列表的 UX 设计
- 按 5 个主题聚合是否合适
- 用户能否理解"记忆"和"任务"的区别
- Agent 说"参考了 X 条项目记忆"是否会困惑用户
- 是否需要展示记忆的"影响过哪次建议"
- 记忆列表是否需要搜索/过滤/排序

---

## 五、输出要求

请按以下结构输出调研报告：

1. **执行摘要**（1 页）：整体评估、关键风险、核心建议
2. **分维度调研**（每个维度 1-2 页）：
   - 现状评估
   - 风险点
   - 改进建议（具体、可执行）
   - 优先级（P0 = 阻塞 V1，P1 = V1 应优化，P2 = V1.1+ 考虑）
3. **与 T41 兼容性总结**：哪些设计与 T41 底座冲突或需要调整
4. **推荐调整清单**：按优先级排序的具体改进项
5. **开放问题**：需要 ProjectFlow 团队进一步澄清的问题
6. **参考依据**：引用的具体文档、开源项目、最佳实践（带链接）

特别提醒：
- 请基于 2026 年的最新信息调研，不要用过时资料
- 请实际查阅 Mem0、Graphiti、Cognee、Letta、LangMem 的最新文档和 GitHub 状态
- 请引用具体的技术细节，而不是泛泛而谈
- 请关注 ProjectFlow 是"大学生项目管理"这个具体场景，不要过度设计
- 请尊重 T41 已确认的架构边界（4 层写入、Proposal-Confirm、sidecar 不读 DB、read-only 纯读）
- 调研结果是给 ProjectFlow 团队优化 V3 方案的，不是推翻 V3 重新设计
- **维度 3.5（V3 正式事件与当前代码的对齐缺口）是最高优先级**：第二、3.5 节的代码层事实已由 ProjectFlow 团队核对源码确认，V3 方案里假设的 4 类正式事件在当前代码里没有一处是直接对得上的。如果 V1 落地顺序里不先解决这些对齐缺口，extractor 将无 source_id 可挂、无 timeline 事件可订阅。请把维度 3.5 的每一条都给出明确改造建议，并标注哪些属于 T42 范围、哪些需要回头和 T41 团队协调（比如 replan 路径统一、reject_proposal 写 timeline 事件）。
