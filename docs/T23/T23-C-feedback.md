# Bug 记录

---

## BUG-001 行动卡在"你的行动"和"团队下一步"中重复显示

【C-1】【现象】Agent 主动推进生成的行动卡（type=team_next_step）同时出现在"你的行动"和"团队下一步"两个区域。例如一张"Confirm next action: 前端 Shell 与核心页面"卡，既作为当前用户的个人行动显示，又作为团队下一步显示。

【期望】"你的行动"和"团队下一步"应互斥分区：`user_id` 为空的团队类型卡只出现在"团队下一步"；`user_id` 指向当前用户的卡只出现在"你的行动"。同一张卡不应出现在两个区域。

【严重度】⚠️ 体验 → ✅ 已修复

【截图】（待补充）

**根因分析：**

1. **后端** `active_push.py:54` fallback 给 `team_next_step` 类型卡设了 `user_id: member_id`，违反了 TECH-DESIGN §8.18 中 `user_id` nullable 的设计约定（"空表示团队卡片"）。
2. **前端** `team-actions-panel.tsx:16-18` 的过滤只按 `type` 筛选，未排除已有 `user_id` 的卡；`project-dashboard.tsx:166-168` 的个人卡过滤只按 `user_id` 筛选，未排除团队类型。两个过滤器用正交维度，缺少互斥保护。

**修复记录（2026-06-03）：**
- ✅ `frontend/src/components/agent/team-actions-panel.tsx:17` — 过滤从 `!card.user_id && type in (team_next_step, kickoff_tip, reminder)` 简化为 `!card.user_id`（按 user_id 决定归属，不再按 type 白名单）
- ✅ `frontend/src/components/project/project-dashboard.tsx:173` — 个人卡过滤从 `card.user_id === currentUserId && !TEAM_CARD_TYPES.has(card.type)` 简化为 `card.user_id === currentUserId`
- ✅ 逻辑变更：所有 `user_id` 为空的卡归团队面板，有 `user_id` 的归个人面板，无论 type

**涉及文件：**
- `frontend/src/components/agent/team-actions-panel.tsx:17` — teamCards 过滤
- `frontend/src/components/project/project-dashboard.tsx:173` — personalCards 过滤

---

## BUG-002 行动卡完成/忽略后无历史可查，无法确认最终状态

【C-1】【现象】行动卡点击"完成"或"忽略"后，卡从列表消失，没有任何地方展示已处理（done/dismissed）的行动卡历史。用户无法回看一张卡最终是被完成还是被忽略的。

【期望】已处理的行动卡应保留可查看的历史记录，让用户确认每张卡的最终状态（done 或 dismissed）。可在行动卡区域增加"已完成"/"已忽略"子列表或折叠面板。

【严重度】⚠️ 体验

【截图】（待补充）

**根因分析：**

1. **前端** `project-dashboard.tsx:166-168` 和 `team-actions-panel.tsx:16-18` 都只渲染 `status === "active"` 的卡，done/dismissed 卡被完全过滤掉
2. **前端** `action-card.tsx:163` 的 `ActionCardsList` 同样只取 active 卡
3. 无任何组件负责展示非 active 行动卡的历史

**涉及文件：**
- `frontend/src/components/project/project-dashboard.tsx` — personalCards 只取 active
- `frontend/src/components/agent/team-actions-panel.tsx` — teamCards 只取 active
- `frontend/src/components/agent/action-card.tsx` — ActionCardsList 只取 active

---

## BUG-003 项目 header 绿色"推荐行动卡"区域无个人差异化

【C-1】【现象】项目 header 下方的绿色高亮区域（Sparkles 图标 + 推荐行动卡）始终显示 `action_cards` 中第一张 active 卡，不考虑当前用户身份。切换用户后，推荐内容不变——可能展示的是其他成员的 personal_task 卡，对当前用户无意义。

【期望】绿色推荐区域应优先展示与当前用户相关的行动卡：先找 `user_id === currentUserId` 的个人卡，再 fallback 到 `user_id` 为空的团队卡。不应展示其他成员的专属卡。

【严重度】⚠️ 体验

【截图】（待补充）

**根因分析：**

`project-dashboard.tsx:160` 的 `nextAction` 取值逻辑为 `action_cards.find((card) => card.status === "active")`，仅按 active 状态取第一张，不参考 `currentUserId`。而下方行动卡列表的 `personalCards` 已正确按 `currentUserId` 过滤，两处逻辑不一致。

**涉及文件：**
- `frontend/src/components/project/project-dashboard.tsx:160` — nextAction 不考虑 currentUserId

---

## BUG-004 签到中报告 blocker 后，对应任务状态未变为 blocked

【C-9/C-10】【现象】成员在签到中报告了 blocker（如"SQLite 外键约束报错，排查了 2 小时未解决"），但对应任务的状态仍为 `in_progress`，未变为 `blocked`。运行签到分析后任务状态也未改变。

【期望】签到分析应识别 blocker 签到，将对应任务状态更新为 `blocked`，并生成对应风险记录。

【严重度】❌ 阻塞 → ✅ 已修复

【截图】（待补充）

**根因分析（原始，已确认）：**

1. **数据层**：`WorkspaceStateResponse` 不包含签到响应数据（无 `checkin_cycles` / `checkin_responses` 字段），LLM 看不到 blocker
2. **Prompt 层**：`checkin_analysis.py` 的 `user_prompt` 缺乏对 blocker 的明确指示
3. **Fallback**：fallback payload 硬编码，不检测实际 blocker 数据
4. **Max tokens**：`_max_tokens_for_event` 中 checkin 仅 900，对推理模型（DeepSeek V4-pro）不够，reasoning_tokens 吃掉所有 token 导致空输出

**修复记录（2026-06-02）：**
- ✅ `prompts.py:194-204` — _compact_workspace_state_json 已为 checkin 事件序列化 `checkin_responses` 数据
- ✅ `checkin_analysis.py:41-83` — fallback 已改为检查签到响应中的 blocker，动态生成 task_updates 和 risks
- ✅ `checkin_analysis.py:97-112` — user_prompt 已包含明确的 blocker 分析指令
- ✅ `workflow.py:142-153` — _max_tokens_for_event 全部提升 2-4x（适配推理模型 reasoning_tokens）
- ✅ `output_schemas.py:165` — evidence 从 `list[dict]` → `list[str | dict]`（适配 LLM 输出字符串证据）
- 2026-06-02 C12 验证：DeepSeek V4-pro 成功输出签到分析（status: success），正确识别 blocker 并设为 blocked

**涉及文件：**
- `backend/app/agent/prompts.py` — checkin_responses 序列化
- `backend/app/agent/modules/checkin_analysis.py` — blocker fallback 检测 + user_prompt
- `backend/app/agent/workflow.py` — max_tokens 大幅提升
- `backend/app/agent/output_schemas.py` — evidence 类型放宽

---

## BUG-005 手动更新任务状态无效：只写历史记录，不更新 Task.status

【C-11】【现象】在"签到与状态"标签下的"更新任务状态"区域，选择任务、更改状态后点击"更新状态"，操作返回成功，但任务状态未实际改变。

【期望】更新任务状态应同时：(1) 在 `task_status_updates` 表创建历史记录；(2) 将 `tasks` 表中对应任务的 `status` 字段更新为新值。

【严重度】❌ 阻塞 → ✅ 已修复

【根因分析：**

`task_service.py:55` 的 `create_status_update` 只创建 `TaskStatusUpdate` 记录，不更新 `Task.status`。且 `TaskStatusUpdateCreate.task_id` 字段与路由 URL 路径的 `task_id` 冲突，LLM 输出的 `task_updates` 中也包含 `task_id`（agent_flow_service 调用时多了一层嵌套）。

**修复记录（2026-06-02）：**
- ✅ `task_service.py:55-79` — `create_status_update` 现在接受 `task_id` 作为独立参数，同时更新 `Task.status`
- ✅ `schemas/task.py:48-54` — `TaskStatusUpdateCreate` 移除了 `task_id` 字段（由路由从 URL 设置）
- ✅ `services/agent_flow_service.py:133-147` — 调用方适配新签名
- ✅ `routes_tasks.py:107-113` — 路由层适配

**涉及文件：**
- `backend/app/services/task_service.py`
- `backend/app/schemas/task.py`
- `backend/app/api/routes_tasks.py`
- `backend/app/services/agent_flow_service.py`

---

## BUG-006 推理模型（DeepSeek V4-pro）max_tokens 不足导致空输出

【C-9/C-12】【现象】DeepSeek V4-pro（推理模型）在签到分析等复杂任务中连续返回空内容。finish_reason=`length`，全部 completion_tokens 被 `reasoning_tokens` 吃掉，无输出 token 留给实际内容。

【期望】Agent 输出应为完整的结构化 JSON。max_tokens 应为推理模型预留足够的 reasoning 空间。

【严重度】❌ 阻塞 → ✅ 已修复

**根因分析：**

`workflow.py:142-153` 的 `_max_tokens_for_event` 中签到分析仅 900 tokens。对 DeepSeek V4-pro（推理模型），1500 tokens 全部被 reasoning 消耗，输出为 0 且 finish_reason=`length`。

**修复记录（2026-06-02）：**
- ✅ `workflow.py:142-153` — clarify 900→3000, plan 1600→4000, breakdown 1400→4000, assign 1100→3000, negotiate 900→2000, push 1000→3000, checkin 900→4000, risk 1000→3000, replan 1200→4000

**涉及文件：**
- `backend/app/agent/workflow.py:142-153` — _max_tokens_for_event

---

## BUG-007 evidence 字段类型不匹配：Prompt 要求字符串但 Schema 要求 dict

【C-9】【现象】`checkin_analysis.py` 的 prompt 指示 LLM 在 evidence 中使用可读中文句子（`["小张 在「后端」中报告阻塞：..."]`），`RiskProposal.evidence` 的 fallback payload 也是字符串数组。但 `RiskProposal` schema 定义 `evidence: list[dict[str, Any]]`，导致 LLM 输出和 fallback 都通不过 pydantic 校验。

【期望】evidence 应兼容字符串和 dict 两种格式，适配 LLM 实际输出行为。

【严重度】❌ 阻塞 → ✅ 已修复（2026-06-02）
- ✅ `output_schemas.py:165` — `evidence: list[dict[str, Any]]` → `list[str | dict[str, Any]]`

**涉及文件：**
- `backend/app/agent/output_schemas.py:165`

---

## BUG-008 Agent 输出使用内部 ID 而非成员名/任务名

【C-1/C-9】【现象】Agent 在行动卡和签到分析的用户可见文本中使用了 `demo-user-003`、`demo-task-007` 等内部 ID，用户无法理解这些字符串指代谁或哪个任务。

【期望】所有用户可见文本应使用成员 display_name（如"小张"）和任务 title（如"后端 API 与数据模型"），不暴露内部 ID。

【严重度】❌ 阻塞 → ✅ 已修复

**根因分析：**

1. **数据层**：`_compact_member` 未向 LLM 提供成员 display_name，LLM 只知道 user_id
2. **Prompt 层**：`AGENT_SYSTEM_PROMPT` 和 OUTPUT_CONTRACT 未要求用名字替代 ID
3. **签到数据**：checkin_responses 序列化时只放 user_id/task_id，没有 member_name/task_title

**修复记录（2026-06-03）：**
- ✅ `prompts.py:68-79` — `_compact_member` 新增 `include_name` 参数，push/checkin/risk/replan 时输出 `name` 字段
- ✅ `prompts.py:197-206` — checkin_responses 序列化改用 `member_name` + `task_title` 替代裸 ID
- ✅ `prompts.py:7-14` — `AGENT_SYSTEM_PROMPT` 新增 "Never use raw IDs in user-facing text，使用名字和任务标题"
- ✅ `active_push.py:42` — user_prompt 新增 "使用成员名字和任务标题，不要用内部 ID"
- ✅ `checkin_analysis.py:98-112` — user_prompt 更新为引用 `member_name`/`task_title`
- ✅ `risk_analysis.py:12-13` — user_prompt 从 "cite task_id/user_id" → "cite task titles and member names"
- ✅ `replanning.py:11-12` — user_prompt 同样修正

**涉及文件：**
- `backend/app/agent/prompts.py` — AGENT_SYSTEM_PROMPT + _compact_member + checkin_responses 序列化
- `backend/app/agent/modules/active_push.py` — user_prompt
- `backend/app/agent/modules/checkin_analysis.py` — user_prompt
- `backend/app/agent/modules/risk_analysis.py` — user_prompt
- `backend/app/agent/modules/replanning.py` — user_prompt

---

## BUG-009 Agent 输出中英文混杂

【C-1】【现象】主动推进生成的行动卡标题、内容、原因等字段为英文（如 "Overload risk: Frontend Shell task due tomorrow"），用户团队是中国大学生，需要中文。

【期望】所有用户可见文本应为中文。

【严重度】⚠️ 体验 → ✅ 已修复

**根因分析：**

1. `AGENT_SYSTEM_PROMPT` 未要求中文输出
2. `active_push.py` 的 user_prompt 未要求中文
3. `OUTPUT_CONTRACT` 的 push 条目未要求中文

**修复记录（2026-06-03）：**
- ✅ `prompts.py:7-14` — `AGENT_SYSTEM_PROMPT` 新增 "ALL user-facing text MUST be written in Chinese"
- ✅ `prompts.py:38` — OUTPUT_CONTRACT push 新增 "All text fields MUST be written in Chinese"
- ✅ `active_push.py:42` — user_prompt 新增 "ALL text fields MUST be written in Chinese"
- ✅ `risk_analysis.py:13` — user_prompt 新增中文化要求
- ✅ `replanning.py:12` — user_prompt 新增中文化要求

**涉及文件：**
- `backend/app/agent/prompts.py` — AGENT_SYSTEM_PROMPT + OUTPUT_CONTRACT push
- `backend/app/agent/modules/active_push.py` — user_prompt
- `backend/app/agent/modules/risk_analysis.py` — user_prompt
- `backend/app/agent/modules/replanning.py` — user_prompt

---

## BUG-010 签到分析重复执行产生重复风险记录

【C-12】【现象】签到分析 fallback 或重复执行后，risks 表中出现多条相同内容的风险记录（如 3 条相同的 `「后端 API 与数据模型」被阻塞` 风险）。`_persist_risks` 无去重逻辑，每次执行都 INSERT 新的风险。

【期望】签到分析应在创建风险前检查是否已有同 task_id + 同 type + 同 severity 的 active 记录。或至少应在持久化时做内容去重。

【严重度】⚠️ 体验

【截图】（待补充）

**根因分析：**

`agent_flow_service.py:157-177` 的 `_persist_risks` 直接 `create_risk`，不查重。`risk_service.py` 的 `create_risk` 也不做任何重复检查。重复执行签到分析（或 fallback 路径）会导致相同内容风险叠加。

**涉及文件：**
- `backend/app/services/agent_flow_service.py` — _persist_risks 无去重
- `backend/app/services/risk_service.py` — create_risk 无查重
