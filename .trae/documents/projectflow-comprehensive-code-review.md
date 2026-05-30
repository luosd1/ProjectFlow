# ProjectFlow 全面代码审查报告与修复计划

> 审查日期：2026-05-30 | 审查深度：Deep | 审查范围：全量代码（后端 80+ 文件，前端 30+ 文件）

***

## 总览

| 维度    | 评价                         |
| ----- | -------------------------- |
| 架构合规性 | ⚠️ 多处违反 AGENTS.md 规范       |
| 安全性   | 🔴 零认证、IDOR、API Key 泄露风险   |
| 数据一致性 | 🔴 事务缺失、双重序列化、类型不匹配        |
| 代码质量  | ⚠️ 大量重复代码、缺失校验、命名不一致       |
| 测试覆盖  | 🔴 Service 层零单元测试、负面路径严重不足 |
| 前端健壮性 | ⚠️ 类型不安全、缺失状态处理、版本冲突       |

***

## P0 — 必须立即修复（影响数据正确性或安全性）

### 1. 零认证/零授权 — 全部 API 裸奔

**位置**: 全部 22 个路由文件\
**现状**: 没有任何认证中间件、JWT、Session 或 API Key 校验。任何人可调用 `POST /api/seed/reset` 清空数据库，可调用 `POST /api/llm/diagnostic` 消耗 LLM 额度，可读写任何 workspace/project 数据。\
**修复**: 至少添加 `Depends(get_current_user)` 预留接口；Seed/Reset/Demo 端点加 admin 权限校验；LLM diagnostic 端点移除请求体传 API Key 能力。

### 2. 事务缺失 — 多步操作无原子性

**位置**:

* `workspace_service.create_workspace` — 两次独立 commit

* `invitation_service.accept_invitation` — 两次独立 commit

* `agent_flow_service._persist_agent_output` — 子调用各自 commit

* `assignment_service.finalize_assignment_proposals_by_stage` — 循环每次独立 commit

**后果**: 中间步骤失败时数据不一致（如 workspace 存在但无 owner）\
**修复**: 所有跨表多步操作改为单一事务，只在最后 commit 一次

### 3. 双重 JSON 序列化 Bug

**位置**:

* `member_profile_service.create_profile` — skills 被序列化两次

* `risk_service.create_risk` — evidence 被序列化两次

* `project_service.update_project` — direction\_card 冗余双重检查

**后果**: 存储 `"\"skill\""` 这种双重转义数据\
**修复**: 统一在 setattr 循环中做一次序列化，删除重复逻辑

### 4. Agent 直接 commit DB — 架构违规

**位置**: `workflow.py:120-144` `_log_agent_event` 直接 `session.add(event)` + `session.commit()`\
**后果**: 与调用方事务不一致，调用方回滚时 AgentEvent 已 commit 无法回滚\
**修复**: Agent 只返回事件数据，由 service 层负责持久化

### 5. Fallback payload 含 None 导致 fallback 也崩溃

**位置**: `common.py` 的 `first_member_id()`/`first_task_id()`/`first_stage_id()` 在数据为空时返回 None，但多个模块的 fallback payload 直接使用这些值\
**后果**: 空 workspace 下 Agent 完全不可用\
**修复**: fallback 构建时检查 None，使用安全的占位值

### 6. LLM 网络错误未捕获

**位置**: `workflow.py:50-74` 重试循环只捕获 `(AgentOutputValidationError, ValueError, json.JSONDecodeError)`\
**后果**: 网络超时、API Key 失效等异常直接穿透，不触发 fallback\
**修复**: 捕获 `LLMError` 基类，走 fallback 路径

### 7. React 18 + Next.js 16 版本冲突

**位置**: `frontend/package.json`\
**后果**: Server Components 行为异常、类型定义不匹配、运行时可能崩溃\
**修复**: 升级 React 到 19.x

### 8. 前后端类型不一致 — 运行时崩溃风险

**位置**: `frontend/src/lib/types.ts` vs `backend/app/schemas/`\
**关键不一致**:

* `MemberProfile.skills`: 前端 `Skill[]`，后端 `list | dict`

* `Task.dependency_ids`: 前端 `string[]`，后端 `dict | list`

* `Task.acceptance_criteria`: 前端 `string[]`，后端 `dict | list`

* `Stage.done_criteria`: 前端 `string[]`，后端 `dict | list`

* `available_hours_per_week`: Model `int`，Schema `float`（数据截断）

**后果**: 后端返回 dict 时前端 `.map()` 直接抛运行时异常\
**修复**: 后端 schema 统一为 `list[str]` 或具体类型；前端加 normalize 防护

### 9. `request<T>` 函数无超时、无 JSON 解析保护

**位置**: `frontend/src/lib/api.ts:83-95`\
**后果**: 网络卡住时请求永远 pending；后端返回非 JSON 时未捕获异常\
**修复**: 添加 AbortController 超时；`response.json()` 加 try-catch

### 10. `get_session` 缺显式 rollback

**位置**: `backend/app/core/database.py:23-25`\
**后果**: 业务代码 commit 失败时依赖隐式 rollback，不可靠\
**修复**: 添加 try/except + session.rollback()

***

## P1 — 本周修复（影响功能正确性或可维护性）

### 11. 枚举已定义但模型未使用

**位置**: 18 个模型字段用裸 `str` 而非对应 Enum\
**后果**: 数据库可存任意字符串，无约束\
**修复**: 模型字段改为 Enum 类型

### 12. 缺失唯一约束

**位置**:

* `workspace_memberships`: 缺 `(workspace_id, user_id)` UNIQUE

* `member_profiles`: 缺 `(user_id, workspace_id)` UNIQUE

* `invitations`: 缺 `token` UNIQUE

* `users`: 缺 `email` 唯一性

**修复**: 添加 `__table_args__` 约束

### 13. 缺失外键索引

**位置**: 全部外键字段无索引\
**修复**: 为高频查询字段添加 Index

### 14. Schema 零字段约束

**位置**: 全部 Create/Update schema 无 `Field(min_length=..., ge=...)`\
**后果**: 空字符串、负数、非法值可入库\
**修复**: 关键字段加约束（name/reason min\_length=1, hours ge=0, cadence\_days ge=1）

### 15. Read schema 缺 `from_attributes=True`

**位置**: 全部 20+ Read schema\
**后果**: 手写 converter 维护成本高，json.loads 无异常处理\
**修复**: 添加 ConfigDict，逐步替换手写 converter

### 16. 业务逻辑泄漏到路由层

**位置**:

* `routes_export.py` — 200 行业务逻辑在路由中

* 6 个路由文件的 `_to_read` JSON 反序列化

**修复**: 抽取到 service 层

### 17. 业务逻辑泄漏到前端页面

**位置**:

* `projects/[projectId]/page.tsx` — 230 行业务逻辑

* `projectflow-home.tsx` — demo seed 加载逻辑

**修复**: 抽取到 `useProjectDashboard` hook 和 service 函数

### 18. Prompt 注入风险

**位置**: `prompts.py:39-42` 将完整 workspace\_state JSON 直接拼入 user prompt\
**修复**: 用 XML 标签包裹与指令部分做结构隔离

### 19. 10+ 组件英文文案未中文化

**位置**: stage-plan-board、task-breakdown-board、risk-card、action-card、timeline 等约 10 个组件、100+ 处英文文案\
**违反**: AGENTS.md "UI 语言统一中文"\
**修复**: 抽取到 constants.ts 或 i18n 映射，统一为中文

### 20. ReplanDiff 传入相同 before/after — 功能性 Bug

**位置**: `project-dashboard.tsx:434` `<ReplanDiff before={tasks} after={tasks} />`\
**后果**: 永远显示 "No changes to display."\
**修复**: 从 AgentProposal/AgentEvent 中提取 replan 前后快照

### 21. 前端参数被 void 丢弃

**位置**:

* `api.ts:189` — `acceptInvitation` 的 `userId` 被 void

* `api.ts:468` — `finalizeAssignments` 的 `finalizedBy` 被 void

**后果**: 调用方以为参数生效，实际被静默忽略\
**修复**: 将参数传给后端或移除参数

### 22. invitation\_service placeholder user\_id

**位置**: `invitation_service.py:47-49` 用 `invitation.id` 作为 `user_id`\
**后果**: 创建的 membership 永远无法正常工作\
**修复**: accept 时同步创建 User 或要求邀请时先创建 User

### 23. Seed/Reset 端点无保护

**位置**: `routes_seed.py:36`、`routes_demo.py:12`\
**修复**: 添加 admin 权限校验或环境限制

### 24. AppShell 无 Error Boundary

**位置**: `app-shell.tsx:200-206`\
**后果**: 子组件运行时错误导致整页白屏\
**修复**: 添加 React Error Boundary

### 25. 导航栏「新建项目」不带 workspaceId

**位置**: `app-shell.tsx:39`\
**后果**: 从导航栏进入的表单无 workspaceId\
**修复**: 当 workspaceId 存在时附加参数

***

## P2 — 后续修复（代码质量和工程规范）

### 26. 日期字段全部用 `str` 而非 `datetime`

**位置**: Project.deadline、Stage.start\_date/end\_date、Task.due\_date 等 7 个字段\
**修复**: 改为 `datetime` 类型

### 27. 空字符串 vs None 不一致

**位置**: Task.due\_date、MemberProfile.role\_preference/interests/constraints 等 5 个字段默认空字符串\
**修复**: 改为 `None`

### 28. 缺失 `updated_at` 字段

**位置**: Stage、Task(缺created\_at)、AssignmentProposal、Risk、ActionCard、AgentProposal、Invitation 等 8 个模型\
**修复**: 补充时间戳字段

### 29. `_require` 函数在 6 个文件中重复定义

**修复**: 提取到 `app/core/db_utils.py`

### 30. 状态迁移无约束

**位置**: task\_service、risk\_service、action\_card\_service\
**修复**: 定义合法状态迁移矩阵，在 service 层校验

### 31. workspace\_state\_service N+1 查询

**位置**: `workspace_state_service.py:29-51`\
**修复**: 用 JOIN 查询替代

### 32. JSON 修复逻辑脆弱

**位置**: `workflow.py:106-117` `_repair_json_text`\
**问题**: `text.replace("'", '"')` 会破坏合法单引号内容\
**修复**: 使用更智能的 JSON 修复策略

### 33. System Prompt 缺少输出 Schema 描述

**位置**: `prompts.py:5-25`\
**修复**: 在 prompt 中加入期望的 JSON 结构示例

### 34. 缺少全局异常处理

**位置**: `main.py`\
**修复**: 注册 `@app.exception_handler` 统一错误响应格式

### 35. 缺少 API 版本化

**位置**: 所有路由挂 `/api` 前缀\
**修复**: 改为 `/api/v1`

### 36. 缺少 error.tsx 和 loading.tsx

**位置**: 全部路由段\
**修复**: 至少为 `app/`、`app/projects/[projectId]/`、`app/workspaces/[workspaceId]/` 添加

### 37. 组件体积过大

**位置**: member-profile-wizard.tsx (632行)、project-dashboard.tsx (445行)、project-intake-form.tsx (441行)\
**修复**: 拆分为独立子组件/Step 组件

### 38. 全系统缺 aria 无障碍属性

**位置**: 所有交互组件\
**修复**: 为关键交互元素添加 aria-label、aria-pressed、aria-expanded 等

### 39. CORS 配置过于宽松

**位置**: `main.py:46-48`\
**修复**: 显式列出 methods 和 headers

### 40. llm\_api\_key 未用 SecretStr

**位置**: `config.py:8`\
**修复**: 改为 `SecretStr` 类型

***

## P3 — 后续优化（不影响功能）

1. `schemas/__init__.py` 为空 — 与 models 不一致
2. 枚举命名风格不一致（P0/P1/P2 大写 vs 其他小写）
3. `MoodOrConfidence` 命名模糊 — 应拆分
4. 缺少 `WorkflowState` 枚举 — 状态机无类型约束
5. 路由注册无自动发现t
6. 缺少数据库迁移方案（Alembic）
7. config 模块级单例 — 测试不便
8. MockLLMClient 默认返回无效 JSON
9. response\_format 硬编码 OpenAI 专有参数
10. Demo 和 Seed 路由功能重复
11. `shadcn` 在 dependencies 中（应为 devDependency）
12. 双组件库并存（@base-ui-react + Radix UI）
13. Tailwind 颜色体系不一致
14. tsconfig target 过低（ES2017）
15. 成功提示不自动消失
16. 常量散落在各组件中

***

## 测试覆盖缺口总结

| 缺失维度                            | 详情                         |
| ------------------------------- | -------------------------- |
| Service 层单元测试                   | 14 个 service 文件零独立测试       |
| 状态机前置条件                         | 无测试验证非法状态转换拒绝              |
| 负面路径                            | 几乎没有输入校验、业务规则违反测试          |
| Assignment reject + negotiation | 只测了 accept，未测 reject 后完整流程 |
| DELETE 端点                       | 大多数路由只测了 create/read       |
| 并发/竞态                           | 无测试                        |
| 空 workspace state               | 无测试                        |
| 前端组件测试                          | 仅有 2 个 .test.tsx 文件        |

### 测试隔离问题

* 5 个不同的 session/client fixture 散布在各文件中，配置不一致

* `test_api_smoke.py` 使用真实数据库

* `test_issue4_smoke.py` 模块级修改全局 app

* `test_demo_export_flow.py` 不清理 dependency overrides

* 5 个相似的 fixture 创建函数重复定义

***

## 修复优先级路线图

### 第一批：数据正确性（1-2 天）

1. 修复双重 JSON 序列化 Bug (#3)
2. 修复事务缺失 (#2)
3. 修复 get\_session 缺显式 rollback (#10)
4. 修复 Agent 直接 commit DB (#4)
5. 修复 Fallback payload 含 None (#5)
6. 修复 LLM 网络错误未捕获 (#6)
7. 修复 available\_hours\_per\_week int/float 不一致 (#8 子项)
8. 修复 ReplanDiff 传入相同 before/after (#20)
9. 修复前端参数被 void 丢弃 (#21)

### 第二批：类型安全与约束（2-3 天）

1. 模型枚举字段改为 Enum 类型 (#11)
2. 添加唯一约束 (#12)
3. 添加外键索引 (#13)
4. Schema 加字段约束 (#14)
5. Read schema 加 from\_attributes=True (#15)
6. 前后端类型对齐 — 后端 schema 统一具体类型 (#8)
7. 日期字段改为 datetime (#26)
8. 空字符串默认值改为 None (#27)

### 第三批：安全与架构合规（2-3 天）

1. 添加认证预留接口 (#1)
2. Seed/Reset 端点加保护 (#23)
3. LLM diagnostic 移除请求体传 API Key (#1 子项)
4. 业务逻辑从路由层抽取到 service (#16)
5. 业务逻辑从页面抽取到 hook/service (#17)
6. Prompt 注入防护 (#18)
7. 添加全局异常处理 (#34)
8. CORS 收紧 (#39)
9. llm\_api\_key 改 SecretStr (#40)

### 第四批：前端健壮性（2-3 天）

1. 修复 React 版本冲突 (#7)
2. request<T> 添加超时和 JSON 解析保护 (#9)
3. 添加 Error Boundary (#24)
4. 修复导航栏链接 (#25)
5. 英文文案中文化 (#19)
6. 添加 error.tsx / loading.tsx (#36)
7. 组件拆分 (#37)

### 第五批：测试与工程规范（3-5 天）

1. 统一测试 fixture 到 conftest.py
2. 补充 Service 层单元测试
3. 补充状态机前置条件测试
4. 补充负面路径测试
5. 补充 Assignment reject + negotiation 流程测试
6. 补充缺失的 updated\_at 字段 (#28)
7. 状态迁移约束 (#30)
8. N+1 查询优化 (#31)

***

## 审查签名

```
files changed:    N/A (全量审查，非 diff 审查)
scope:            on target — 审查范围与项目代码完全一致
review depth:     deep
hard stops:       10 found, 0 fixed, 10 deferred
specialists:      security, architecture, agent-safety
new tests:        0
verification:     pending — 需运行 pytest + npm run build 确认当前基线状态
```

