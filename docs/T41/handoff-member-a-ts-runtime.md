# T41 Agent Runtime Implementation — Member A Handoff (TS Runtime & Frontend)

## 角色

你是 T41 Agent Runtime 重构的 TypeScript Runtime & Frontend 负责人，负责 sidecar 骨架、read-only tools、assignment proposal tool 和前端集成。

## 总体背景

ProjectFlow 要从固定 CoordinatorAgent 升级为工具化 Agent Runtime。架构：TypeScript Agent Bridge Sidecar + Pi 组件级 Runtime + ProjectFlow Tool Contract + Durable AgentRunState + Proposal-Confirm Commit。

**核心原则：**
- FastAPI/DB 是唯一事实源，sidecar 不直接访问 DB
- LLM-callable tools 不能 commit Primary Project State
- Proposal Confirmation 是当前唯一的人类确认边界
- Read-only tools 不能修复或推进 Stage/Project
- 所有 tool call 恰好产生一个 terminal result
- snake_case 作为 canonical wire format

## 关键文档

先读这些：

1. `docs/PRD-Agent-Runtime.md` — 完整 PRD
2. `docs/T41/ProjectFlow_Agent_Runtime_Team_TDD.md` — 总方案（特别是 §2 推荐架构、§4 架构原则、§5 系统边界）
3. `docs/T41/ProjectFlow_Agent_Runtime_Foundation_Design.md` — 底座设计（特别是 §2 进程边界、§3 Sidecar 内部模块、§4 Runtime Loop、§6 Model/Provider、§7 Tool Hooks、§10 Event Bridge）
4. `docs/T41/ProjectFlow_Agent_Tools_Skills_Design.md` — Tools 设计（特别是 §3 Manifest、§4.1-4.3 read-only tools、§4.8 assignment）
5. `CONTEXT.md` — 领域词汇表
6. `docs/adr/0001-agent-runtime-confirmation-boundary.md`
7. `docs/adr/0002-tiered-agent-write-boundary.md`

## Issue Tracker

- PRD: https://github.com/wubq511/ProjectFlow/issues/45
- 你的 slices: #48, #50, #53, #56
- Lead (Robert) 的 slices: #46, #47, #49, #54, #55, #57
- Member B 的 slices: #49, #51, #52, #57

## 同步点与依赖关系

整个 T41 有两个硬同步点，其余时间三人可以完全独立并行。

### 同步点 1：S5 (Read-only tools) — 你实现，等其他人完成前置

```
Robert: S1 → S2 ──────┐
你: S3 (等 S1) ────────┼→ S5 (你实现) → S8 (你) / S6+S7 (B) / S9 (Robert) 三线并行
Member B: S4 ──────────┘
```

- **S3 阻塞**：等 Robert 的 S1 (schemas) 完成后才能开始。S1 给你 AgentRunState、Manifest、ToolResult 的 TypeScript 类型定义。
- **S5 阻塞**：等 S1+S2+S3+S4 **全部完成**后才能开始。
- **你的动作**：拿到 S1 类型定义后立即开始 S3。S3 完成后检查 S2 和 S4 是否也完成了。全部完成后开始 S5。
- **合流信号**：S5 完成后，通知 Robert 和 Member B 可以开始各自下一轮 slices。

### 同步点 2：S11 (Frontend integration) — 等 Robert 的 S10 完成

```
S9 (Robert) → S10 (Robert) → S11 (你)
```

- S11 需要 S10 (event bridge) 完成后才能开始，因为前端需要消费 event stream。
- **你的动作**：S8 完成后如果 S10 还没完成，可以先做前端准备工作（UI 组件骨架、mock stream），但完整集成要等 S10。

### 无同步点：可直接推进的 slices

- **S3**：等 S1 完成后直接开始
- **S8**：等 S5 完成后直接开始（不依赖 S6/S7/S9）
- **S11**：等 S10 完成后直接开始

## 你的 Slices（4 条）

### S3: Sidecar skeleton + Pi runtime adapter + mock tool loop → #48

**Blocked by S1 (Robert 产出)。拿到 schemas 后立即开始。**

- 新建 `agent-bridge/` TypeScript 项目，模块结构：runtime/, tools/, skills/, policy/, events/, server/
- 引入 `@earendil-works/pi-ai` + `@earendil-works/pi-agent-core`
- Pi runtime adapter：封装 Agent session + runAgentLoop
  - `beforeToolCall` → policy gate（参见 Foundation Design §7.1）
  - `afterToolCall` → result normalization（参见 Foundation Design §7.2）
  - `StreamFn` 失败 → agent.failed/tool.failed/runtime.error event
  - `transformContext` → Context Builder（不读 DB）
- Runtime API：POST /runs, POST /runs/{run_id}/cancel, GET /runs/{run_id}, GET /health
- FastAPI client：service-to-service token，不绕过 FastAPI
- Mock provider + mock tools 跑通完整 loop
- Policy engine：read_only→allow, draft_only→allow proposal only, destructive→block 等
- Event mapper：Pi event → ProjectFlow event
- Budget/timeout/cancel 机制

**关键约束：**
- sidecar 不持有 DB 凭据
- policy denied 返回结构化 observation（status=blocked, error.code=POLICY_DENIED），不抛异常
- cancel 后写 terminal AgentRunState 和 event
- Pi types 不暴露给外部

**验收标准：**
- [ ] `agent-bridge/` 项目结构创建完成
- [ ] Pi runtime adapter 封装完成
- [ ] `POST /runs` 跑通完整 mock tool loop
- [ ] Cancel/timeout/budget/policy 测试通过
- [ ] sidecar 不持有 DB 凭据

### S5: Read-only tools → #50

**同步点 1。等 S1+S2+S3+S4 全部完成后开始。**

- 实现 4 个 read-only tools 的 sidecar registration + manifest → Pi tool schema 转换：
  - `get_workspace_state` — POST /internal/agent-tools/workspace-state
  - `get_agent_conversation` — POST /internal/agent-tools/conversation
  - `list_pending_proposals` — POST /internal/agent-tools/pending-proposals
  - `get_timeline_slice` — POST /internal/agent-tools/timeline-slice
- 所有 manifest：risk_category=read_only, effects.effect_type=none, execution.mode=parallel
- read-only batch 允许 parallel execution
- provider parallel tool calls 只在所有暴露工具全是 read-only 且 manifest 允许时开启

**关键约束：**
- read-only 硬约束：不 session.add/delete，不 flush/commit，不调用写入服务
- 结果有大小限制

**验收标准：**
- [ ] 4 个 tools 注册完成，manifest 正确
- [ ] sidecar 能通过 FastAPI client 调用这些 endpoints
- [ ] read-only 无副作用 contract test 通过
- [ ] parallel execution 测试通过

### S8: Typed assignment proposal tool → #53

**Blocked by S5。S5 完成后直接开始（不依赖 S6/S7/S9）。**

- `recommend_assignment` tool：risk_category=draft_only, effects.effect_type=proposal_create
- Internal endpoint POST /internal/agent-tools/assignment-recommendation
- 创建 AssignmentProposal（recommended owner + backup owner + reasons），不写 Task.owner_user_id
- side_effect_status=proposal_persisted, 返回 created_ids
- 保留现有 assignment confirm/finalize 流程
- Idempotency：同 key 不重复创建

**关键约束：**
- AssignmentProposal 是 typed Reviewable Draft Record，不是 generic AgentProposal
- final owner 只能由 finalize_assignment_proposal() 写入
- tool result 不能让模型误以为 owner 已 finalized

**验收标准：**
- [ ] tool manifest 和 endpoint 实现完成
- [ ] 创建 AssignmentProposal 不写 Task.owner_user_id
- [ ] idempotency 测试通过
- [ ] 现有 assignment flow 测试继续通过

### S11: Frontend integration → #56

**同步点 2。等 Robert 的 S10 (event bridge) 完成后开始。**

- 前端发起 Agent run（调 POST /runs），接收 SSE/WebSocket stream
- 展示 runtime status、token stream、tool timeline
- Proposal：pending proposal 带 confirm/reject action，confirm 后状态更新
- Advisory：Risk/ActionCard 展示为 "已记录"，有 dismiss/resolve/done
- AssignmentProposal：展示推荐 owner，支持 response/finalize
- Run state 展示 + cancel 按钮
- Sidecar fallback 路径清晰

**关键约束：**
- 不依赖 Pi 原生 event
- 不直接调用 sidecar 工具
- 前端不决定 commit 结果，只触发 FastAPI API
- 使用 `../scripts/npm` 而非直接 npm

**验收标准：**
- [ ] stream 接收和展示
- [ ] proposal confirm/reject
- [ ] advisory dismiss/resolve
- [ ] `../scripts/npm run test` / `lint` / `build` 通过

## 与其他成员的接口

**Lead (Robert) 产出、你消费：**
- S1 schemas → 你的 S3 需要 AgentRunState/Manifest/ToolResult 类型
- S2 append API → 你的 S3 sidecar 需要调用这个 API
- S10 event bridge → 你的 S11 前端需要消费 event stream

**你产出、Lead 消费：**
- S3 sidecar → Lead 的 S10 event bridge 需要 sidecar event stream

**你产出、Member B 消费：**
- S5 read-only tools → Member B 的 S6/S7 需要 list_pending_proposals 来避免重复 proposal

## 开发环境

```bash
# Sidecar (新建)
cd agent-bridge
npm install   # 或 pnpm install

# Frontend
cd frontend
../scripts/npm install
../scripts/npm run dev

# 测试
cd frontend
../scripts/npm run test
../scripts/npm run lint
../scripts/npm run build
```

## 安全约束

- 不发布 npm 包
- 密钥不进代码/commit/日志
- sidecar 不持有 DB 凭据
- Pi types 不暴露给 FastAPI

## Suggested Skills

- `/design-sync` — 如需同步前端设计系统
