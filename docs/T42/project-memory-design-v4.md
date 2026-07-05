# T42 Project Memory V1 设计方案（V4 终稿）

> 本文档是 V3 的后继，吸收 4 份深度调研、ProjectFlow 源码对齐、以及外部记忆系统（TencentDB-Agent-Memory、echovault、recall-loom 等）的方法论后产出。V3 已废，以本文件为准。
>
> 变更摘要见文末「与 V3 的差异」。

## 背景

ProjectFlow 的 Agent 已经能围绕方向卡、阶段计划、任务拆解、分工建议、行动卡、风险和巡检产物输出判断。但这些判断如果只依赖当前状态和最近一轮对话，就会出现一个项目管理产品里很致命的问题：Agent 不知道"当初为什么这么做"。

例如，某个任务曾经因为超出 MVP 被延后；某个成员曾经因为本周时间不足被分配轻任务；某个风险曾经被接受而不是继续升级。如果 Agent 之后忘记这些原因，它可能今天建议砍掉 A，明天又建议补回 A，或者反复提出已经被团队拒绝过的方案。

## 设计结论

V1 采用：

```text
ProjectFlow 自建 ProjectMemory 治理表（SQLite/SQLModel）
+ 本地检索引擎（sqlite-vec 向量 + SQLite FTS5 关键词 + RRF 融合）
+ Markdown 导出作白盒展示
+ Mem0 OSS 作为可选 MemoryIndexBackend 实现
```

事实源是 ProjectFlow 自己的 SQLite。检索引擎不是事实源，不决定一条记忆是否有效、是否可见、是否能注入 Agent 上下文。

整体链路：

```text
Formal Project Event
→ ProjectFlow MemoryExtractor（FastAPI 侧，事务后异步）
→ ProjectMemory 表 + ProjectMemorySync 表
→ MemoryIndexBackend.index()（默认 sqlite-vec+FTS5，可选 mem0）
→ MemoryRetriever（RRF 召回 → 回查 SQLite 二次过滤 → 场景重排）
→ Agent Context（token 预算注入）
→ Markdown 导出（项目记忆页面）
```

## 设计目标

1. 记住历史决策的理由，而不是只保存结论。
2. V1 只从 4 类正式项目事件写入长期记忆，防止普通聊天污染记忆。
3. 让所有可影响 Agent 判断的记忆都有来源、状态、可见性和生命周期。
4. 本地检索引擎为零配置默认；Mem0 作为可替换增强。
5. Agent 每次只注入相关、有效、当前用户可见的记忆。
6. 旧记忆不能被直接删除，只能 archived、superseded 或因 `valid_until` 失效。
7. V1 避免图谱编辑器、关系边表和独立短期记忆表，先做稳定闭环。
8. 记忆对用户白盒可读：支持 Markdown 导出，用户能检视和导出自己项目的记忆。
9. V1 必须有最小评测 harness，召回质量可量化。

## 非目标

V1 不做 LongTermMemoryNode + LongTermMemoryEdge 图结构。关系、冲突、支持、派生作为后续扩展。

V1 不做独立 ShortTermMemory 表。临时但会影响未来判断的约束，如果来自正式事件，可以写成带 `valid_until` 的 ProjectMemory；普通临时上下文继续从当前项目状态、check-in 和 Pulse 数据读取。

V1 不接入阶段计划确认、任务拆解确认、高风险处理结论、成员约束更新、Pulse/check-in 确认事实等事件。这些事件放 V1.1。

V1 不把普通聊天、一次性问答、按钮反馈或 Agent 中间思考沉淀为长期记忆。**不自动捕获对话**（这是采纳腾讯方案时明确拒绝的能力——腾讯 TencentDB-Agent-Memory 默认每 N 轮自动抽 L1，违反 ProjectFlow "正式事件驱动" 硬约束）。

V1 不允许用户手动创建、编辑、删除长期记忆，也不开放人工维护记忆关系。但允许 Markdown 只读导出。

V1 不做自我约束能力。项目记忆只负责存储、检索和呈现历史上下文，不负责在输出前做方向、阶段、依据或人工确认检查。

V1 不做范围裁决模块。

V1 不做 reranker（cross-encoder / LLM rerank）。V1 用 sqlite-vec cosine + FTS5 BM25 + RRF 融合 + 场景重排，召回质量靠最小评测 harness 兜底；reranker 留 V1.1。

V1 不做显式时间衰减函数。`valid_until` + `superseded` 已足够让过期记忆退出注入；指数衰减留 V1.1。

## 核心原则

项目记忆采用"治理层 + 检索层 + 展示层"结构：

```text
Formal Project Event 是事实源
ProjectMemory 是 ProjectFlow 自己的治理层
MemoryIndexBackend 是可替换的本地索引和召回层
MemoryRetriever 二次过滤后产出 Agent 上下文切片
Markdown 导出是白盒展示层
```

ProjectFlow 自己决定：

1. 什么事件可以写长期记忆。
2. 记忆类型是什么。
3. `source_type`、`source_id`、`source_hash` 是什么。
4. `status` 是 `active`、`superseded` 还是 `archived`。
5. `visibility` 是什么。
6. `valid_until` 和 `superseded_by_memory_id` 怎么设置。
7. 当前用户触发 Agent 时，这条记忆是否能被注入上下文。

`MemoryIndexBackend` 负责：

1. `index(memory)`：写入索引（向量 + 全文）。
2. `search(query, filters, top_k)`：返回候选 `list[MemoryIndexCandidate]`，每条带 `memory_id`、`score`、`backend`。

候选必须用 `memory_id` 回查 ProjectMemory 表，由 ProjectFlow 二次过滤。**任何检索引擎返回的结果都不得直接注入 Agent。**

## 外部依赖策略

V1 默认部署零新服务、零外部 API：

```text
sqlite-vec（SQLite 向量扩展，进程内加载）
+ SQLite FTS5（SQLite 内置全文检索，jieba 中文分词）
+ sentence-transformers 本地 embedding（默认 BAAI/bge-small-zh-v1.5，~100MB，可配 BGE-M3）
+ RRF 融合
```

`MemoryIndexBackend` 是抽象层，首个实现是 `SqliteVecMemoryIndexBackend`（默认）。`Mem0MemoryIndexBackend` 作为可选实现，给想要更好召回质量的团队用（需起 Qdrant）。

降级链：

1. sqlite-vec 向量检索失败 → 退到 FTS5 关键词检索。
2. FTS5 也失败 → 退到 SQLite 字段过滤（按 memory_type、scope、related_* 直匹配）。
3. 全部失败 → `memory_backend = none`，Agent 只读当前项目状态，不阻塞。

Mem0 不可用时，正式项目事件照常完成，ProjectMemory 照常落库。

## 技术选型

### 结论

```text
ProjectFlow ProjectMemory 治理表
+ SqliteVecMemoryIndexBackend 作 V1 默认（sqlite-vec + FTS5 + RRF + 本地 embedding）
+ Mem0MemoryIndexBackend 作可选（Mem0 OSS + Qdrant）
+ Markdown 导出
```

### 为什么默认 sqlite-vec 而不是 Mem0

1. **零配置是 ProjectFlow 硬约束**。CLAUDE.md 明确"本地演示优先，零配置"。Mem0+Qdrant 要起独立 Qdrant 服务，破坏这个承诺。sqlite-vec 是 SQLite 扩展，进程内加载，演示启动仍是一条命令。
2. **大厂验证**。腾讯 TencentDB-Agent-Memory（6.4k stars，MIT）的存储栈正是 `sqlite-vec + FTS5/BM25 + RRF`，且用 jieba 做中文分词。这不是小众选择，是 local-first 记忆系统的主流栈。
3. **记忆量级小**。V1 只从 4 类正式事件写入，单项目估计几十到几百条记忆。sqlite-vec 召回质量对这个量级够用（R2 结论）。
4. **Mem0 的坑都是真实的**。R1 核实：`add(infer=True)` 默认会 LLM 抽取改写内容、遥测默认开、Mem0 自带 SQLite history DB 和治理表冲突。每个都要显式处理。sqlite-vec 自己写自己控，坑少。
5. **可替换性保留**。`MemoryIndexBackend` 抽象不变，未来切 Mem0/Graphiti 不改业务层。

### Mem0 作可选实现的接入边界

若团队配置启用 Mem0：

1. `Mem0MemoryIndexBackend.add()` 硬编码 `infer=False`（否则 Mem0 会 LLM 抽取，存进 Mem0 的内容和 ProjectMemory 治理表对不上）。contract test 必须断言。
2. `MEM0_TELEMETRY=False` 强制写进配置。
3. Mem0 自带 SQLite history DB **不读不查不作事实源**，仅作 Mem0 内部审计，忽略。
4. 只用 `add` / `search` + metadata filtering；不用 Mem0 自动聊天捕获、不用 Pi plugin auto-capture、不用 Mem0 侧 update/delete 作生命周期事实、不用 Mem0 Cloud 作默认。
5. 向量库优先 Qdrant（v2.0.0+ 已修复多字段 metadata filter）。

### 候选项目对比（V1 选型记录）

| 候选 | V1 | 理由 |
|---|---|---|
| sqlite-vec + FTS5 + RRF | **采用（默认）** | 零配置、本地、腾讯验证、量级够用 |
| Mem0 OSS + Qdrant | 可选增强 | 召回质量更高，但破坏零配置、坑多 |
| Graphiti / Zep | V2 候选 | 时序图谱，需 Neo4j，V1 不做图结构 |
| Cognee | V2 知识库候选 | 文档 ingestion pipeline 过宽 |
| Letta | 不采用 | stateful agent harness，接管 runtime，和 T41 sidecar 重叠 |
| LangGraph / LangMem | 借鉴 | checkpointer/store 思路参考，不引入主实现 |
| TencentDB-Agent-Memory | 借鉴 pattern | 存储栈和分层思想借鉴，框架不采纳（TS、自动捕获、对话画像形状） |
| echovault / recall-loom | 借鉴 pattern | "decisions as markdown" 思路借鉴，是编码 agent 工具非 Python 库 |
| pgvector | V2 考虑 | 若未来迁 Postgres |

## 正式项目事件

长期记忆只能从正式项目事件生成。V1 只接入 4 类事件：

1. 方向卡确认（`direction_card_confirmed`）
2. proposal 拒绝原因（`proposal_rejected`）
3. 分工最终确认（`assignment_confirmed`）
4. replan 确认或拒绝（`replan_confirmed` / `replan_rejected`）

### 4 类事件在当前代码里的落点与改造（关键对齐）

V3 假设这 4 类事件已存在，但核对源码发现没有一处直接对得上。V4 必须先改造 service 层让正式事件可订阅：

| V4 source_type | 当前代码实际路径 | 改造方案 |
|---|---|---|
| `direction_card_confirmed` | `agent_proposal_service.confirm_proposal(proposal_type="clarify")` → `_persist_clarification` 写 `Project.direction_card` | 不新增独立事件。在 `confirm_proposal` 末尾按 `proposal_type` 分派 extractor：`proposal_type=="clarify"` 且 payload 含 direction_card → 调 `memory_service.extract_from_event(source_type="direction_card_confirmed", source_id=proposal.id)`。不扩 `AgentEventType` enum。 |
| `proposal_rejected` | `reject_proposal()` 只翻 status + 存 `rejection_reason`，**不写 AgentEvent** | **改造 `reject_proposal` 写一条 timeline AgentEvent**（复用 `AgentEventType` 现有值 + `AgentEventStatus.failed` 标记 rejected），存 `rejection_reason`。extractor hook 在这条 AgentEvent 上，`source_id=AgentEvent.id`。需同步评估前端 timeline 渲染和 parity tests。 |
| `assignment_confirmed` | `assignment_service.finalize_assignment_proposal()`（独立 `AssignmentProposal` 模型，status→`finalized`） | 在 `finalize_assignment_proposal` 末尾 hook extractor，`source_id=AssignmentProposal.id`。extractor 支持两类 source（`AgentProposal` 和 `AssignmentProposal`）。成员 accept/reject 不抽记忆，只 finalize 抽。 |
| `replan_confirmed` / `replan_rejected` | **两条路径并存**：(a) `confirm_proposal(proposal_type="replan")` → `_persist_replan`；(b) `replan_service.confirm_replan()` 不创建 AgentProposal | **V1 只 hook 路径 (a)**。路径 (b) 的统一属于 T41 范围（记为 T41 待办），不阻塞 T42。replan 拒绝 hook 在 `reject_proposal(proposal_type="replan")`（依赖上面的 reject 改造）。 |

正式事件需要满足三个条件：

1. 它改变或确认了项目事实。
2. 它有明确来源对象。
3. 它能被用户在产品中回溯。

普通聊天、一次性问答、按钮成功反馈、Agent 自己的中间分析，都不是正式事件。

## 数据模型

V1 新增两张表：`ProjectMemory`（治理主表）和 `ProjectMemorySync`（索引同步元数据，拆出来让主表干净）。

```python
class ProjectMemory(SQLModel, table=True):
    id: str
    workspace_id: str
    project_id: str

    memory_type: str
    # direction / boundary / plan / assignment / tradeoff / rejection / member_constraint

    scope: str
    # project / stage / task / member / risk

    content: str           # 可被 Agent 引用的结论
    rationale: str         # 当时为什么这么决定

    source_type: str       # 5 种枚举（见下）
    source_id: str
    source_hash: str | None = None   # SHA256 of 稳定 JSON 序列化

    status: str = "active"            # active / superseded / archived
    visibility: str = "team"          # team / subject_and_owner（V1 只两档）

    subject_user_id: str | None = None
    related_stage_id: str | None = None
    related_task_id: str | None = None
    related_risk_id: str | None = None

    valid_until: datetime | None = None
    superseded_by_memory_id: str | None = None

    extractor_version: str = "v1"
    schema_version: str = "v1"

    created_at: datetime
    updated_at: datetime


class ProjectMemorySync(SQLModel, table=True):
    memory_id: str = Field(foreign_key="project_memories.id", primary_key=True)
    backend: str = "sqlite_vec"       # sqlite_vec / mem0
    backend_memory_id: str | None = None
    sync_status: str = "pending"      # pending / synced / failed
    last_synced_at: datetime | None = None
    last_error: str | None = None
```

V1 `source_type` 只允许：

```text
direction_card_confirmed
proposal_rejected
assignment_confirmed
replan_confirmed
replan_rejected
```

字段说明：

- `content` 是可被 Agent 引用的结论。
- `rationale` 是当时为什么这么决定。
- `source_type` 和 `source_id` 指向正式项目事件。
- `source_hash` 用于幂等写入。计算方式：对正式事件中会影响记忆抽取的字段做稳定 JSON 序列化（剔除 `created_at`、`updated_at`、临时状态、同步状态），然后 SHA256。
- `status` 表示这条记忆当前是否仍然有效。
- `visibility` 决定用户能否看到，也决定能否注入该用户触发的 Agent 上下文。V1 只实现 `team` 和 `subject_and_owner`；`owner_only` 推 V1.1。
- `valid_until` 表示明确到期时间。
- `superseded_by_memory_id` 替代原方案的 `supersedes` 边。

索引（含幂等唯一索引）：

```sql
CREATE UNIQUE INDEX idx_memory_idemp
  ON project_memories(project_id, source_type, source_id, memory_type, source_hash);
CREATE INDEX idx_memory_project_status ON project_memories(project_id, status);
CREATE INDEX idx_memory_workspace_project ON project_memories(workspace_id, project_id);
CREATE INDEX idx_memory_source ON project_memories(source_type, source_id);
CREATE INDEX idx_memory_valid_until ON project_memories(valid_until);
CREATE INDEX idx_memory_superseded ON project_memories(superseded_by_memory_id);
CREATE INDEX idx_memory_subject_proj ON project_memories(project_id, subject_user_id);
CREATE INDEX idx_memory_sync_status ON project_memory_sync(sync_status);
```

幂等规则：同一 `project_id + source_type + source_id + memory_type + source_hash` 不应重复生成语义相同的 active memory。唯一索引在 DB 层兜底；extractor 写入前先查此键，命中则跳过或 supersede。

## 记忆类型与范围

V1 保留少量稳定类型：

```text
direction：项目方向判断
boundary：方向卡内确认的 MVP 或范围边界
plan：仅指 replan 确认/拒绝后形成的计划调整判断
assignment：分工与资源安排
tradeoff：方案取舍
rejection：被拒绝方案及原因
member_constraint：从分工确认中抽取的成员可用时间、偏好或限制
```

`risk` 和普通 `stage_plan` 类型保留给 V1.1。

V1 可写入范围：

```text
project：项目级方向、边界、全局取舍
stage：replan 涉及的阶段调整
task：proposal 拒绝或 replan 涉及的任务取舍
member：分工确认中的成员约束、分工依据、可用时间变化
```

不单独做 `summary` 类长期记忆。摘要只适合展示，不适合作为 Agent 判断依据。

## 状态与生命周期

ProjectMemory 使用三个状态：

```text
active：当前有效，可被检索和注入
superseded：被正式新事实替代，保留追溯但不注入
archived：系统归档，保留追溯但不注入
```

V1 保留 `archived` 状态用于后续扩展；第一版主要通过 `superseded` 和 `valid_until` 让记忆退出注入。

默认生命周期：

```text
方向 / MVP 边界：active，直到被新方向或新边界 supersede
proposal 拒绝原因：active，直到 replan 或新正式决策明确推翻
分工确认：active，直到新分工确认或 replan supersede
replan 确认/拒绝：active，直到下一次 replan 或正式项目决策 supersede
```

系统不能直接删除旧记忆。旧记忆只通过以下方式退出 Agent 注入：

1. `status` 改为 `superseded`。
2. `status` 改为 `archived`。
3. `valid_until` 到期。
4. 当前用户没有可见权限。

## 可见性

原则：凡是会进入 Agent 上下文、影响 Agent 判断的记忆，都必须对当前用户可见。

V1 可见范围（只两档）：

```text
team：团队可见
subject_and_owner：相关成员本人和负责人可见
```

`owner_only` 推 V1.1，不作为 T42 阻塞项。

owner 按作用域定义：

```text
scope=project → Project.created_by
scope=stage  → 阶段负责人（若模型没有，fallback 到 Project.created_by）
scope=task   → Task.owner_user_id（若未分配，fallback 到 Project.created_by）
scope=member → subject_user_id 本人 + Project.created_by
```

默认规则：

```text
方向 / MVP 边界 / replan 取舍：team
分工限制 / 成员可用时间 / 个人偏好：subject_and_owner
proposal 拒绝原因：team
```

如果一条记忆的可见性不足以让当前用户查看，它不能被注入到这个用户触发的 Agent 上下文中。

**Agent 输出可见性**：Agent 生成的建议如果参考了 `subject_and_owner` 记忆，建议本身也标 `subject_and_owner`，防止泄露给无权用户。

跨项目记忆（同一成员在多项目的约束）V1 不做。若 V1.1 需要，新增独立 `UserMemory` 表，不混入 ProjectMemory。

## 写入流程

写入只由 V1 允许的 4 类正式项目事件触发。

```text
confirm_proposal(proposal_type=clarify/replan)
reject_proposal()
finalize_assignment_proposal()
  → session.commit()  （正式事件先落库）
  → memory_service.extract_from_event(...)  （异步，事务后）
  → MemoryExtractor 读取事件和关联项目状态
  → 输出 ProjectMemory candidate
  → 校验 content、rationale、source_id、visibility
  → 幂等检查（idx_memory_idemp）
  → 写入 ProjectMemory + ProjectMemorySync
  → 必要时 supersede 旧记忆
  → best effort 调 MemoryIndexBackend.index()
```

写入规则：

1. **extractor 在 FastAPI 侧，不在 sidecar**。正式事件 `session.commit()` 之后异步调用 extractor，开新 session 写 ProjectMemory。失败只记日志，**不回滚正式事件**（符合 V3 "记忆抽取失败不阻塞正式事件"）。
2. 缺少 `content`、`rationale`、`source_type`、`source_id` 的候选记忆不入库，记 extractor validation failed。
3. 新记忆如果正式替代旧记忆，创建新行，并把旧行标记为 `superseded`。
4. 新记忆如果只是潜在冲突，V1 不自动裁决；抽取器应避免写入会形成两个 active 约束的结果。
5. 索引同步失败只更新 `ProjectMemorySync.sync_status = failed`，不回滚正式项目事件。
6. V1 不开放外部 extract API。抽取只在业务 service 内部调用。

## 检索流程

```text
Agent run 开始（FastAPI 组装 run input 前）
→ memory_service.get_context_for_agent(project_id, event_type, user_id)
→ 构造 query（基于 event_type + 当前项目状态）
→ MemoryIndexBackend.search()：
    - sqlite-vec 向量召回 top 50
    - FTS5 关键词召回 top 50（jieba 分词）
    - RRF 融合两路 rank
→ 从候选取 memory_id 回查 ProjectMemory 表
→ 过滤 status != active
→ 过滤 valid_until 已过期
→ 过滤当前用户不可见 memory
→ 过滤 workspace_id / project_id 不匹配
→ score 阈值过滤（cosine < 0.3 丢弃，可配）
→ 按 event_type 场景重排
→ token 预算截断（见下）
→ 返回结构化记忆列表
```

二次过滤规则：

1. `status` 必须为 `active`。
2. `valid_until` 为空或晚于当前时间。
3. 当前用户必须满足 `visibility`。
4. `workspace_id`、`project_id` 必须匹配当前项目。
5. score 低于阈值丢弃。
6. 如果当前事件绑定了 stage、task、risk 或 member，直接关联记忆优先。
7. 如果检索引擎返回的 `memory_id` 不存在于 SQLite，直接丢弃。

### 场景重排

```text
clarification / direction：direction > boundary > tradeoff > rejection
replanning：direction > boundary > plan > tradeoff > rejection
assignment / negotiation：member_constraint > assignment > plan > tradeoff
proposal_rejection：rejection > tradeoff > boundary > direction
```

同分优先级：

1. 与当前对象直接关联。
2. 最近更新。
3. 来源更正式。
4. `memory_type` 更匹配当前 `event_type`。

### 降级链

1. sqlite-vec 向量失败 → FTS5 关键词检索（按 memory_type 优先级排序）。
2. FTS5 失败 → SQLite 字段过滤（按 project_id、status、visibility、valid_until、related_* 直匹配）。
3. 全部失败 → `memory_backend = none`，Agent 只读当前项目状态，不阻塞。

降级执行规则：

1. 不尝试修复检索引擎。
2. 不阻塞 Agent。
3. 在 AgentEvent 的轻量快照中记录记忆使用情况。

## Agent Context 注入

Agent 只接收过滤后的结构化记忆。Prompt 中按项目既有规则使用 XML 标签隔离用户数据，并对 JSON 内容做转义。

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

注入规则：

1. **token 预算注入**：最多 1500 token（按 content + rationale 累加，超预算停），条数硬顶 8 条。不按固定条数限（R3 结论：单条长度不一，按条数限会信息过多或过少）。
2. 不注入 `superseded`、`archived`、过期或不可见记忆。
3. 不把检索引擎原始结果直接注入 Agent。
4. Agent 用户可见输出可以说"参考了 X 条项目记忆"，但不能暴露当前用户不可见的记忆内容。
5. 用户可见文本继续遵守项目规则：不展示原始 `user_id`、`task_id` 等内部 ID。

## T41 集成边界

记忆系统是 T42 功能增强，必须遵守 T41 底座边界：

1. **记忆上下文作为 context-builder 的固定输入，不作为 LLM-callable tool**。FastAPI 在创建 AgentRun 前调 `memory_service.get_context_for_agent(...)`，结果作为 run input 的 `project_memories` 字段传给 sidecar。sidecar context-builder 放进 dynamic suffix，用 `<project_memories>` XML 包裹。
2. **不注册 `get_project_memory_context` 为 LLM-callable tool**（避免 agentic retrieval 复杂度，V1.1 再考虑）。
3. **检索时机 = 每次 run 开始一次**（不是每 tool call），简单可控。
4. **sidecar 不直连检索引擎**，符合 "sidecar 不读业务事实"。所有检索走 FastAPI。
5. **MemoryExtractor 在 FastAPI 侧**，事务后异步。sidecar 不感知记忆写入。
6. **不扩 `AgentEventType` enum**。记忆使用情况记 AgentEvent 的 `output_snapshot` metadata：
   ```json
   {
     "memory_used": true,
     "memory_backend": "sqlite_vec | fts5 | field_filter | none",
     "used_memory_ids": ["..."],
     "retrieval_count": 50,
     "injected_count": 5,
     "retrieval_latency_ms": 120
   }
   ```
7. **skill 不在 `allowed-tools` 声明记忆工具**（因为记忆不是 tool）。skill 的 SKILL.md 可以指导 Agent 如何利用记忆（如"参考历史拒绝原因"），但记忆注入是 context-builder 的职责，不是 skill 的职责。

## Markdown 导出与展示

借鉴 TencentDB-Agent-Memory（L2/L3 存 Markdown）和 echovault / recall-loom（decisions as markdown）的白盒 pattern。ProjectFlow 的治理表用 SQL，但**展示和导出用 Markdown**，让用户能白盒检视自己项目的记忆。

```text
GET /projects/{project_id}/memories.md
→ 按 5 个主题聚合（方向与边界 / 被拒绝方案 / 分工与资源 / 重排取舍 / 被替代或归档的历史判断）
→ 每条记忆渲染成 Markdown：
   ### <content>
   - 理由：<rationale>
   - 来源：<source_type 中文>
   - 状态：<status>
   - 有效期：<valid_until 或 "长期">
   - 关联：<related 对象 title>
   - 可见范围：<visibility 中文>
→ 返回 text/markdown
```

项目记忆页面（前端）直接渲染这份 Markdown。用户可导出 `.md` 文件，可 git 版本化。

**Markdown 只作展示/导出，不作存储**。治理需求（visibility 过滤、status、supersede、幂等）需要 SQL，Markdown 文件做不了这些。

## 产品入口

项目内增加"项目记忆"入口，是可见性和可追溯入口，不是编辑器。

默认按主题聚合：

```text
方向与边界
被拒绝方案
分工与资源
重排取舍
被替代或归档的历史判断
```

每条记忆展示：结论、理由、来源、状态、有效期、关联对象、可见范围。

V1 不提供手动创建、编辑、删除 ProjectMemory。提供 Markdown 导出。

Agent 生成重要建议时，可以显示"参考了 X 条项目记忆"。用户可以点开查看这次实际注入的结构化记忆列表。

## API 边界

V1 开放：

```text
GET /projects/{project_id}/memories       # 只读列表（JSON，给前端页面）
GET /projects/{project_id}/memories.md    # 只读 Markdown 导出
```

内部 service：

```text
memory_service.extract_from_event(...)        # 业务 service 内部调用
memory_service.get_context_for_agent(...)     # FastAPI 组装 run input 时调用
memory_service.sync_to_backend_best_effort(...)  # 索引同步
```

V1 不提供：

```text
POST /project-memories
PATCH /project-memories/{id}
DELETE /project-memories/{id}
POST /projects/{project_id}/memories/extract
POST /projects/{project_id}/memories/sync/retry
```

ProjectMemory 的变化只能来自正式事件、系统抽取、系统同步和生命周期规则。

## 失败处理

如果记忆抽取失败，不阻塞正式项目事件本身。V1 记录失败日志，不实现后台自动补偿。

如果抽取器输出缺少来源、理由或可见性，不写入 ProjectMemory，记 extractor validation failed。

如果索引同步失败，`ProjectMemorySync.sync_status = failed`。Agent 检索走降级链。

如果检索引擎返回旧记忆、不可见记忆或已 superseded 记忆，回查 ProjectMemory 后丢弃。

如果检索失败，Agent 降级为只读取当前项目状态，输出标记"未使用项目记忆"（`memory_backend = none`）。

如果发现 active 记忆之间存在冲突，V1 不自动裁决。系统等待后续正式项目事件产生新记忆并 supersede 旧记忆。

如果系统升级抽取器后需要重建，V1 只保留版本字段，不实现自动重建流程。

## 数据重建与版本化

每条 ProjectMemory 记录 `source_hash`、`extractor_version`、`schema_version`。V1 不实现自动重建。

schema 演进用 expand-contract（R4 结论）：新增字段先加列允许 NULL → 新代码并行写 → 验证后回填 → 删旧列。`schema_version` 记录创建时模型版本，读老数据按版本 upcast。

## 评估

V1 必做最小评测 harness（不跑 BEAM/LongMemEval，自建小套）：

1. **场景构造**：固定项目（2 阶段、5 任务、3 成员）+ 手工插 10 条 ProjectMemory。
2. **检索场景**（5 个）：澄清决策原因 / 分工查询 / replan 取舍 / 风险回顾 / 跨任务关联。每个标注期望召回的 memory_id。
3. **执行**：mock LLM，调 `memory_service.get_context_for_agent`，断言：
   - 期望记忆全召回（recall = 100%）
   - 无关记忆不出现（precision）
   - 延迟 < 500ms
4. **进 CI**，每次改检索逻辑跑一遍。

关键指标（埋点 + 评测）：

```text
检索召回率（recall@k）：目标 >= 90%
检索精确率（precision）：无关记忆占比趋近 0
检索延迟：目标 < 500ms
降级触发率：目标 < 5%
记忆库增长率：每天新增条数（监控用，无硬目标）
一致性失效率：source_id 对不上的记忆条数（目标 0）
```

参考基准（不直接跑，作标尺）：Mem0 在 LoCoMo ~92.5%、LongMemEval ~94.4% recall。V1 sqlite-vec 在百~千条量级应能接近，差距靠 FTS5 + 场景重排补。

## 与 Project Pulse 的关系

Project Pulse 负责主动巡检和生成"今日待确认"。Project Memory 负责记住历史原因和正式约束。

```text
PulseRun 摘要不直接进入 ProjectMemory
PulseItem 回复不默认进入 ProjectMemory
PulseItem 的处理结果即使被确认，也放到 V1.1 再接入
ProjectMemory 可以被 Pulse 巡检读取，用于避免重复追问和重复建议
```

## V1 范围

V1 交付的核心体验：

1. 项目有 `ProjectMemory` + `ProjectMemorySync` 两张治理表。
2. 只从 4 类事件抽取记忆（方向卡确认、proposal 拒绝、分工最终确认、replan 确认/拒绝）。
3. 每条记忆必须包含 `content`、`rationale`、`source_type`、`source_id`、`memory_type`、`status`、`visibility`。
4. `source_type` 只允许 5 种枚举。
5. ProjectMemory 同步到本地检索引擎（sqlite-vec + FTS5），同步失败不影响业务流程。
6. Agent run 开始前检索 top_k=50，RRF 融合，回查 SQLite 二次过滤。
7. 回查后过滤 `status`、`visibility`、`valid_until`、`project_id`、score 阈值。
8. Agent 按 token 预算（1500 token，硬顶 8 条）注入 ProjectMemory。
9. 检索引擎不可用时降级到 FTS5 → 字段过滤 → none，AgentEvent 记录 `memory_backend` 和 `used_memory_ids`。
10. 项目页面提供只读 ProjectMemory 列表 + Markdown 导出。
11. 最小评测 harness 进 CI，断言召回率/精确率/延迟。
12. 不做 edge，不做 ShortTermMemory，不做 rebuild，不做人工编辑，不做 archive 流程，不做 reranker，不做时间衰减。

## 后续扩展

V1.1：

1. 阶段计划确认、任务拆解确认、高风险处理、成员约束更新、Pulse/check-in 确认事实等更多事件接入。
2. reranker（cross-encoder 或小型学习排序）。
3. agentic retrieval（LLM 按需调检索 tool）。
4. 显式时间衰减函数。
5. `owner_only` 可见性。
6. `confidence` / `consequences` / `evidence` 字段（ADR 风格）。
7. `valid_from` 时态字段。
8. 跨项目 `UserMemory` 表。
9. BEAM / LongMemEval 大规模评测。
10. Mem0 OSS 切换评估（若 sqlite-vec 召回不够）。

V2：

1. LongTermMemoryEdge 或轻量关系表。
2. 记忆冲突解决流程。
3. 独立短期记忆表。
4. 更细的检索评分和 reranker。
5. 按阶段生成记忆审计摘要。
6. 更完整的记忆重建后台任务。
7. 与范围裁决模块联动。
8. 与自我约束能力联动。
9. **分层记忆（借鉴腾讯 4 层金字塔）**：L0 事件 → L1 决策记忆（V1 的 ProjectMemory）→ L2 阶段聚合 → L3 项目画像。V2 加 L2/L3 聚合，用 Markdown 存上层。
10. Graphiti 时序图谱（从 ProjectMemory 事件流平滑迁移）。

## 验收标准

1. 普通聊天不会写入 ProjectMemory。
2. 只有方向卡确认、proposal 拒绝、分工最终确认、replan 确认/拒绝会触发 ProjectMemory 抽取。
3. 正式事件能生成包含 `content`、`rationale`、`source_type`、`source_id`、`memory_type`、`status`、`visibility` 的 ProjectMemory。
4. `source_hash` 不受 `created_at`、`updated_at` 等无关字段影响。
5. `source_type` 超出 V1 枚举时不能写入 ProjectMemory。
6. 同一 `project_id + source_type + source_id + memory_type + source_hash` 不重复写入（唯一索引兜底）。
7. ProjectMemory 创建后 best effort 同步到检索引擎，`ProjectMemorySync` 记录 `backend_memory_id` 和 `sync_status`。
8. 检索引擎返回的候选必须通过 SQLite 回查，不能直接注入 Agent。
9. `superseded`、`archived`、过期、不可见、项目不匹配、score 低于阈值的记忆不会注入 Agent 上下文。
10. 检索引擎同步或检索失败不阻塞正式项目流程；走降级链（sqlite-vec → FTS5 → 字段过滤 → none）。
11. AgentEvent 记录 `memory_used`、`memory_backend`、`used_memory_ids`、`retrieval_latency_ms`。
12. 用户能在项目内查看只读结构化记忆，分类只含 5 个主题；能导出 Markdown。
13. 最小评测 harness 进 CI，recall >= 90%、延迟 < 500ms、降级率 < 5%。
14. V1 不暴露写 API、不做 rebuild、不做 edge、不做 ShortTermMemory、不做人工编辑、不做 archive 流程、不做 reranker、不做时间衰减。
15. **Mem0 可选实现启用时**：`infer=False` 硬编码、`MEM0_TELEMETRY=False`、Mem0 history DB 不读不查，contract test 断言这三条。

## 与 V3 的差异

| 项 | V3 | V4 |
|---|---|---|
| 默认检索引擎 | Mem0 OSS + Qdrant | sqlite-vec + FTS5 + RRF（Mem0 降为可选） |
| 零配置 | 破坏（要起 Qdrant） | 保持 |
| 中文分词 | 未提 | jieba |
| top_k | 12 | 50 |
| 注入限制 | 固定 6 条 | token 预算 1500，硬顶 8 条 |
| score 阈值 | 无 | cosine >= 0.3 可配 |
| 表结构 | ProjectMemory 单表 | ProjectMemory + ProjectMemorySync 拆表 |
| 幂等索引 | 未提 | 唯一索引 idx_memory_idemp |
| 可见性 | 3 档（team/owner_only/subject_and_owner） | V1 只 2 档，owner 按作用域定义 |
| 4 类事件落点 | 假设已存在 | 逐条给代码改造方案（含 reject_proposal 写 AgentEvent） |
| T41 集成 | 模糊 | 明确：context-builder 固定输入，每 run 一次，extractor 在 FastAPI 事务后异步 |
| Markdown 导出 | 无 | 有（借鉴腾讯/echovault） |
| 评测 | 无 | 最小 harness 进 CI + 量化指标 |
| reranker | V1 不做 | V1 不做（一致），明确 V1.1 加 |
| AgentEvent 埋点 | memory_used/backend/ids | 加 retrieval_count/injected_count/latency |
| V2 分层 | 未提 | 借鉴腾讯 4 层金字塔，V2 加 L2/L3 |

## 自检

本方案 V1 从完整图谱方案收敛为 ProjectMemory 治理表 + 本地检索引擎 + Markdown 导出。

本方案没有让任何检索引擎成为事实源。所有状态、可见性、生命周期和注入资格都由 SQLite 中的 ProjectMemory 决定。

本方案没有开放人工维护长期记忆。用户通过改变正式项目事实来改变记忆。

本方案没有引入独立短期记忆表。

本方案没有引入自我约束能力。

本方案没有实现自动重建。

本方案没有自动捕获对话（拒绝腾讯方案的默认能力）。

本方案保持零配置默认部署（sqlite-vec 进程内，本地 embedding 离线）。

本方案遵守 T41 底座边界：sidecar 不读 DB、4 层写入、Proposal-Confirm 唯一人类确认边界、read-only 纯读、记忆注入走 context-builder 不走 LLM tool。
