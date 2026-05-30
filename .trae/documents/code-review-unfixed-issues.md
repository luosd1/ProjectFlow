# ProjectFlow 代码审查 — 未修复问题清单

> 更新日期：2026-05-30 | 基于全量代码审查，已排除 18 项已修复问题

---

## P0 — 必须立即修复

### 1. 零认证/零授权 — 全部 API 裸奔

**位置**: 全部 22 个路由文件  
**现状**: 没有任何认证中间件、JWT、Session 或 API Key 校验。任何人可：
- 调用 `POST /api/seed/reset` 清空数据库
- 调用 `POST /api/llm/diagnostic` 消耗 LLM 额度
- 读写任何 workspace/project 数据（IDOR）

**子问题**:
- Seed/Reset 端点无保护（`routes_seed.py:36`、`routes_demo.py:12`）
- LLM 诊断端点接受明文 API Key（`routes_llm.py:16`）
- 所有带 ID 的端点无资源归属校验

**修复方向**: 添加 `Depends(get_current_user)` 预留接口；Seed/Reset/Demo 加 admin 权限；LLM diagnostic 移除请求体传 API Key 能力

### 2. React 18 + Next.js 16 版本冲突

**位置**: `frontend/package.json`  
**现状**: `"next": "^16.2.6"` 搭配 `"react": "18.2.0"`  
**后果**: Server Components 行为异常、类型定义不匹配、运行时可能崩溃  
**修复方向**: 升级 React 到 19.x，需评估对现有组件的影响面

---

## P1 — 本周修复

### 3. 模型枚举字段未使用 Enum 类型

**位置**: 18 个模型字段用裸 `str` 而非对应 Enum  
**影响范围**:

| 模型 | 字段 | 应使用的枚举 |
|------|------|-------------|
| WorkspaceMembership | role | WorkspaceRole |
| Project | status | ProjectStatus |
| Stage | status | StageStatus |
| Task | priority / status | TaskPriority / TaskStatus |
| TaskStatusUpdate | status | TaskStatus |
| AssignmentProposal | status | AssignmentProposalStatus |
| AssignmentResponse | response | AssignmentResponseType |
| AssignmentNegotiation | status | NegotiationStatus |
| CheckInCycle | status | CheckInCycleStatus |
| CheckInResponse | mood_or_confidence | MoodOrConfidence |
| Risk | type / severity / status | RiskType / RiskSeverity / RiskStatus |
| ActionCard | type / status | ActionCardType / ActionCardStatus |
| Invitation | status | InvitationStatus |
| ProjectResource | type | ResourceType |

**后果**: 数据库可存任意字符串，无约束；写入非法值后 Read schema 的 Enum 校验会 500  
**修复方向**: 模型字段改为 Enum 类型，需配合数据库迁移

### 4. 缺失唯一约束

| 表 | 需要的唯一约束 | 后果 |
|----|--------------|------|
| workspace_memberships | (workspace_id, user_id) | 同一用户可重复加入同一工作台 |
| member_profiles | (user_id, workspace_id) | 同一用户在同一工作台可有多份档案 |
| invitations | token | token 不唯一，邀请链接可能冲突 |
| users | email（当非 None 时） | 邮箱可重复注册 |

### 5. 缺失外键索引

全部外键字段无索引。高频查询必需的索引：

| 表 | 需要索引的字段 |
|----|--------------|
| projects | workspace_id, status |
| stages | project_id, order_index |
| tasks | project_id, stage_id, owner_user_id, status |
| assignment_proposals | task_id, project_id, status |
| risks | project_id, status |
| action_cards | project_id, user_id, status |
| agent_events | project_id, workspace_id |
| agent_proposals | project_id, status |
| invitations | token, workspace_id |

### 6. Schema 零字段约束

全部 Create/Update schema 无 `Field(min_length=..., ge=...)` 调用：

| Schema | 字段 | 问题 |
|--------|------|------|
| UserCreate | display_name | 无 min_length，可传空字符串 |
| UserCreate | email | 无格式校验 |
| WorkspaceCreate | name | 无 min_length/max_length |
| ProjectCreate | deadline | 无未来日期校验 |
| TaskCreate | estimated_hours | 默认 0.0，无 ge=0，可传负数 |
| MemberProfileCreate | available_hours_per_week | 默认 0.0，无 ge=0 |
| StageCreate | start_date / end_date | 无 start_date < end_date 校验 |
| CheckInCycleCreate | cadence_days | 无 gt=0，可传 0 或负数 |

### 7. Read schema 缺 `from_attributes=True`

**位置**: 全部 20+ Read schema  
**现状**: API 路由层使用手写 `_xxx_to_read()` 转换函数，`json.loads()` 无 try/except  
**后果**: 每次 model 加字段必须同步修改 3 处；JSON 损坏时 500 而非 422  
**修复方向**: 添加 ConfigDict，逐步替换手写 converter

### 8. 业务逻辑泄漏到路由层

- `routes_export.py:46-251` — 200 行业务逻辑在路由中，包含 8 次数据库查询
- 6 个路由文件的 `_to_read` JSON 反序列化应在 service/model 层

### 9. 业务逻辑泄漏到前端页面

- `projects/[projectId]/page.tsx` — 约 230 行业务逻辑（handler、数据加载、AGENT_RUNNERS 映射）
- `projectflow-home.tsx:76-90` — demo seed 加载逻辑内联在 onClick 中

**修复方向**: 抽取到 `useProjectDashboard` hook 和 service 函数

### 10. 10+ 组件英文文案未中文化

**违反**: AGENTS.md "UI 语言统一中文"  
**影响范围**: stage-plan-board、task-breakdown-board、risk-card、action-card、timeline 等约 10 个组件、100+ 处英文文案  
**修复方向**: 抽取到 constants.ts 或 i18n 映射，统一为中文

### 11. AppShell 无 Error Boundary

**位置**: `app-shell.tsx:200-206`  
**后果**: 子组件运行时错误导致整页白屏  
**修复方向**: 添加 React Error Boundary；至少为 `app/`、`app/projects/[projectId]/`、`app/workspaces/[workspaceId]/` 添加 `error.tsx`

---

## P2 — 后续修复

### 12. 日期字段全部用 `str` 而非 `datetime`

7 个字段存储 ISO 日期字符串：Project.deadline、Stage.start_date/end_date、Task.due_date、CheckInCycle.start_date/next_due_date、ActionCard.due_date  
**后果**: 无法在数据库层做日期比较/排序优化；格式错误只能在应用层捕获

### 13. 空字符串 vs None 不一致

Task.due_date、MemberProfile.role_preference/interests/constraints、AssignmentNegotiation.agent_message 默认空字符串  
**后果**: `WHERE x IS NULL` 和 `WHERE x = ''` 结果不同，增加 service 层复杂度

### 14. 缺失 `updated_at` / `created_at` 字段

| 模型 | 缺失 |
|------|------|
| Stage | created_at + updated_at |
| Task | created_at |
| AssignmentProposal | updated_at |
| Risk | updated_at |
| ActionCard | updated_at |
| AgentProposal | updated_at |
| Invitation | updated_at |
| ProjectResource | updated_at |

### 15. 状态迁移无约束

task_service、risk_service、action_card_service 允许任意状态转换（如 done → not_started）  
**修复方向**: 定义合法状态迁移矩阵，在 service 层校验

### 16. workspace_state_service N+1 查询

`workspace_state_service.py:29-51` 对每个 membership 单独查询 User 和 MemberProfile  
**修复方向**: 用 JOIN 查询替代

### 17. System Prompt 缺少输出 Schema 描述

`prompts.py:5-25` 告诉 LLM "Return exactly one JSON object matching the requested schema"，但从未告诉 schema 具体是什么  
**后果**: 首次输出正确率低，增加重试次数和延迟  
**修复方向**: 在 prompt 中加入期望的 JSON 结构示例

### 18. 缺少 API 版本化

所有路由挂 `/api` 前缀，无版本号  
**修复方向**: 改为 `/api/v1`

### 19. 缺少 error.tsx 和 loading.tsx

全部路由段无 Next.js App Router 的 error boundary 和 loading 文件  
**修复方向**: 至少为关键路由段添加

### 20. 组件体积过大

| 组件 | 行数 |
|------|------|
| member-profile-wizard.tsx | 632 |
| project-dashboard.tsx | 445 |
| project-intake-form.tsx | 441 |

**修复方向**: 拆分为独立子组件/Step 组件

### 21. 全系统缺 aria 无障碍属性

所有交互组件几乎都没有 aria-label、aria-pressed、aria-expanded 等

---

## 修复优先级建议

| 批次 | 内容 | 预估工作量 |
|------|------|-----------|
| 第一批 | #1 零认证预留接口 + #11 Error Boundary | 1-2 天 |
| 第二批 | #2 React 版本升级 | 1 天 |
| 第三批 | #3 枚举类型 + #4 唯一约束 + #5 索引 | 2-3 天（需数据库迁移） |
| 第四批 | #6 Schema 约束 + #7 from_attributes + #8 路由层重构 | 2-3 天 |
| 第五批 | #9 前端逻辑抽取 + #10 中文化 + #20 组件拆分 | 2-3 天 |
| 第六批 | #12-#21 其余 P2 项 | 3-5 天 |
