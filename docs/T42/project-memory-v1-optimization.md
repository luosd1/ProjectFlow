# T42 Project Memory V1 方案优化（基于 4 份深度调研 + 代码对齐）

> 本文档是 V3 方案的**优化补充**，不是替代。每条改动标注：**优先级（P0 阻塞 / P1 V1 应做 / P2 V1.1+）+ 来源（调研 N / 代码对齐 / 设计判断）+ 理由**。确认后 fold 进 V3。
>
> 调研来源：
> - R1 = `deep-research-report (1).md`（Mem0 OSS 事实）
> - R2 = `deep-research-report (2).md`（候选对比）
> - R3 = `deep-research-report (3).md`（评估+检索）
> - R4 = `deep-research-report (4).md`（数据模型+可见性）
> - 代码对齐 = 我核对源码发现的事实（见原 prompt 2.10 节）

---

## 一、总评

V3 方向正确：**ProjectMemory 治理表 + 外部可替换检索引擎 + 正式事件驱动写入 + 二次过滤**。但有 **4 个 P0 阻塞项**不解决 V1 无法上线，另有若干 P1 优化。核心变化：

1. Mem0 接入有 3 个默认值必须显式覆盖（`infer=False` / 遥测关 / history DB 边界），否则会污染治理表。
2. V3 假设的 4 类正式事件在当前代码里**没有一处直接对得上**，必须先改造 service 层让正式事件可订阅。
3. 检索 funnel（top_k=12→inject 6）不合理，要改。
4. 选型层面：sqlite-vec 是更贴合 ProjectFlow "零配置演示优先" 的 V1 默认，Mem0 降为可选增强——**这条需要你拍板**。

---

## 二、P0 阻塞项（不解决 V1 无法上线）

### P0-1：Mem0 `infer=False` 强制 + 遥测关闭 + history DB 边界 【来源 R1 Q2/Q4/Q8/Q12】

**问题**：
- `Memory.add()` 默认 `infer=True`，会调 LLM 抽取关键事实，存进 Mem0 的内容会和 ProjectMemory 治理表的 `content` 对不上 → 回查失败。
- Mem0 默认开遥测，会发使用数据到 Mem0。
- Mem0 自带 SQLite history DB，"外部治理 + Mem0 纯索引" 是非典型用法；Mem0 不知道哪些记忆已 superseded，只能靠 metadata 过滤。

**改动**：
1. `Mem0MemoryIndexBackend.add()` 硬编码 `infer=False`，contract test 断言传入参数。
2. 配置强制 `MEM0_TELEMETRY=False`，写进 `.env.example` 和 sidecar config。
3. 明确边界：Mem0 history DB **不作事实源、不读、不查**；检索只走 `search()` → 拿 metadata.memory_id → 回查 ProjectMemory 表过滤。Mem0 history DB 仅作 Mem0 内部审计，可忽略。
4. `MemoryIndexBackend` 抽象只暴露 `index(memory)` / `search(query, filters, top_k)` 两个方法，不暴露 update/delete（Mem0 V3 已是 ADD-only，契合）。

### P0-2：4 类正式事件的代码对齐改造 【来源 代码对齐】

**问题**（原 prompt 2.10 节已核实）：V3 的 4 类 source_type 在当前代码里落点都对不上。

**改动**：每类事件给具体 hook 方案——

| V3 source_type | 当前代码 | 改造方案 |
|---|---|---|
| `direction_card_confirmed` | `agent_proposal_service.confirm_proposal(proposal_type="clarify")` → `_persist_clarification` 写 `Project.direction_card` | **不新增独立事件**。在 `confirm_proposal` 末尾按 `proposal_type` 分派 extractor：`proposal_type=="clarify"` 且 payload 含 direction_card → 调 `memory_service.extract_from_event(source_type="direction_card_confirmed", source_id=proposal.id)`。不扩 `AgentEventType` enum。 |
| `proposal_rejected` | `reject_proposal()` 只翻 status + 存 `rejection_reason`，**不写 AgentEvent** | **改造 `reject_proposal` 写一条 timeline AgentEvent**（复用 `AgentEventType` 现有值 + `AgentEventStatus.failed` 或新增 status 标记 rejected），存 `rejection_reason`。extractor hook 在这条 AgentEvent 上。`source_id=AgentEvent.id`。**注：这条改造影响 timeline/前端/parity tests，需同步评估。** |
| `assignment_confirmed` | `assignment_service.finalize_assignment_proposal()`（独立 `AssignmentProposal` 模型，status→`finalized`） | 在 `finalize_assignment_proposal` 末尾 hook extractor，`source_id=AssignmentProposal.id`。extractor 要支持 `AssignmentProposal` 作 source（不是 `AgentProposal`）。成员 accept/reject 不抽记忆（只 finalize 抽）。 |
| `replan_confirmed` / `replan_rejected` | **两条路径并存**：(a) `confirm_proposal(proposal_type="replan")` → `_persist_replan`；(b) `replan_service.confirm_replan()` 不创建 AgentProposal | **V1 只 hook 路径 (a)**（`confirm_proposal(proposal_type="replan")`）。路径 (b) 的统一属于 T41 范围，不阻塞 T42——但要记录为 T41 待办。replan 拒绝 hook 在 `reject_proposal(proposal_type="replan")`（依赖 P0-2 的 reject 改造）。 |

**extractor 调用方式**：在上述 service 函数 `session.commit()` **之后**异步调用 `memory_service.extract_from_event(...)`（不阻塞正式事件、不回滚事务）。extractor 内部再开新 session 写 ProjectMemory。失败只记日志，不回滚正式事件（符合 V3 "记忆抽取失败不阻塞正式事件"）。

### P0-3：选型决策——V1 默认检索引擎 【来源 R2 + 项目约束】

**问题**：V3 选 Mem0 OSS + Qdrant。但 ProjectFlow CLAUDE.md 明确 "本地演示优先，零配置"。Mem0+Qdrant 需要额外起 Qdrant 服务，**破坏零配置**。R2 指出 sqlite-vec 是零依赖可行替代，对百~千条记忆规模召回质量够用。

**两条路**：

| 方案 | 优点 | 缺点 |
|---|---|---|
| **A：Mem0 OSS + Qdrant**（V3 原选） | 混合检索（BM25+embedding+entity），召回质量高，成熟 | 破坏零配置（要起 Qdrant）；`infer=False` 等坑；Mem0 history DB 治理边界 |
| **B：sqlite-vec + 自写检索**（R2 推荐） | 零新服务，留在 SQLite，零配置保持；治理最简单 | 召回质量略低（无 BM25/entity，除非自己加 FTS5）；检索逻辑自己写 |

**我的建议**：**V1 默认用 B（sqlite-vec），Mem0 作为可选 `MemoryIndexBackend` 实现**。理由：
- ProjectFlow 是演示优先的大学项目工具，零配置是硬约束。
- 单项目记忆量级百~千条，sqlite-vec 召回质量够（R2 结论）。
- `MemoryIndexBackend` 抽象保留，未来切 Mem0/Graphiti 不改业务层。
- Mem0 不删，作为"想要更好召回的团队"的可选配置（文档说明 + 配置开关）。

**这条需要你拍板**：A 还是 B 作 V1 默认。下面所有 P0/P1 都按 B 写，若选 A 则 P0-1 生效、P0-3 改为 Mem0 配置。

### P0-4：`reject_proposal` 写 timeline 事件的回归评估 【来源 代码对齐】

P0-2 要求 `reject_proposal` 写 AgentEvent。这会改动现有 timeline 行为，可能影响：
- 前端 timeline 渲染（多一条 rejected 事件）
- parity tests
- AgentEvent 查询

**改动**：先跑一遍现有 reject 路径的测试，确认加 AgentEvent 不破坏 parity。若破坏，需同步改前端/测试。**这条是 P0-2 的子任务，但风险独立，单列。**

---

## 三、P1 V1 应优化

### P1-1：检索 funnel 改造 【来源 R3 Q6/Q10/Q11】

**问题**：V3 的 `top_k=12 → inject 6` 两处都不合理。R3 指出 Mem0 benchmark 用 top_k=200，12 太小漏召回；inject 按条数限不对，应按 token 预算。

**改动**：
1. 召回 `top_k` 从 12 调到 **50**（sqlite-vec 方案下也可调，成本低）。
2. 注入从"最多 6 条"改为"**最多 1500 token**"（按 content+rationale 累加，超预算停）。保留条数上限 8 作硬顶防极端情况。
3. 二次过滤后按场景重排，从重排结果里按 token 预算取。

### P1-2：相关性阈值 + 时间过滤 【来源 R3 Q12/Q14】

**改动**：
1. 检索结果加 **score 阈值**：低于阈值的丢弃（sqlite-vec 给 cosine score，阈值初始 0.3，可配）。
2. `valid_until` 过滤写进检索 SQL（`valid_until IS NULL OR valid_until > now`）。
3. V1 不做显式时间衰减函数（`valid_until` + `superseded` 已够），V1.1 再考虑指数衰减。

### P1-3：ProjectMemorySync 表拆分 【来源 R4 Q18】

**改动**：把 `backend` / `backend_memory_id` / `sync_status` 从 ProjectMemory 拆到 `ProjectMemorySync`（一对一，`memory_id` 外键）。ProjectMemory 主表只剩业务字段，更干净。

```python
class ProjectMemory(SQLModel, table=True):
    # 业务字段：id, workspace_id, project_id, memory_type, scope, content, rationale,
    # source_type, source_id, source_hash, status, visibility, subject_user_id,
    # related_stage_id, related_task_id, related_risk_id, valid_until,
    # superseded_by_memory_id, extractor_version, schema_version,
    # created_at, updated_at

class ProjectMemorySync(SQLModel, table=True):
    memory_id: str  # FK -> project_memories.id
    backend: str = "sqlite_vec"  # 或 "mem0"
    backend_memory_id: str | None = None
    sync_status: str = "pending"
    last_synced_at: datetime | None = None
    last_error: str | None = None
```

### P1-4：幂等复合唯一索引 【来源 R4 Q19】

**改动**：在 ProjectMemory 加唯一索引：
```sql
CREATE UNIQUE INDEX idx_memory_idemp
ON project_memories(project_id, source_type, source_id, memory_type, source_hash);
```
保证同一正式事件不重复生成 active memory。extractor 写入前先查这个键，命中则跳过或 supersede。

### P1-5：可见性只实现 2 档 + owner 按作用域定义 【来源 R4 Q12/Q13】

**改动**：
1. V1 只实现 `team` 和 `subject_and_owner`，`owner_only` 推迟（不阻塞）。
2. owner 定义按 scope：
   - `scope=project` → `Project.created_by`
   - `scope=stage` → 阶段负责人（若模型没有，fallback 到 `Project.created_by`）
   - `scope=task` → `Task.owner_user_id`（若未分配，fallback 到 `Project.created_by`）
   - `scope=member` → `subject_user_id` 本人 + `Project.created_by`
3. Agent 输出若参考了 `subject_and_owner` 记忆，建议本身也标 `subject_and_owner`（防泄露，R4 Q15）。

### P1-6：AgentEvent 记忆埋点 【来源 R3 Q5 + V3 原设计】

**改动**：AgentEvent 的 `output_snapshot` 加记忆使用摘要（不扩 `AgentEventType`，用 metadata）：
```json
{
  "memory_used": true,
  "memory_backend": "sqlite_vec | mem0 | none",
  "used_memory_ids": ["..."],
  "retrieval_count": 50,
  "injected_count": 5,
  "retrieval_latency_ms": 120
}
```
`memory_backend = none` 表示无可用记忆或检索整体失败。

### P1-7：最小评测 harness 【来源 R3 Q4】

**改动**：V1 必做最小评测（不跑 BEAM/LongMemEval，自建小 harness）：
1. 构造固定项目场景（2 阶段、5 任务、3 成员）+ 手工插 10 条 ProjectMemory。
2. 写 5 个检索场景（澄清决策原因 / 分工查询 / replan 取舍 / 风险回顾 / 跨任务关联），每个标注期望召回的 memory_id。
3. mock LLM，调 `memory_service.get_context_for_agent`，断言：期望记忆全召回（recall=100%）、无关记忆不出现（precision）、延迟 < 500ms。
4. 进 CI，每次改检索逻辑跑一遍。

### P1-8：T41 集成边界（记忆如何进入 sidecar） 【来源 设计判断】

**改动**：明确记忆上下文进入 sidecar 的方式——**作为 context-builder 的固定输入，不作为 LLM-callable tool**。
1. FastAPI 在创建 AgentRun 前，调 `memory_service.get_context_for_agent(project_id, event_type, user_id)`，结果作为 `run input` 的一个字段 `project_memories` 传给 sidecar。
2. sidecar context-builder 把 `project_memories` 放进 dynamic suffix，用 `<project_memories>` XML 标签包裹（V3 原设计）。
3. **不注册 `get_project_memory_context` 为 LLM-callable tool**（避免 agentic retrieval 复杂度，V1.1 再考虑）。
4. sidecar 不直连检索引擎，符合 "sidecar 不读业务事实"。
5. 检索时机 = 每次 run 开始一次（不是每 tool call），简单可控。

**理由**：V1 要简单可控；agentic retrieval（让 LLM 主动调检索工具）留 V1.1。固定注入符合 V3 原设计，也符合 T41 "context-builder 组装上下文" 的职责。

---

## 四、P2 V1.1+ 考虑（不进 V1，记录留档）

| 项 | 来源 | 说明 |
|---|---|---|
| reranker（cross-encoder / LLM rerank） | R3 Q7 | V1 先用 sqlite-vec cosine + 场景重排，V1.1 加 reranker 提精度 |
| agentic retrieval（LLM 主动调检索 tool） | R3 Q15 | V1 固定注入，V1.1 让 LLM 按需调 |
| `confidence` / `consequences` / `evidence` 字段 | R4 Q17 | ADR 风格扩展，V1.1 加 |
| `valid_from` 时态字段 | R4 Q8 | 配合 `valid_until` 做时态查询，V1.1 |
| `parent_memory_id` 决策树 | R4 Q17 | V2 决策关联 |
| 跨项目 `UserMemory` 表 | R4 Q14 | 成员级偏好/约束跨项目共享，V1.1 |
| `owner_only` 可见性 | R4 Q12 | V1.1 按需求加 |
| 显式时间衰减函数 | R3 Q14 | V1.1 |
| BEAM / LongMemEval 评测 | R3 Q1-Q3 | V1.1 大规模评测 |
| 接入更多正式事件（阶段计划确认、任务拆解确认、Pulse 确认） | V3 原设计 V1.1 | |
| Graphiti V2 时序图 | R2 | V2，从 ProjectMemory 事件流平滑迁移 |
| Mem0 OSS 切换评估 | R2 | 若 sqlite-vec 召回不够，V1.1 切 Mem0+Qdrant |

---

## 五、字段改动清单（ProjectMemory 表）

**新增**：
- 无 P0/P1 必加字段（V1 保持精简）。

**删除/迁移**：
- `backend` / `backend_memory_id` / `sync_status` → 迁到 `ProjectMemorySync` 表（P1-3）。

**改语义**：
- `visibility` V1 只用 `team` / `subject_and_owner`（P1-5）。
- `source_type` 枚举不变（5 种），但 extractor 落点按 P0-2 改造。

**索引新增**（P1-4 + R4 Q19）：
```sql
CREATE UNIQUE INDEX idx_memory_idemp
  ON project_memories(project_id, source_type, source_id, memory_type, source_hash);
CREATE INDEX idx_memory_valid_until ON project_memories(valid_until);
CREATE INDEX idx_memory_superseded ON project_memories(superseded_by_memory_id);
CREATE INDEX idx_memory_subject_proj ON project_memories(project_id, subject_user_id);
```

---

## 六、选型确认（待你拍板）

| 决策 | 选项 | 我的建议 |
|---|---|---|
| V1 默认检索引擎 | A=Mem0+Qdrant / B=sqlite-vec | **B**（零配置优先） |
| Mem0 是否保留 | 保留作可选 / 删除 | 保留作可选 `MemoryIndexBackend` 实现 |
| `reject_proposal` 改造 | 写 AgentEvent / 不写 | 写（P0-2/P0-4 依赖） |
| replan 两路径统一 | T42 统一 / 留 T41 | 留 T41，T42 只 hook 路径 (a) |
| `owner_only` | V1 实现 / 推迟 | 推迟到 V1.1 |

---

## 七、待你确认的开放问题

1. **选型 A 还是 B？** 这是最大的分叉。B 保持零配置但召回略低；A 召回高但破坏零配置。
2. **`reject_proposal` 写 AgentEvent 的前端影响**：前端 timeline 会多一种 rejected 事件，要不要 V1 就显示？还是只后端记录、前端不渲染？
3. **replan 路径 (b) `replan_service.confirm_replan` 不走 AgentProposal**：V1 只 hook 路径 (a) 意味着路径 (b) 的 replan 确认不产生记忆。可接受吗？还是要推动 T41 先统一两条路径？
4. **Mem0 history DB**：确认"忽略不读"可接受？还是需要找配置禁用？
5. **评测 harness 进 CI**：V1 就进 CI 还是先手动跑？

---

## 八、确认后的下一步

你拍板上述决策后，我会：
1. 把本 delta 文档 fold 进 V3，产出 `project-memory-design-v4.md`（V1 最终设计）。
2. 基于 v4 写 T42 的 vertical-slice issues（类似 T41 的 issue 拆法），交给两个小组执行。
3. P0-2 的 service 改造（`reject_proposal` 写 AgentEvent 等）单列 issue，标注和 T41 的依赖关系。
