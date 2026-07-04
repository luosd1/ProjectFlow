# T41 Agent Runtime Implementation — Lead Handoff (Robert)

## 角色

你是 T41 Agent Runtime 重构的 Lead，负责核心基础设施、跨切面关注点和最终收尾。

## 总体背景

ProjectFlow 要从固定 CoordinatorAgent 升级为工具化 Agent Runtime。架构已确定：TypeScript Agent Bridge Sidecar + Pi 组件级 Runtime + ProjectFlow Tool Contract + Durable AgentRunState + Proposal-Confirm Commit。架构选型不再讨论，以已提交文档为准。

## 关键文档

先读这些，按顺序：

1. `docs/PRD-Agent-Runtime.md` — 完整 PRD
2. `docs/T41/ProjectFlow_Agent_Runtime_Team_TDD.md` — 总方案
3. `docs/T41/ProjectFlow_Agent_Runtime_Foundation_Design.md` — 底座设计
4. `docs/T41/ProjectFlow_Agent_Tools_Skills_Design.md` — Tools & Skills 设计
5. `CONTEXT.md` — 领域词汇表
6. `docs/adr/0001-agent-runtime-confirmation-boundary.md`
7. `docs/adr/0002-tiered-agent-write-boundary.md`
8. `docs/adr/0003-use-replan-proposals-for-agent-inferred-task-state-changes.md`
9. `docs/adr/0004-keep-project-state-read-paths-pure.md`
10. `docs/T41/research/agent-write-boundary-research.md`
11. `docs/T41/research/read-path-state-mutation-research.md`

## Issue Tracker

- PRD: https://github.com/wubq511/ProjectFlow/issues/45
- 你的 slices: #46, #47, #49, #54, #55, #57
- 全部 issues 列表见 PRD #45 body

## 同步点与依赖关系

整个 T41 有两个硬同步点，其余时间三人可以完全独立并行。

### 同步点 1：S5 (Read-only tools) — 你的 S1+S2 必须先完成

```
你: S1 → S2 ──────┐
Member A: S3 ──────┼→ S5 (Member A 实现) → S6/S7/S8/S9 三线并行
Member B: S4 ──────┘
```

- S5 需要 S1 (schemas) + S2 (append API) + S3 (sidecar) + S4 (read purity) **全部完成**
- **你负责**：先完成 S1 再做 S2。S1 的 schemas 是其他所有人的类型基础。
- **触发条件**：你的 S1+S2 merge 到 main 后，通知 Member A 开始 S3（S3 等 S1 的类型定义）。Member B 的 S4 无依赖可以同步开始。
- **合流信号**：当 S1+S2+S3+S4 全部 merge 后，Member A 开始 S5。

### 同步点 2：S10 (Event bridge) — 你的 S9 必须先完成

```
S5 ──→ S6 (B) ──┐
     ──→ S7 (B) ──┼→ S9 (你) → S10 (你) → S11 (A)
     ──→ S8 (A) ──┘            └→ S12 (B)
```

- S10 需要 S6+S7+S8+S9 **全部完成**（需要所有工具 flows 的 event 才能做统一映射）
- **你负责**：S9 (replan migration)。S9 完成后开始 S10。
- **触发条件**：S5 merge 后，三人各自开始 S6/S7/S8/S9 并行。你的 S9 不依赖 S6/S7/S8，可以直接开始。
- **合流信号**：S9+S6+S7+S8 全部 merge 后，你开始 S10。

### 无同步点：可直接推进的 slices

- **S1**：无 blocker，立即开始
- **S4**：无 blocker，立即开始（与 S1 并行）
- **S2**：等 S1 完成
- **S9**：等 S5 完成（S5 merge 后直接开始，不需要等 S6/S7/S8）
- **S12**：等 S10 完成

## 你的 Slices（6 条）

### S1: Foundation schemas, manifest, tool result, event, trace → #46

**无 blocker，立即开始。这是其他所有 slices 的类型基础。**

- 定义 AgentRunState、Tool Manifest、ProjectFlowToolResult、RuntimeEvent、TraceEnvelope、Error Model
- Python SQLModel + TypeScript interface + snake_case/camelCase adapter 测试
- 写入 Boundary 层级定义清楚：Runtime Metadata / Reviewable Draft Record / Advisory Project Record / Primary Project State

### S2: FastAPI append/persistence API with idempotency → #47

**Blocked by S1。完成后通知 Member A 开始 S3。**

- AgentRun/AgentRunState SQLModel
- `POST /internal/agent-runs/{run_id}/events:append` — 原子提交 state_patch + events + tool_results
- Idempotency key 幂等、event_seq 按 run_id 单调分配
- Internal tool endpoint 框架 (`/internal/agent-tools/*`)

### S4: Read-only purity + State Repair Command → #49

**无 blocker，与 S1/S2 并行。**

- 移除 `get_project_state()` 中的 `_catch_up_stage_progress()`
- 新增显式 State Repair Command
- Read purity 回归测试

### S9: Check-in/replan migration → #54

**Blocked by S1+S2+S3+S4+S5+S6。S5 merge 后可直接开始（不依赖 S7/S8）。**

- `generate_replan_proposal` tool endpoint
- `analyze_checkins_and_risks` 不再直接调用 `create_status_update()`
- Agent 推断的 task status changes 走 replan proposal
- `POST /tasks/{task_id}/status-updates` 人类路径不变

### S10: Event bridge + trace envelope → #55

**同步点 2。等 S6+S7+S8+S9 全部完成后开始。**

- 完整 Pi → ProjectFlow event 映射
- Trace envelope 串起 run/tool/proposal 关联
- Proposal confirmation events
- Sidecar event stream → FastAPI → frontend

### S12: Legacy Coordinator parity + cutover → #57

**Blocked by S10。**

- Parity tests per migrated flow
- Idempotency/safety/reconciliation tests
- Feature flag 按 flow/tool 细粒度
- Coordinator 保留为 legacy adapter 直到全部 cutover

## 与其他成员的接口

**你产出、Member A 消费：**
- S1 schemas → A 的 S3 sidecar 需要 AgentRunState/Manifest/ToolResult 类型
- S2 append API → A 的 S3 sidecar 需要调用这个 API
- S10 event bridge → A 的 S11 前端需要消费 event stream

**你产出、Member B 消费：**
- S1 schemas → B 的 S6/S7 tool endpoints 需要 ToolResult/Manifest 类型
- S2 append API → B 的 S6/S7 tool endpoints 需要通过这个 API 持久化

**Member A 产出、你消费：**
- S3 sidecar → 你的 S10 event bridge 需要 sidecar 的 event stream

## 安全约束

- 不发布 npm 包或部署生产
- 不删除旧 Coordinator 直到 parity tests 通过
- 不提交 vendor imports 到 Git
- 密钥不进代码/commit/日志/traces
- `unknown` side effect status 禁止自动 fallback

## Suggested Skills

- `/to-issues` — 如需进一步拆分单个 slice
- `/design-sync` — 如需同步前端设计系统
