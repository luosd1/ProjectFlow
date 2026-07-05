# 调研任务 4/4：记忆数据模型 + 可见性设计模式（参考成熟产品）

你是一位熟悉 SaaS 产品数据建模、审计/历史追踪和权限设计的资深产品架构师。请调研"决策历史 + 理由 + 可追溯 + 可见性"在成熟产品里怎么建模，结论用于优化 ProjectFlow `ProjectMemory` 表结构和可见性模型。每条结论附 **产品文档/论文/源码链接**。

---

## 一、项目背景（必读）

### ProjectFlow 是什么
面向大学生项目小队的**主动推进型 AI Agent**。核心价值不是记录任务，而是持续回答：项目该往哪走？下一步做什么？谁适合做什么？哪些有风险？计划是否调整？当前 MVP 已闭环，但 Agent 只依赖当前状态和最近一轮对话，存在"不知道当初为什么这么做"的致命问题。

### 技术栈
- 前端：Next.js + React + TypeScript + Tailwind + shadcn/ui
- 后端：FastAPI + Python 3.11 + SQLModel + SQLite
- Agent：legacy `CoordinatorAgent` → T41 Agent Runtime（TypeScript sidecar + Pi runtime）

### T41 Agent Runtime 目标架构
- FastAPI/DB 是唯一事实源；sidecar 不读写 DB；4 层写入边界；Proposal-Confirm 唯一人类确认边界。
- 记忆系统是 T42 功能增强。

### V3 Project Memory V1 数据模型（本次调研对象）

```python
class ProjectMemory(SQLModel, table=True):
    id: str
    workspace_id: str
    project_id: str
    memory_type: str  # direction / boundary / plan / assignment / tradeoff / rejection / member_constraint
    scope: str  # project / stage / task / member / risk
    content: str          # 可被 Agent 引用的结论
    rationale: str        # 当时为什么这么决定
    source_type: str      # direction_card_confirmed / proposal_rejected / assignment_confirmed / replan_confirmed / replan_rejected
    source_id: str
    source_hash: str | None = None   # SHA256 of 稳定 JSON 序列化，用于幂等
    status: str = "active"            # active / superseded / archived
    visibility: str = "team"          # team / owner_only / subject_and_owner
    subject_user_id: str | None = None
    related_stage_id: str | None = None
    related_task_id: str | None = None
    related_risk_id: str | None = None
    valid_until: datetime | None = None
    superseded_by_memory_id: str | None = None   # 单向链
    backend: str = "mem0"
    backend_memory_id: str | None = None
    sync_status: str = "pending"
    extractor_version: str = "v1"
    schema_version: str = "v1"
    created_at: datetime
    updated_at: datetime
```

幂等规则：同一 `project_id + source_type + source_id + memory_type + source_hash` 不重复生成 active memory。

可见性：
- `team`：团队可见
- `owner_only`：负责人可见
- `subject_and_owner`：相关成员本人和负责人可见
- V1 若角色模型不足，先只实现 `team` 和 `subject_and_owner`；`owner_only` 不作阻塞项。

V1 不做：LongTermMemoryEdge 图结构、独立 ShortTermMemory 表、人工编辑/删除、自动重建、冲突自动裁决。

### 调研结果用途
结论喂给另一个 AI Agent（基于 Claude）优化 V3 表结构和可见性。要具体、带链接、给字段级改动建议。

---

## 二、调研问题

### 2.1 成熟产品怎么建模"决策历史 + 理由"

1. **Linear** 的 project / issue history：存什么、能查"当初为什么这么决定"吗、有没有 decision log 概念。
2. **GitHub** issue timeline + PR review comments：怎么记录"这个决定为什么做"（review comment + label + milestone 变更）。
3. **Jira** issue history + "Decision" issue type / ADF（Atlassian Decision Framework）：企业怎么记决策理由。
4. **Notion** page history + comments：版本化 + 决策记录的 pattern。
5. **Asana** / **ClickUp** / **Monday** 的 task stories / activity log：和"记忆"的差别。
6. **ADR（Architecture Decision Records）**：业界记"决策 + 理由 + 状态 + 上下文"的标准格式。ProjectMemory 能否借鉴 ADR 结构（context / decision / consequences / status）。给具体字段映射建议。

### 2.2 数据建模 pattern

7. **事件溯源 vs 状态快照**：ProjectMemory 是"决策事件"还是"决策状态"？业界怎么区分。ProjectFlow 的 `source_type/source_id/source_hash` 已经是事件溯源味，但 `status=active/superseded` 又是状态。这个混合合理吗？
8. **temporal tables / bitemporal pattern**：对"决策随时间变化、保留历史"的场景，temporal table vs `superseded_by_memory_id` 单向链 vs 软删除，各有什么 tradeoff。ProjectFlow 单向链够用吗？需要反向 `supersedes` 吗？需要 `valid_from` 吗（现在只有 `valid_until`）？
9. **`source_hash` 防重复**：对哪些字段哈希、如何处理"事实源变了但记忆语义没变"、"事实源没变但 extractor 升级了"。业界 dedup hash 的最佳实践。
10. **记忆 vs audit log**：ProjectMemory 是记忆还是 audit？两者要不要分开表。业界（如 Linear、GitHub）怎么分。
11. **`extractor_version` / `schema_version` 迁移**：记忆 schema 升级不丢历史的策略。业界做记忆/事件 schema 演进的 pattern（如 expand-contract）。

### 2.3 可见性 / 权限

12. **三档够不够**：`team / owner_only / subject_and_owner` 对"决策理由"场景够吗？成熟产品怎么对"拒绝原因""成员约束""绩效相关"做权限。
13. **"负责人"指代**：workspace owner / project creator / stage owner / task owner——ProjectFlow 该用哪个作 `owner_only` 的 owner？业界多角色场景怎么定 visibility owner。
14. **跨项目记忆**：同一成员在多个项目的约束（如"小林每周只能接 10h"）是否需要跨项目可见？业界 SaaS 怎么处理"用户级偏好/约束"vs"项目级记忆"。
15. **Agent 输出可见性**：Agent 参考了 `subject_and_owner` 记忆后生成建议，建议的可见性怎么定（不能泄露给无权用户）。业界 pattern。
16. **记忆权限审计**：是否需要"谁看过这条记忆"的 audit。V1 要不要做。

### 2.4 字段级建议

17. **缺失字段评估**：是否需要 `confidence` / `evidence` / `tags` / `created_by_agent_event_id`（直接关联来源事件，而不是只 source_id）/ `parent_memory_id`（决策树）/ `project_phase`（项目阶段，用于检索）？
18. **冗余字段评估**：`backend` / `backend_memory_id` / `sync_status` 是否该拆到单独 `ProjectMemorySync` 表（一对一），让治理表更干净？
19. **索引建议**：V3 给的索引（project_id+status / workspace_id+project_id / source_type+source_id / related_* / subject_user_id / sync_status）够吗？补哪些。

---

## 三、输出格式

按问题编号逐条回答：

```
### N. <问题>
**结论**：<具体建议>
**依据**：<产品文档/论文/源码链接>
**对 V3 的具体改动**：<字段增删 / 可见性调整 / 表拆分——可空>
```

最后给：
- **ProjectMemory 表字段改动清单**（增 / 删 / 改类型 / 改语义，每条带理由）
- **可见性模型最终建议**（V1 实现哪几档，owner 怎么定）
- **V1.1+ 字段预留建议**（哪些字段现在不加但要给未来留钩子）

不要泛论。每个结论要有产品或文献链接。重点是**字段级、可执行**的改动建议。
