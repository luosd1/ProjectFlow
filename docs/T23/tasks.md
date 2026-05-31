先了解一下当前项目的实际功能模块和状态机细节，确保分工方案基于真实代码而非假设。
        
            
toolName: no_need_execute
            
status: no_need_execute
          
          

        
            
toolName: view_folder
            
status: success
          
d:\Flowors\ProjectFlow\backend\app\agent
          

        
            
toolName: view_folder
            
status: success
          
d:\Flowors\ProjectFlow\backend\app\api
          

        
            
toolName: view_folder
            
status: success
          
d:\Flowors\ProjectFlow\backend\app\services
          

        
            
toolName: view_folder
            
status: success
          
d:\Flowors\ProjectFlow\frontend\src\app
          

        
            
toolName: view_folder
            
status: success
          
d:\Flowors\ProjectFlow\frontend\src\components
          

        
            
toolName: view_folder
            
status: success
          
d:\Flowors\ProjectFlow\backend\app\seed
          

        
            
toolName: view_folder
            
status: success
          
d:\Flowors\ProjectFlow\backend\app\models
          

        
            
toolName: view_folder
            
status: success
          
d:\Flowors\ProjectFlow\backend\app\schemas
          
现在深入读取关键文件，并行获取状态机、Agent 模块、API 路由、种子数据等核心信息：
        
            
toolName: view_files
            
status: success
          
            
filePath: d:\Flowors\ProjectFlow\backend\app\agent\workflow.py
          

        
            
toolName: view_files
            
status: success
          
            
filePath: d:\Flowors\ProjectFlow\backend\app\agent\coordinator.py
          

        
            
toolName: view_files
            
status: success
          
            
filePath: d:\Flowors\ProjectFlow\backend\app\agent\output_schemas.py
          

        
            
toolName: view_files
            
status: success
          
            
filePath: d:\Flowors\ProjectFlow\backend\app\agent\prompts.py
          

        
            
toolName: view_files
            
status: success
          
            
filePath: d:\Flowors\ProjectFlow\backend\app\agent\llm_client.py
          

        
            
toolName: view_files
            
status: success
          
            
filePath: d:\Flowors\ProjectFlow\backend\app\models\enums.py
          

        
            
toolName: view_files
            
status: success
          
            
filePath: d:\Flowors\ProjectFlow\backend\app\seed\demo_seed.py
          

        
            
toolName: view_files
            
status: success
          
            
filePath: d:\Flowors\ProjectFlow\backend\app\main.py
          
现在读取所有 Agent 模块、API 路由文件和关键前端页面：
        
            
toolName: view_files
            
status: success
          
            
filePath: d:\Flowors\ProjectFlow\backend\app\agent\modules\clarification.py
          

        
            
toolName: view_files
            
status: success
          
            
filePath: d:\Flowors\ProjectFlow\backend\app\agent\modules\planning.py
          

        
            
toolName: view_files
            
status: success
          
            
filePath: d:\Flowors\ProjectFlow\backend\app\agent\modules\breakdown.py
          

        
            
toolName: view_files
            
status: success
          
            
filePath: d:\Flowors\ProjectFlow\backend\app\agent\modules\assignment_recommendation.py
          

        
            
toolName: view_files
            
status: success
          
            
filePath: d:\Flowors\ProjectFlow\backend\app\agent\modules\assignment_negotiation.py
          

        
            
toolName: view_files
            
status: success
          
            
filePath: d:\Flowors\ProjectFlow\backend\app\agent\modules\active_push.py
          

        
            
toolName: view_files
            
status: success
          
            
filePath: d:\Flowors\ProjectFlow\backend\app\agent\modules\checkin_analysis.py
          

        
            
toolName: view_files
            
status: success
          
            
filePath: d:\Flowors\ProjectFlow\backend\app\agent\modules\risk_analysis.py
          

        
            
toolName: view_files
            
status: success
          
            
filePath: d:\Flowors\ProjectFlow\backend\app\agent\modules\replanning.py
          

        
            
toolName: view_files
            
status: success
          
            
filePath: d:\Flowors\ProjectFlow\backend\app\agent\modules\common.py
          
现在读取所有 API 路由文件以获取完整端点列表：
        
            
toolName: search_by_regex
            
status: success
          
query: @router\.(get|post|put|patch|delete)\(
          

        
            
toolName: view_files
            
status: success
          
            
filePath: d:\Flowors\ProjectFlow\backend\app\services\agent_flow_service.py
          

        
            
toolName: view_files
            
status: success
          
            
filePath: d:\Flowors\ProjectFlow\frontend\src\app\page.tsx
          

        
            
toolName: view_files
            
status: success
          
            
filePath: d:\Flowors\ProjectFlow\frontend\src\app\layout.tsx
          
现在读取前端关键页面和组件以完善理解：
        
            
toolName: view_files
            
status: success
          
            
filePath: d:\Flowors\ProjectFlow\frontend\src\app\onboarding\page.tsx
          

        
            
toolName: view_files
            
status: success
          
            
filePath: d:\Flowors\ProjectFlow\frontend\src\app\projects\[projectId]\page.tsx
          

        
            
toolName: view_files
            
status: success
          
            
filePath: d:\Flowors\ProjectFlow\frontend\src\app\workspaces\[workspaceId]\page.tsx
          

        
            
toolName: view_files
            
status: success
          
            
filePath: d:\Flowors\ProjectFlow\frontend\src\components\project\project-dashboard.tsx
          

        
            
toolName: view_files
            
status: success
          
            
filePath: d:\Flowors\ProjectFlow\frontend\src\components\app-shell.tsx
          

        
            
toolName: view_files
            
status: success
          
            
filePath: d:\Flowors\ProjectFlow\frontend\src\components\projectflow-home.tsx
          
最后补充读取几个关键文件：
        
            
toolName: view_files
            
status: success
          
            
filePath: d:\Flowors\ProjectFlow\backend\app\seed\demo_projectflow.py
          

        
            
toolName: view_files
            
status: success
          
            
filePath: d:\Flowors\ProjectFlow\backend\app\seed\demo_blocker_scenario.py
          

        
            
toolName: view_files
            
status: success
          
            
filePath: d:\Flowors\ProjectFlow\backend\app\seed\reset.py
          

        
            
toolName: view_files
            
status: success
          
            
filePath: d:\Flowors\ProjectFlow\frontend\src\app\onboarding\profile\page.tsx
          

        
            
toolName: view_files
            
status: success
          
            
filePath: d:\Flowors\ProjectFlow\frontend\src\app\projects\new\page.tsx
          

        
            
toolName: view_files
            
status: success
          
            
filePath: d:\Flowors\ProjectFlow\frontend\src\app\workspaces\new\page.tsx
          
现在我已经完整阅读了所有关键文件，以下是结构化总结。

---

# ProjectFlow 代码库全景扫描

## 一、完整状态机与状态转换

### 状态机主流程

```
AccountSetup → WorkspaceSetup → MemberProfiles → ProjectIntake
  → Clarification → StagePlanning → TaskBreakdown
  → AssignmentRecommendation → AssignmentConfirmation
  → ActivePush → Execution → CheckIn → RiskAnalysis → Replanning → ActivePush (循环)
```

分支路径：`AssignmentConfirmation` 可进入 `AssignmentNegotiation`（成员拒绝后协调交换），再回到 `AssignmentConfirmation`。阶段完成后进入下一阶段，重新触发分工推荐。

### 所有枚举状态

来源：[enums.py](d:\Flowors\ProjectFlow\backend\app\models\enums.py)

| 枚举类型 | 值 |
|---|---|
| **WorkspaceRole** | `owner`, `member` |
| **InvitationStatus** | `pending`, `accepted`, `expired` |
| **ProjectStatus** | `draft`, `active`, `at_risk`, `completed` |
| **StageStatus** | `pending`, `active`, `completed`, `at_risk` |
| **TaskPriority** | `P0`, `P1`, `P2` |
| **TaskStatus** | `not_started`, `in_progress`, `done`, `blocked` |
| **AssignmentProposalStatus** | `proposed`, `owner_confirmed`, `owner_rejected`, `negotiating`, `finalized` |
| **AssignmentResponseType** | `accept`, `reject` |
| **NegotiationStatus** | `pending`, `accepted`, `declined`, `resolved` |
| **CheckInCycleStatus** | `active`, `paused`, `completed` |
| **MoodOrConfidence** | `low`, `medium`, `high` |
| **RiskType** | `deadline`, `dependency`, `workload`, `scope`, `review`, `assignment`, `checkin` |
| **RiskSeverity** | `low`, `medium`, `high` |
| **RiskStatus** | `open`, `accepted`, `ignored`, `resolved` |
| **ActionCardType** | `personal_task`, `team_next_step`, `reminder`, `risk_action`, `kickoff_tip`, `checkin_prompt`, `assignment_request` |
| **ActionCardStatus** | `active`, `done`, `dismissed` |
| **AgentEventType** | `clarify`, `plan`, `breakdown`, `assign`, `negotiate`, `push`, `checkin`, `risk`, `replan`, `export` |
| **AgentEventStatus** | `success`, `repaired`, `fallback`, `failed` |
| **AgentProposalStatus** | `pending`, `confirmed`, `rejected` |
| **ResourceType** | `text_note`, `file_stub`, `link` |

### 前端仪表盘阶段推断逻辑

来源：[project-dashboard.tsx](d:\Flowors\ProjectFlow\frontend\src\components\project\project-dashboard.tsx)

前端将 Agent 操作归为 4 个阶段组：

| 阶段 | 包含操作 | 推断条件 |
|---|---|---|
| **规划** (planning) | clarify, plan, breakdown | 无 direction_card / 无 stages / 无 tasks |
| **分工** (assignment) | assign | 有 tasks 但无 finalized assignments |
| **执行** (execution) | push, analyze-checkins | 有 finalized assignments |
| **监控** (monitoring) | risk-analysis, replan | 同执行阶段并行 |

推荐下一步推断：无方向卡→clarify → 无阶段→plan → 无任务→breakdown → 无分工→assign → 默认→push

---

## 二、所有 Agent 模块

来源：[backend/app/agent/modules/](d:\Flowors\ProjectFlow\backend\app\agent\modules)

### 架构总览

- **CoordinatorAgent** ([coordinator.py](d:\Flowors\ProjectFlow\backend\app\agent\coordinator.py))：统一入口，9 个方法分别对应 9 个模块
- **generate_structured_output** ([workflow.py](d:\Flowors\ProjectFlow\backend\app\agent\workflow.py))：核心编排，2 次重试 + JSON 修复 + fallback + 事件日志
- **LLMClient** ([llm_client.py](d:\Flowors\ProjectFlow\backend\app\agent\llm_client.py))：支持 mock / openai / openai-compatible 三种 provider
- **Prompts** ([prompts.py](d:\Flowors\ProjectFlow\backend\app\agent\prompts.py))：集中式 OUTPUT_CONTRACT + 紧凑 WorkspaceState 序列化
- **Output Schemas** ([output_schemas.py](d:\Flowors\ProjectFlow\backend\app\agent\output_schemas.py))：9 种 Pydantic 输出模型 + 引用校验

### 9 个模块详情

| 模块 | 文件 | AgentEventType | 功能 | 输出 Schema | 是否需确认 |
|---|---|---|---|---|---|
| **Clarification** | [clarification.py](d:\Flowors\ProjectFlow\backend\app\agent\modules\clarification.py) | `clarify` | 从项目想法生成方向卡（problem/users/value/deliverables/boundaries/risks/questions） | `DirectionCardOutput` | 是 |
| **Planning** | [planning.py](d:\Flowors\ProjectFlow\backend\app\agent\modules\planning.py) | `plan` | 生成 3 阶段计划（name/goal/dates/deliverable/done_criteria） | `StagePlanOutput` | 是 |
| **Breakdown** | [breakdown.py](d:\Flowors\ProjectFlow\backend\app\agent\modules\breakdown.py) | `breakdown` | 将当前阶段拆解为 3 个优先级任务 | `TaskBreakdownOutput` | 是 |
| **Assignment Recommendation** | [assignment_recommendation.py](d:\Flowors\ProjectFlow\backend\app\agent\modules\assignment_recommendation.py) | `assign` | 根据技能/时间/意向/限制推荐任务负责人 | `AssignmentRecommendationOutput` | 是 |
| **Assignment Negotiation** | [assignment_negotiation.py](d:\Flowors\ProjectFlow\backend\app\agent\modules\assignment_negotiation.py) | `negotiate` | 成员拒绝后提供协商选项 | `AssignmentNegotiationOutput` | 是 |
| **Active Push** | [active_push.py](d:\Flowors\ProjectFlow\backend\app\agent\modules\active_push.py) | `push` | 生成 1 张最高优先级行动卡 | `ActivePushOutput` | 否 |
| **Check-in Analysis** | [checkin_analysis.py](d:\Flowors\ProjectFlow\backend\app\agent\modules\checkin_analysis.py) | `checkin` | 分析签到进度、更新任务状态、识别风险 | `CheckInAnalysisOutput` | 否 |
| **Risk Analysis** | [risk_analysis.py](d:\Flowors\ProjectFlow\backend\app\agent\modules\risk_analysis.py) | `risk` | 返回 1 个最高风险项（含 evidence） | `RiskAnalysisOutput` | 高风险时是 |
| **Replanning** | [replanning.py](d:\Flowors\ProjectFlow\backend\app\agent\modules\replanning.py) | `replan` | 最小化计划调整（before/after/impact + 最多 1 阶段调整 + 1 任务变更 + 1 行动卡） | `ReplanOutput` | 是 |

### Agent 运行流程

1. 模块 `build_request()` 构造 `AgentModuleRequest`（event_type + user_prompt + fallback_payload）
2. `generate_structured_output()` 调用 LLM，最多 2 次重试
3. 首次失败时尝试 JSON 修复（去 markdown 代码块、截取花括号内容、去尾逗号、替换单引号）
4. 修复仍失败则使用 fallback_payload
5. 所有输出过 Pydantic 校验 + 引用完整性校验（task_id/stage_id/user_id 必须存在于 WorkspaceState）
6. 结果记录到 `AgentEvent` 表
7. `agent_flow_service._persist_agent_output()` 根据输出类型自动持久化：方向卡/阶段计划/任务拆解存为 AgentProposal，分工存为 AssignmentProposal，行动卡存为 ActionCard，风险存为 Risk，状态更新存为 TaskStatusUpdate

---

## 三、所有 API 端点

来源：[backend/app/api/](d:\Flowors\ProjectFlow\backend\app\api)，前缀统一为 `/api`

### 健康与诊断

| 方法 | 路径 | 功能 |
|---|---|---|
| GET | `/health` | 健康检查 |
| GET | `/llm/diagnostic` | LLM 连接诊断 |
| POST | `/llm/diagnostic` | LLM 连接诊断（带参数） |

### 用户与工作区

| 方法 | 路径 | 功能 |
|---|---|---|
| POST | `/users` | 创建用户 |
| GET | `/users` | 列出所有用户 |
| GET | `/users/{user_id}` | 获取用户 |
| POST | `/workspaces` | 创建工作区 |
| GET | `/workspaces` | 列出工作区 |
| GET | `/workspaces/{workspace_id}` | 获取工作区 |
| POST | `/workspaces/{workspace_id}/invite` | 邀请成员 |
| POST | `/invitations` | 创建邀请 |
| POST | `/invitations/accept` | 接受邀请 |

### 成员档案

| 方法 | 路径 | 功能 |
|---|---|---|
| POST | `/member-profiles` | 创建成员档案 |
| GET | `/member-profiles/{profile_id}` | 获取档案 |
| PATCH | `/member-profiles/{profile_id}` | 更新档案 |
| GET | `/workspaces/{workspace_id}/profiles` | 列出工作区档案 |

### 项目与资源

| 方法 | 路径 | 功能 |
|---|---|---|
| POST | `/projects` | 创建项目 |
| GET | `/projects/{project_id}` | 获取项目 |
| GET | `/workspaces/{workspace_id}/projects` | 列出工作区项目 |
| PATCH | `/projects/{project_id}` | 更新项目 |
| POST | `/resources` | 创建资源 |
| GET | `/projects/{project_id}/resources` | 列出项目资源 |

### 阶段与任务

| 方法 | 路径 | 功能 |
|---|---|---|
| POST | `/stages` | 创建阶段 |
| GET | `/stages/{stage_id}` | 获取阶段 |
| GET | `/projects/{project_id}/stages` | 列出项目阶段 |
| PATCH | `/stages/{stage_id}` | 更新阶段 |
| POST | `/tasks` | 创建任务 |
| GET | `/tasks/{task_id}` | 获取任务 |
| GET | `/stages/{stage_id}/tasks` | 列出阶段任务 |
| GET | `/projects/{project_id}/tasks` | 列出项目任务 |
| PATCH | `/tasks/{task_id}` | 更新任务 |
| POST | `/tasks/{task_id}/status-updates` | 创建任务状态更新 |

### 分工

| 方法 | 路径 | 功能 |
|---|---|---|
| POST | `/assignment-proposals` | 创建分工提案 |
| GET | `/assignment-proposals/{proposal_id}` | 获取提案 |
| GET | `/projects/{project_id}/assignment-proposals` | 列出项目分工提案 |
| GET | `/projects/{project_id}/assignment-responses` | 列出分工响应 |
| GET | `/projects/{project_id}/assignment-negotiations` | 列出协商 |
| POST | `/assignment-proposals/{proposal_id}/respond` | 响应分工（accept/reject） |
| POST | `/assignment-proposals/{proposal_id}/finalize` | 确认分工 |
| POST | `/stages/{stage_id}/assignments/finalize` | 批量确认阶段分工 |
| POST | `/assignment-proposals/{proposal_id}/negotiate` | 发起协商 |

### 签到

| 方法 | 路径 | 功能 |
|---|---|---|
| POST | `/checkin-cycles` | 创建签到周期 |
| GET | `/projects/{project_id}/checkin-cycles` | 列出签到周期 |
| POST | `/checkin-cycles/{cycle_id}/responses` | 提交签到响应 |
| GET | `/checkin-cycles/{cycle_id}/responses` | 列出签到响应 |

### 风险与行动卡

| 方法 | 路径 | 功能 |
|---|---|---|
| POST | `/risks` | 创建风险 |
| GET | `/projects/{project_id}/risks` | 列出项目风险 |
| PATCH | `/risks/{risk_id}` | 更新风险状态 |
| POST | `/action-cards` | 创建行动卡 |
| GET | `/projects/{project_id}/action-cards` | 列出行动卡 |
| PATCH | `/action-cards/{card_id}` | 更新行动卡状态 |

### Agent 操作

| 方法 | 路径 | 功能 |
|---|---|---|
| POST | `/agent/clarify` | 运行方向澄清 |
| POST | `/agent/plan` | 运行阶段计划 |
| POST | `/agent/breakdown` | 运行任务拆解 |
| POST | `/agent/assign` | 运行分工推荐 |
| POST | `/agent/active-push` | 运行主动推进 |
| POST | `/agent/check-in-analysis` | 运行签到分析 |
| POST | `/agent/risk-analysis` | 运行风险分析 |
| POST | `/agent/replan` | 运行计划调整 |

### Agent 提案

| 方法 | 路径 | 功能 |
|---|---|---|
| GET | `/agent-proposals` | 列出提案 |
| GET | `/agent-proposals/{proposal_id}` | 获取提案 |
| POST | `/agent-proposals/{proposal_id}/confirm` | 确认提案 |
| POST | `/agent-proposals/{proposal_id}/reject` | 拒绝提案 |

### 工作区状态与时间线

| 方法 | 路径 | 功能 |
|---|---|---|
| GET | `/workspaces/{workspace_id}/state` | 获取完整工作区状态 |
| GET | `/projects/{project_id}/timeline` | 获取 Agent 事件时间线 |

### 重计划与导出

| 方法 | 路径 | 功能 |
|---|---|---|
| POST | `/replans/confirm` | 确认重计划 |
| POST | `/projects/{project_id}/export/review-summary` | 导出评审摘要 |

### 演示与种子数据

| 方法 | 路径 | 功能 |
|---|---|---|
| POST | `/demo/reset` | 重置演示数据 |
| POST | `/seed/demo` | 加载种子数据 |
| POST | `/seed/reset` | 清空所有数据 |

**共计 70 个 API 端点**。

---

## 四、所有前端页面/路由

来源：[frontend/src/app/](d:\Flowors\ProjectFlow\frontend\src\app)

| 路由 | 文件 | 功能 |
|---|---|---|
| `/` | [page.tsx](d:\Flowors\ProjectFlow\frontend\src\app\page.tsx) | 首页，智能重定向：有 workspace 记录→跳转工作台，否则展示欢迎页（含"开始使用"和"加载演示数据"按钮） |
| `/onboarding` | [onboarding/page.tsx](d:\Flowors\ProjectFlow\frontend\src\app\onboarding\page.tsx) | 账号设置页，创建或选择演示身份 |
| `/onboarding/profile` | [onboarding/profile/page.tsx](d:\Flowors\ProjectFlow\frontend\src\app\onboarding\profile\page.tsx) | 成员资料填写向导（技能/时间/意向/限制） |
| `/workspaces/new` | [workspaces/new/page.tsx](d:\Flowors\ProjectFlow\frontend\src\app\workspaces\new\page.tsx) | 新建工作区 + 邀请成员 |
| `/workspaces/[workspaceId]` | [workspaces/[workspaceId]/page.tsx](d:\Flowors\ProjectFlow\frontend\src\app\workspaces\[workspaceId]\page.tsx) | 工作台仪表盘：展示成员列表 + 项目列表 + 状态标签 |
| `/projects/new` | [projects/new/page.tsx](d:\Flowors\ProjectFlow\frontend\src\app\projects\new\page.tsx) | 新建项目表单（想法/截止日期/交付物） |
| `/projects/[projectId]` | [projects/[projectId]/page.tsx](d:\Flowors\ProjectFlow\frontend\src\app\projects\[projectId]\page.tsx) | **核心页面**：项目仪表盘，包含全部 Agent 操作和项目数据展示 |

### 前端组件按领域

| 领域 | 组件 | 功能 |
|---|---|---|
| **Shell** | [app-shell.tsx](d:\Flowors\ProjectFlow\frontend\src\components\app-shell.tsx) | 全局导航栏（首页/工作台/新建项目），localStorage 持久化 workspace ID |
| **首页** | [projectflow-home.tsx](d:\Flowors\ProjectFlow\frontend\src\components\projectflow-home.tsx) | 欢迎页 + 演示数据加载 |
| **Onboarding** | account-setup-form.tsx, member-profile-wizard.tsx | 账号设置 + 成员资料向导 |
| **Workspace** | workspace-create-form.tsx, invite-member-panel.tsx | 工作区创建 + 成员邀请 |
| **Project** | project-dashboard.tsx, project-intake-form.tsx, resource-input-panel.tsx | 项目仪表盘 + 项目创建 + 资源输入 |
| **Agent** | action-card.tsx, agent-proposal-panel.tsx, direction-card-panel.tsx, export-panel.tsx, team-actions-panel.tsx, timeline.tsx | 行动卡列表 + 提案确认面板 + 方向卡展示 + 导出面板 + 团队行动面板 + Agent 时间线 |
| **Stage** | stage-plan-board.tsx | 阶段计划看板 |
| **Task** | task-breakdown-board.tsx, task-status-update.tsx | 任务拆解看板 + 任务状态更新列表 |
| **Assignment** | assignment-flow-panel.tsx | 分工流程面板（提案/响应/协商/确认） |
| **Check-in** | checkin-form.tsx | 签到表单 |
| **Risk** | risk-panel.tsx, risk-card.tsx, replan-diff.tsx | 风险面板 + 风险卡 + 重计划差异对比 |
| **UI** | 20 个基础组件 | shadcn/ui 体系：button/card/input/select/textarea/dialog/tabs/badge/progress/tooltip/sheet/separator/avatar/dropdown-menu/empty-state/form-field/form-section/step-indicator/completion-bar/tag-input |

### 项目仪表盘布局结构

项目仪表盘是系统最复杂的页面，自上而下包含：

1. **面包屑导航**：工作台 → 项目名
2. **项目头部**：状态标签 + 截止日期 + 项目名 + 想法 + 当前阶段 + 推荐下一步 + 3 个指标卡（P0 待处理/分工覆盖率/活跃行动卡）
3. **推荐行动卡高亮**：最新 active 行动卡
4. **Agent 操作区**：4 阶段网格（规划/分工/执行/监控），当前阶段高亮，推荐操作按钮加粗
5. **Agent 提案面板**：待确认/拒绝的 clarify/plan/breakdown 提案
6. **方向卡面板**：展示 direction_card
7. **阶段计划看板**：所有阶段 + 任务
8. **任务拆解看板**：按阶段分组的任务列表
9. **分工流程面板**：提案/响应/协商/确认
10. **Tabs 区域**：行动卡 / 签到与状态 / 风险与调整 / 时间线与导出

---

## 五、种子数据结构

### 三套种子数据

| 文件 | 功能 | 数据规模 |
|---|---|---|
| [demo_seed.py](d:\Flowors\ProjectFlow\backend\app\seed\demo_seed.py) | 轻量演示重置（5 人 + 2 阶段 + 5 任务） | 5 users, 1 workspace, 1 project, 2 stages, 5 tasks, 3 proposals, 1 checkin cycle, 1 risk, 2 action cards |
| [demo_projectflow.py](d:\Flowors\ProjectFlow\backend\app\seed\demo_projectflow.py) | 完整演示数据（6 人 + 4 阶段 + 10 任务，固定 ID） | 6 users, 1 workspace, 1 project, 4 stages, 10 tasks, 3 proposals, 1 checkin cycle + 3 responses, 3 risks, 5 action cards, 5 agent events |
| [demo_blocker_scenario.py](d:\Flowors\ProjectFlow\backend\app\seed\demo_blocker_scenario.py) | Blocker 场景文档（无额外数据，场景嵌入 demo_projectflow.py） | 仅文档描述 |
| [reset.py](d:\Flowors\ProjectFlow\backend\app\seed\reset.py) | 清空所有表数据 | 按 16 个表逆序删除 |

### demo_seed.py 数据结构（轻量版）

- **5 个用户**：Lin(owner), Mia, Chen, Noor, Jay
- **1 个工作区**："ProjectFlow Demo Team"
- **1 个项目**："AI Study Planner"，active 状态，已有 direction_card
- **2 个阶段**：Prototype Loop(active) + Review Prep(pending)
- **5 个任务**：2 个 P0 in_progress + 2 个 P1 not_started + 1 个 P2 not_started
- **3 个分工提案**：前 3 个任务的 finalized 提案
- **1 个签到周期** + 1 个签到响应（Mia 报告 blocker）
- **1 个任务状态更新**（blocked）
- **1 个风险**：deadline 类型，high severity
- **2 个行动卡**：team_next_step + personal_task

### demo_projectflow.py 数据结构（完整版，固定 ID）

- **6 个用户**：小林(owner), 小王, 小张, 小李, 小赵, 小刘
- **1 个工作区**："ProjectFlow 团队"
- **1 个项目**："ProjectFlow"，active 状态，current_stage_id = implementation
- **4 个阶段**：调研与方向(completed) → 设计与规划(completed) → 核心实现(active) → 测试与打磨(pending)
- **10 个任务**：3 done + 3 in_progress + 2 not_started + 2 not_started
- **3 个分工提案**：前端/后端/Agent 核心，全部 finalized
- **1 个签到周期** + 3 个签到响应（小王 high + 小张 medium with blocker + 小赵 high）
- **3 个风险**：dependency(medium) + workload(high) + deadline(medium)
- **5 个行动卡**：3 personal_task + 1 risk_action + 1 team_next_step
- **5 个 Agent 事件**：clarify → plan → breakdown → assign → push
- **3 个项目资源**：训练营要求 + shadcn/ui 链接 + 技术栈决策

### Blocker 演示场景

小张报告 SQLite 外键约束 blocker + 可用时间下降 → 触发 dependency/workload/deadline 三重风险 → Agent 推荐：小林协助排查、考虑削减非核心 API → 演示流程：check-in → risk analysis → replan → timeline → export

---

## 六、数据模型关系图

```
User ──┬── WorkspaceMembership ──── Workspace
       ├── MemberProfile ──────────┘
       ├── Invitation ─────────────┘
       │
       └── Project ──┬── Stage ──── Task ──── AssignmentProposal
                      │                        ├── AssignmentResponse
                      │                        └── AssignmentNegotiation
                      ├── ProjectResource
                      ├── CheckInCycle ── CheckInResponse
                      ├── Risk
                      ├── ActionCard
                      ├── TaskStatusUpdate
                      └── AgentEvent

AgentProposal (独立表，关联 project_id + agent_event_id)
```

**15 个数据库模型**：User, Workspace, WorkspaceMembership, Invitation, MemberProfile, Project, ProjectResource, Stage, Task, AssignmentProposal, AssignmentResponse, AssignmentNegotiation, CheckInCycle, CheckInResponse, Risk, ActionCard, TaskStatusUpdate, AgentEvent, AgentProposal

**19 个 Service**：对应每个领域实体的 CRUD + 业务逻辑，其中 `agent_flow_service` 是 Agent 输出持久化的核心编排层。

**22 个 Schema 文件**：每个 API 的请求/响应都有 Pydantic schema 定义。
        
          
基于代码库的实际功能模块，以下是 4 人纵向分工方案：

---

## 测试分工方案

### 人员分配

| 编号 | 轨道 | 覆盖状态机阶段 | Agent 模块 |
|------|------|---------------|-----------|
| **A** | 冷启动 + 规划 | AccountSetup → WorkspaceSetup → MemberProfiles → ProjectIntake → Clarification → StagePlanning → TaskBreakdown | clarify, plan, breakdown |
| **B** | 分工 + 协商 | AssignmentRecommendation → AssignmentConfirmation → AssignmentNegotiation → AssignmentConfirmation | assign, negotiate |
| **C** | 执行推进 + 签到 | ActivePush → Execution → CheckIn | push, checkin |
| **D** | 风险 + 重规划 + 导出 | RiskAnalysis → Replanning → ActivePush(循环) + Export + Timeline | risk, replan |

---

### A：冷启动 + 规划流

**测试目标**：从零开始的新用户能否无文档走完"注册→建项目→拿到任务拆解"

#### 纵向流程

| 步骤 | 操作 | 验证点 |
|------|------|--------|
| A1 | 打开 `localhost:3000`，无 workspace 记录 | 看到欢迎页，有"开始使用"和"加载演示数据"两个入口 |
| A2 | 点击"开始使用"，进入 onboarding | 账号设置表单是否完整，是否用 shadcn 组件 |
| A3 | 填写用户名，提交 | 创建成功，跳转到 profile 填写 |
| A4 | 填写成员资料（技能/时间/意向/限制） | 向导步骤是否清晰，每步有 loading/success 状态 |
| A5 | 创建 Workspace | 成功跳转到工作台，导航栏出现"工作台" |
| A6 | 邀请成员（至少 3 人） | 邀请流程是否顺畅，被邀请人是否出现在成员列表 |
| A7 | 为每个成员填写 profile | 技能/时间/意向/限制是否都保存正确 |
| A8 | 新建项目（想法 + 截止日期 + 交付物） | 项目创建成功，跳转到项目仪表盘 |
| A9 | 添加项目资源（文本笔记/链接） | 资源是否出现在项目下 |
| A10 | 点击"方向澄清"Agent 操作 | Agent 生成方向卡，包含 problem/users/value/deliverables/boundaries/risks/questions |
| A11 | 查看 Agent 提案面板 | 方向卡内容展示是否完整，有确认/拒绝按钮 |
| A12 | 确认方向卡 | 方向卡持久化到项目，仪表盘更新 |
| A13 | 点击"阶段规划"Agent 操作 | Agent 生成 3 个阶段（name/goal/dates/deliverable/done_criteria） |
| A14 | 确认阶段计划 | 阶段持久化，阶段看板更新 |
| A15 | 点击"任务拆解"Agent 操作 | Agent 为当前阶段生成 3 个优先级任务（P0/P1/P2） |
| A16 | 确认任务拆解 | 任务持久化，任务看板更新 |

#### 横向评估

| 维度 | 具体检查项 |
|------|-----------|
| **Agent 输出质量** | 方向卡是否针对项目想法而非泛泛而谈；阶段是否合理拆分；任务优先级是否恰当；每个输出是否都有 reason |
| **Agent 引用完整性** | Agent 是否编造了不存在的成员/任务/阶段；task_id/stage_id 是否引用正确 |
| **交互体验** | 每步操作后是否有 loading 状态；确认/拒绝后页面是否更新；面包屑导航是否正确 |
| **错误恢复** | Agent 超时/失败时是否有 fallback；fallback 输出是否安全（无 None 值）；页面是否崩溃 |
| **数据一致性** | 确认后刷新页面，数据是否还在；方向卡/阶段/任务字段是否与后端 schema 一致 |
| **UI 状态** | 每个操作区域是否有 empty/loading/error/success 四态；推荐下一步是否正确推断 |

#### 测试方式

- **第一轮**：`LLM_PROVIDER=mock`，验证流程完整性
- **第二轮**：`LLM_PROVIDER=openai` 或 `openai-compatible`，验证真实 Agent 输出质量
- 每轮记录：Agent 原始输出截图 + 问题描述

---

### B：分工 + 协商流

**测试目标**：Agent 推荐的分工是否合理，成员拒绝后协商是否闭环

#### 前置条件

使用种子数据（`POST /api/seed/demo`）加载已有项目，或由 A 完成后接手。项目需已有阶段和任务。

#### 纵向流程

| 步骤 | 操作 | 验证点 |
|------|------|--------|
| B1 | 点击"分工推荐"Agent 操作 | Agent 为每个任务推荐 owner + backup_owner + reason |
| B2 | 查看分工提案面板 | 每个提案展示：任务名 + 推荐人 + 备选人 + 理由 |
| B3 | 确认一个提案 | 状态变为 finalized，任务关联 owner |
| B4 | 拒绝一个提案 | 状态变为 owner_rejected，出现协商入口 |
| B5 | 发起协商 | Agent 生成协商选项（交换/重新分配/调整任务） |
| B6 | 接受协商方案 | 协商 resolved，生成新提案 |
| B7 | 拒绝协商方案 | 协商 declined，回到原提案状态 |
| B8 | 批量确认阶段分工 | 该阶段所有提案同时 finalized |
| B9 | 验证分工覆盖率 | 仪表盘指标卡"分工覆盖率"是否正确计算 |
| B10 | 切换到下一阶段，重新触发分工 | 新阶段是否生成新的分工推荐 |

#### 横向评估

| 维度 | 具体检查项 |
|------|-----------|
| **Agent 输出质量** | 分工是否考虑了成员技能/时间/意向/限制；reason 是否有具体依据而非泛泛而谈；backup_owner 是否合理 |
| **协商质量** | 协商选项是否真正解决了拒绝原因；是否编造了不存在的成员或任务 |
| **交互体验** | 确认/拒绝按钮是否明确；协商流程是否自解释；分工状态变化是否有视觉反馈 |
| **状态一致性** | finalized 后任务 owner 是否更新；协商后原提案状态是否正确迁移；批量确认是否原子性 |
| **边界情况** | 所有成员都拒绝时的表现；只有 1 个成员时的分工推荐；任务数 > 成员数时的分配 |
| **数据完整性** | AssignmentProposal → AssignmentResponse → AssignmentNegotiation 链路是否完整；拒绝后再确认是否正常 |

#### 测试方式

- **第一轮**：mock 模式，验证流程闭环
- **第二轮**：真实 LLM，重点验证 reason 质量和协商建议的合理性
- **第三轮**：故意拒绝所有提案，测试协商极限情况

---

### C：执行推进 + 签到流

**测试目标**：Agent 是否主动推进项目，签到后是否正确分析并更新状态

#### 前置条件

项目已有 finalized 的分工（可从 B 接手，或用种子数据）。

#### 纵向流程

| 步骤 | 操作 | 验证点 |
|------|------|--------|
| C1 | 点击"主动推进"Agent 操作 | Agent 生成 1 张最高优先级行动卡（personal_task/team_next_step/reminder/risk_action/kickoff_tip） |
| C2 | 查看行动卡列表 | 行动卡展示：类型 + 内容 + 指向成员/任务；有 done/dismiss 操作 |
| C3 | 标记行动卡完成 | 状态变为 done，从活跃列表消失 |
| C4 | 标记行动卡忽略 | 状态变为 dismissed |
| C5 | 创建签到周期 | 签到周期创建成功，状态 active |
| C6 | 成员提交签到响应（progress/mood/blockers/plan） | 每个成员可提交一次；blocker 描述是否保存 |
| C7 | 点击"签到分析"Agent 操作 | Agent 分析签到数据：更新任务状态、识别风险、生成行动卡 |
| C8 | 验证任务状态更新 | blocker 导致的任务是否变为 blocked；进度正常的任务是否更新 |
| C9 | 验证签到后风险 | 是否自动生成风险记录（checkin 类型） |
| C10 | 验证签到后行动卡 | 是否生成新的行动卡（如 checkin_prompt） |
| C11 | 暂停/完成签到周期 | 周期状态正确迁移 |
| C12 | 多轮签到 | 创建第二个周期，验证历史数据是否保留 |

#### 横向评估

| 维度 | 具体检查项 |
|------|-----------|
| **Agent 输出质量** | 行动卡是否指向最高优先级任务；签到分析是否基于实际签到数据而非编造；任务状态更新是否有依据 |
| **推进感知** | 用户是否感觉到 Agent 在"主动推"；行动卡是否可操作而非纯信息 |
| **签到分析深度** | Agent 是否识别了 blocker；是否更新了任务状态；是否生成了风险；reason 是否有 evidence |
| **交互体验** | 签到表单是否简洁；行动卡操作是否一键完成；签到历史是否可查看 |
| **数据一致性** | 签到响应是否关联正确的周期和成员；任务状态更新是否与签到分析一致 |
| **Fallback 安全** | Agent 分析失败时，fallback 行动卡是否有合法默认值；fallback 签到分析是否安全 |

#### 测试方式

- **第一轮**：mock 模式，验证流程
- **第二轮**：真实 LLM，重点验证签到分析的深度（是否真的读了签到数据）
- **第三轮**：故意在签到中报告 blocker，验证 Agent 是否识别并响应

---

### D：风险 + 重规划 + 导出流

**测试目标**：Agent 是否识别真实风险，重规划是否最小化调整，导出是否有价值

#### 前置条件

项目处于执行阶段，有签到数据、有风险（可从 C 接手，或用种子数据 `demo_projectflow`）。

#### 纵向流程

| 步骤 | 操作 | 验证点 |
|------|------|--------|
| D1 | 点击"风险分析"Agent 操作 | Agent 返回 1 个最高风险项（type/severity/evidence/mitigation） |
| D2 | 查看风险面板 | 风险卡展示：类型 + 严重度 + 证据 + 缓解建议；有 accept/ignore/resolve 操作 |
| D3 | 接受风险 | 状态变为 accepted |
| D4 | 忽略风险 | 状态变为 ignored |
| D5 | 解决风险 | 状态变为 resolved |
| D6 | 点击"重规划"Agent 操作 | Agent 生成 before/after 对比 + 影响分析 + 最多 1 阶段调整 + 1 任务变更 + 1 行动卡 |
| D7 | 查看重计划差异面板 | before/after 对比是否清晰；影响分析是否有依据 |
| D8 | 确认重计划 | 阶段/任务/行动卡变更持久化 |
| D9 | 拒绝重计划 | 不持久化，回到原状态 |
| D10 | 查看 Agent 时间线 | 所有 Agent 事件按时间排列，包含 status（success/repaired/fallback/failed） |
| D11 | 导出评审摘要 | 生成项目评审文档，包含项目信息/阶段/任务/风险/Agent 决策记录 |
| D12 | 高风险建议确认流程 | 风险分析返回 high severity 时，是否需要人工确认 |
| D13 | 重规划后回到 ActivePush | 验证循环闭环：replan → push → checkin → risk → replan |

#### 横向评估

| 维度 | 具体检查项 |
|------|-----------|
| **Agent 输出质量** | 风险 evidence 是否来自实际数据（签到/任务状态/截止日期）而非编造；severity 是否与 evidence 匹配；mitigation 是否可操作 |
| **重规划质量** | 调整是否最小化（不是推翻重来）；before/after 是否清晰；impact 分析是否合理 |
| **高风险确认** | high severity 风险是否强制人工确认；确认前是否无法自动执行 |
| **交互体验** | 风险卡是否一目了然；重计划 diff 是否易读；时间线是否可追溯 |
| **导出价值** | 评审摘要是否包含关键信息；格式是否可用；是否遗漏重要数据 |
| **循环闭环** | replan → push → checkin → risk → replan 循环是否顺畅；每轮循环数据是否累积 |
| **Fallback 安全** | 风险分析 fallback 是否有合法默认值；重规划 fallback 是否安全（不破坏已有数据） |

#### 测试方式

- **第一轮**：mock 模式，验证流程闭环
- **第二轮**：真实 LLM，重点验证 risk evidence 是否来自真实数据和 replan 是否最小化
- **第三轮**：用 `demo_projectflow` 种子数据（含 blocker 场景），验证完整风险链路

---

## 全员共同关注

| 项目 | 说明 |
|------|------|
| **真实 LLM 测试** | 每条轨道都必须在真实 LLM 下跑一轮，mock 模式只用于流程验证 |
| **Agent 输出截图** | 每次 Agent 输出都截图，用于后续评估输出质量 |
| **反馈格式** | 统一用：`【轨道-步骤】【现象】【期望】【严重度】【截图】` |
| **严重度定义** | ❌ 阻塞（流程中断/数据丢失） / ⚠️ 体验（可用但不好用） / 💡 优化（锦上添花） |
| **LLM 配置** | 测试真实 LLM 时：`LLM_PROVIDER=openai`，`LLM_MODEL=gpt-4o-mini`，`LLM_API_KEY=你的key` |

---

## 测试节奏建议

| 阶段 | 内容 | 时长 |
|------|------|------|
| **准备** | 各自配环境、跑通 mock 模式 | 30min |
| **第一轮** | mock 模式走完流程，记录流程问题 | 1h |
| **第二轮** | 真实 LLM 跑完整流程，重点评估 Agent 输出 | 1.5h |
| **第三轮** | 边界/极限测试（拒绝所有/全 blocker/空数据） | 1h |
| **汇总** | 各轨道提交问题清单，统一排优先级 | 30min |

4 条轨道可以**并行执行**（各自用独立的种子数据实例），互不阻塞。