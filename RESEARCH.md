# RESEARCH.md

## 项目边界

本研究以当前项目方案为边界：**ProjectFlow Agent** 面向大学生科创/竞赛项目，核心不是做一个通用看板，而是打通：

> 方向确定 → 任务拆解 → 个性化任务分类与协调 → 执行及进度跟踪 → 风险判断 → 提醒与动态调整

项目要解决的是大学生团队项目常见的 **启动难、协调难、推进慢**。因此本资料池只保留两类高价值材料：

1. 能帮助产品主链路做得更清楚的材料。
2. 适合学生团队、短周期、低预算条件下实现的材料。

MVP 边界延续原方案：7 天 MVP 不做企业级权限、复杂即时通讯、自动完整编码、移动端 App、高级甘特图等高复杂度能力，优先把主链路跑通。

---

# MATERIALS

## 1. Product References

| 名称 | 链接/来源 | 类型 | 可借鉴点 | 不适合照搬的点 |
|---|---|---|---|---|
| Taskade AI Project Management Team | [官网](https://www.taskade.com/agents/teams/project-management) / [GitHub](https://github.com/taskade/taskade) | AI 项目管理 / AI 原生 workspace | 强调“AI 项目管理团队”而不是单个机器人，把计划、资源、进度、多视图和实时协作放在同一工作台里。适合借鉴“AI 协调员 + 项目工作台”的叙事。 | 它已经扩展到单提示生成应用、自动化、100+ 集成、多视图平台，范围远大于当前项目。照搬会把 MVP 拉向“全能工作台”。 |
| Plane AI | [官网](https://plane.so/ai) / [GitHub](https://github.com/makeplane/plane) | AI-native 项目管理 / 开源项目 | “从提示结构化项目”“从实时数据回答问题”“把 agent 指派到工作项上”“自动查重与摘要”都贴近 ProjectFlow 的方向卡—任务—风险—调整链路。 | Plane 假设系统里已有大量项目上下文和持续运行数据。学生团队早期上下文密度不足，首版模仿会导致实现成本偏重。 |
| Linear Projects / Cycles | [Projects 文档](https://linear.app/docs/projects) / [Cycles 文档](https://linear.app/docs/use-cycles) | 产品开发项目管理 | 项目页把结果、计划完成时间、进度图、通知放在一起；Cycles 支持自动周期、未完成任务 rollover、容量估算。适合借鉴“项目健康度 + 周期节奏 + 容量提醒”。 | Linear 偏工程 issue 流，适合已经明确做什么的团队。ProjectFlow 的差异化在“方向收敛”和“学生协作”，不能做成工程 issue 工具轻量版。 |
| Motion AI Project Manager | [官网](https://www.usemotion.com/features/ai-project-manager.html) | AI 排程 / 延期预测 | 主打按团队容量预测完成时间、主动标记 at-risk 任务、自动更新状态。适合借鉴“延期预警”和“基于容量而不是只看截止日期”的思路。 | 强依赖准确时长估计、日历纪律和持续维护。学生团队输入不稳定，强预测会变成“看似智能，实际不可信”。不适合首版。 |
| Asana Smart Status / Asana AI | [Smart Status](https://help.asana.com/s/article/smart-status) / [Asana AI](https://asana.com/product/ai) | 通用 PM + AI 状态总结 | “项目概览页里由 AI 草拟状态更新”很适合借鉴。ProjectFlow 可在每周总结、中期评审、最终展示前自动生成结构化状态摘要。 | 公开评论样本反复提到通知过多、移动端 My Tasks 排序/筛选体验问题。不能复制它的全量通知模型。 |
| Notion Projects and Tasks | [官方指南](https://www.notion.com/help/guides/getting-started-with-projects-and-tasks) | 文档 + 项目一体化 | 文档、任务、项目在同一空间，能切成看板、时间线等视图。适合借鉴“方向卡、任务卡、评审备注、Demo 说明不分散”的一体化思路。 | Notion 的高自由度容易导致空白页焦虑、任务散落、多数据库维护成本。ProjectFlow 应借鉴“一体化”，不要借鉴“无限自由配置”。 |
| GitHub Projects | [官方文档](https://docs.github.com/en/issues/planning-and-tracking-with-projects) | 开发任务与代码证据联动 | 能把 issues、pull requests、草稿想法放到同一项目，并提供 table / board / roadmap / charts / custom fields。适合作为“开发证据同步层”。 | 更适合代码可见任务，产品、设计、方向判断、评审风险不天然沉淀其中。只能做证据层，不适合做核心产品壳。 |
| Leantime | [官网](https://leantime.io/) / [GitHub](https://github.com/leantime/leantime) | 开源项目管理 / 轻量 PM | 定位为“for the non-project manager”，强调降低 cognitive overload。和学生团队真实状态贴合，适合借鉴“低认知负担、非专业 PM 也能用”的产品语言。 | 它仍是完整 PM 系统，功能面很宽。ProjectFlow 应借鉴 framing，不应复制完整模块。 |
| OpenProject | [官网](https://www.openproject.org/) / [GitHub](https://github.com/opf/openproject) | 开源项目管理 | 可参考成熟开源 PM 的任务、里程碑、进度、文档组织方式，尤其适合后续自托管或开源对照。 | 企业/组织级复杂度明显高于学生项目，权限、里程碑、工作包体系不适合直接搬到 7 天 MVP。 |
| ClickUp Brain / ClickUp PM | [官网](https://clickup.com/brain) / [Project Management](https://clickup.com/teams/project-management) | 全能型协作平台 + AI | 可参考“任务、文档、聊天、目标、AI”合并后的整体叙事，以及 AI 生成子任务、站会总结、项目摘要等能力。 | 功能过多、配置复杂是公开评论中的常见抱怨。ProjectFlow 必须反向克制：强默认流程、少概念、少配置。 |

---

## 2. UI References

| 图片/链接 | 风格关键词 | 可借鉴组件 | 备注 |
|---|---|---|---|
| [Linear Onboarding Flow - Mobbin](https://mobbin.com/explore/flows/64ae582c-747c-4c77-8629-812abcbef186) | 极简、低摩擦、一步一问 | 分步向导、workspace 初始化、默认值选择 | 适合“新建项目向导”。建议把训练营阶段、团队角色、初始想法、是否做 Demo、截止时间分成 4–6 步，而不是一页大表单。 |
| [Notion Onboarding Flow - Mobbin](https://mobbin.com/explore/flows/693f819f-17d0-467f-96d6-890eacb5518e) | 模板化、场景化、空白页减负 | 使用场景选择、模板起步、项目选择入口 | 适合借鉴“先选场景，再建结构”。ProjectFlow 可把“训练营项目 / 科创项目 / 课程项目”做成起步分支。 |
| [Asana Web Task List - Mobbin](https://mobbin.com/screens/2d9f6e18-e7cf-43ce-b0e8-cfda7cab2a1b) | 清爽列表、操作密度适中、信息可扫读 | 列表任务流、快捷增删改、状态标记、动作菜单 | 适合任务拆解页：先让用户看清任务，再逐步展开详情，避免一开始就上复杂图表。 |
| [Trello Web Board - Mobbin](https://mobbin.com/explore/screens/027b1a4d-07e5-41f0-863c-2bc077cd5664) | 轻量、状态分栏、拖拽感强 | To Do / Doing / Done、卡片拖拽、状态看板 | 适合进度跟踪页默认视图。学生团队比起报表，更需要一眼看见“现在卡在哪”。 |
| [TaskFlow Dashboard - Dribbble](https://dribbble.com/shots/27107108-TaskFlow-Project-Management-Dashboard-SaaS-Web-App) | 卡片化、SaaS、概览优先 | 项目概览卡、进度条、截止提醒、资源概览 | 可参考首页“项目健康总览”区域，但只借布局和信息层级，不借花哨装饰。 |
| [Team Members Overview - Dribbble](https://dribbble.com/shots/26790776-Project-Management-Dashboard-Team-Members-Overview) | 团队页、角色清晰、快速扫描 | 成员卡、角色标签、筛选、分配操作区 | 与“个性化任务协调页”匹配，适合展示成员技能、当前负载、推荐任务。 |
| [Web Side Navigation UI - Mobbin](https://mobbin.com/explore/web/ui-elements/side-navigation) | 稳定导航、多层级工作台、二级筛选 | 左侧主导航、顶部筛选、二级内容区 | 适合把信息架构固定为 6 个核心模块：项目启动、方向、任务、协调、进度、风险/调整。不要继续扩。 |
| [Web Skeleton Loading UI - Mobbin](https://mobbin.com/explore/web/ui-elements/skeleton) | 骨架屏、等待态友好、减少跳变 | skeleton 列表、卡片骨架、表格占位 | LLM 生成方向卡、任务树、风险卡时必须有骨架屏，否则“思考中”容易被理解为系统卡住。 |
| [monday.com Task Details - Mobbin](https://mobbin.com/explore/screens/ee568b6b-ff88-406c-bf45-985dbe62e0be) | 任务详情、右侧面板、上下文保留 | 任务详情抽屉、更新区、字段编辑 | 适合任务卡详情页：点击任务后右侧展开，不打断当前任务列表。 |
| [Mobbin Web Dialog UI](https://mobbin.com/explore/web/ui-elements/dialog) | 模态确认、轻量表单、聚焦操作 | 创建任务、确认调整、接受 AI 建议 | 适合“接受调整方案”“确认砍功能”“生成新计划”这类高风险动作。 |

---

## 3. Technical References

| 来源 | 技术点 | 关键结论 | 风险 |
|---|---|---|---|
| [LangGraph Workflows and Agents](https://docs.langchain.com/oss/python/langgraph/workflows-agents) | 多 Agent 编排 / 状态机 | 官方区分 workflow 与 agent：workflow 是预定路径，agent 是动态决策。ProjectFlow 的 6 阶段主链路本质是固定流程，因此应采用 workflow-first，只在方向收敛、协调建议、风险解释等节点引入强推理。 | 如果一开始每个阶段都做成自由 agent，会面临调试困难、状态不可控、输出不稳定。 |
| [OpenAI Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs) | 结构化输出 / JSON Schema | 方向卡、任务卡、风险卡、调整建议都必须走 Schema 约束，否则前端和数据库无法稳定承接。 | Schema 演进需要版本管理和兼容策略，否则老项目数据会断。 |
| [FastAPI](https://fastapi.tiangolo.com/) / [Pydantic](https://pydantic.dev/docs/validation/latest/get-started/) | 类型化 API / 数据校验 | 适合承接 agent 输出对象，请求和响应都能强类型校验，并自动生成 API 文档。可与 tasks / risks / progress_updates 结构自然对齐。 | 如果 LLM schema、后端 schema、前端 schema 三套不一致，会形成维护灾难。 |
| [React Flow](https://reactflow.dev/) | 任务依赖图 / Agent 流程图 | 支持自定义 nodes、edges、minimap、controls、panel，适合做任务依赖图和 agent 状态流图。 | 图编辑交互成本高，不适合作为默认主视图；更适合做“展开看依赖”的辅助视图。 |
| [shadcn/ui](https://ui.shadcn.com/docs/components) | 前端组件基础 | 提供 Sidebar、Data Table、Calendar、Progress、Dialog、Toast、Sheet 等基础组件，可快速搭出项目向导、任务表、风险卡和反馈组件。 | 它不是传统装包即用组件库，而更像组件分发平台。若不先定设计 token，容易越做越散。 |
| [TanStack Query](https://tanstack.com/query/latest/docs/framework/react/overview) | 前端 server-state 管理 | 任务状态更新、风险检查、进度摘要、提醒列表本质都是 server-state。用 Query/Mutation/Invalidation 比手写全局状态稳。 | Query key 和 optimistic update 管不好，会在多人同时改任务时出现 UI 假同步。 |
| [Supabase Realtime](https://supabase.com/docs/guides/realtime) | 轻实时同步 / Presence / 通知 | Broadcast、Presence、Postgres Changes 足够支持任务状态更新、谁刚更新任务、关键状态提醒等轻实时场景。 | MVP 只应服务任务与风险状态，不应第一版做完整聊天系统，否则订阅设计和权限会迅速复杂化。 |
| [GitHub Webhooks](https://docs.github.com/en/webhooks) / [Webhook Events](https://docs.github.com/en/webhooks/webhook-events-and-payloads) | 代码任务同步 / 事件订阅 | 后续可把 commit / PR / issue 拉进来作为“执行证据”。官方建议只订阅自己会处理的事件。 | Payload 有体积上限，且事件噪声高。首版只做可选证据层，不要把所有开发事件都接进来。 |
| [Recharts](https://recharts.org/) | 图表展示 | 适合做进度趋势、风险分布、成员负载图。 | 图表容易变成装饰。首版只保留能指导行动的图：负载、延期、风险等级。 |
| [Next.js](https://nextjs.org/docs) | Web-first 产品框架 | 适合快速实现 Web MVP、页面路由、API 辅助能力、部署到 Vercel。 | 若后端 Agent 逻辑较重，建议拆 FastAPI，不要把复杂 agent 编排塞进前端框架。 |
| [Supabase Auth / Database](https://supabase.com/docs) | 数据库与轻认证 | 对学生团队 MVP 友好，可快速拿到 Postgres、Auth、Realtime。 | 权限模型一旦进入多团队、多组织会复杂。MVP 只做项目级基本访问即可。 |

---

## 4. User Feedback Sources

> 以下为公开评论与讨论样本，用来找抱怨模式和可产品化机会点，不作为严格市场统计。

| 来源 | 用户抱怨 | 高频需求 | 产品机会 |
|---|---|---|---|
| [Reddit r/college：Group project due tonight...](https://www.reddit.com/r/college/comments/1rvro66/group_project_due_tonight_but_other_members/) | 截止前数小时仍然收不到组员内容，消息发了也没人回，项目状态不可见。 | 负责人可见、进度留痕、逾期升级。 | 做“失联 + 逾期”双触发提醒，而不是只有 due date 提醒。 |
| [Reddit r/college：Anyone else hate group projects?](https://www.reddit.com/r/college/comments/z2u6w8/anyone_else_hate_group_projects/) | 经常变成一个人兜底；关键依赖卡在 project lead 时，其他人也被连带阻塞。 | 依赖可见、关键路径可见、谁卡住谁一眼能看见。 | 任务页必须有“依赖任务”“等待他人”“阻塞原因”，否则风险暴露过晚。 |
| [Reddit r/college：Why don't students care about group projects?](https://www.reddit.com/r/college/comments/1go7lek/why_dont_students_care_about_group_projects/) | 问题不只是懒，还有“很难让大家保持同一页面”“能力不足的人会沉默和失联”。 | 小步 check-in、明确求助入口、低心理压力地汇报“我卡住了”。 | 做固定“阻塞更新”表单：卡点、需要谁、截止何时、是否可替代。 |
| [Reddit r/Professors：Problems with group work](https://www.reddit.com/r/Professors/comments/12cgyt1/problems_with_group_work/) | 教师侧常用 team charter：先把任务、角色、截止和异常处理写下来，再让成员确认。 | 团队契约、角色约定、截止规则、失联处理规则。 | 方向卡之后自动生成“团队契约页”，会成为差异化亮点。 |
| [Capterra：Asana Reviews](https://www.capterra.com/p/184581/Asana-PM/) / [App Store：Asana](https://apps.apple.com/us/app/asana-work-management/id489969512?platform=iphone&see-all=reviews) | 任务追踪能力被认可，但通知容易过多；移动端 My Tasks 排序/筛选不稳定。 | 少而准的提醒；跨端一致的“我的任务”。 | 提醒模块应是 digest + escalation，而不是全量推送。 |
| [Capterra：ClickUp Reviews](https://www.capterra.com/p/158833/ClickUp/reviews/) | 上手曲线陡、功能太多、创建任务时不知道放哪里。 | 更少概念、强默认流程、开箱即用。 | 不做自由度无限的大平台；做固定 6 阶段流，减少配置成本。 |
| [Capterra：Notion Reviews](https://www.capterra.com/p/186596/Notion/reviews/) / [Reddit r/Notion](https://www.reddit.com/r/Notion/comments/180xave/i_think_notion_for_most_people_is/) | 空白页和高自由度带来学习成本，任务散落在多个数据库，提醒/分配视图不够统一。 | 一个可信的“我的任务”入口；统一 assigned tasks；更可靠提醒。 | “个人任务 cockpit”必须做成一级页面，而不是数据库过滤器。 |
| [G2：Taskade Reviews](https://www.g2.com/products/taskade-taskade/reviews?page=2) / [Google Play：Taskade](https://play.google.com/store/apps/details?id=com.taskade.mobile) | 易用性和协作评价较高，但也有免费额度受限、移动端/离线依赖不稳的抱怨。 | 基础协作要轻；核心流程不依赖重移动端。 | 首版 Web-first 是对的；移动端最多先做提醒伴随，不做主交互。 |
| [Reddit：Notification overload](https://www.reddit.com/r/productivity/comments/1kycitu/handling_notification_overload/) | 多应用通知过载，用户容易疲劳。 | 合并提醒、优先级提醒、减少碎片打扰。 | ProjectFlow 的提醒应默认合并为日报/黄灯/红灯三层。 |

---

## 5. Raw Ideas

未经筛选的灵感、功能、问题：

- 方向卡生成后，立即产出一页“团队契约”：角色、截止、同步频率、失联处理规则、谁有最终拍板权。
- 每次进度更新都要求勾一个“证据类型”：截图、Demo 链接、文档、GitHub、无证据但说明原因。
- “我的任务”页只保留 4 个区块：今天必须做、等待他人、AI 可辅助、风险中。
- 任务卡必须包含“是否适合 AI 辅助”，否则人 / Agent 分工永远只是口号。
- 方向卡要有版本历史：第 1 版想做什么，为什么缩成现在的 MVP。
- 风险卡不只是等级，而是 4 联字段：为什么有风险 / 影响谁 / 建议怎么调 / 最迟何时处理。
- 做一个“我卡住了”按钮，点开只填 4 项：卡点、已经试过什么、需要谁、还有多少时间。
- 提醒分 3 层：日摘要、黄灯、红灯；默认不发碎片通知。
- 中期评审前自动切成“评审模式”：只显示主链路完成度、缺口、可演示部分、风险。
- “不做清单”必须常驻显示，防止学生团队进入功能膨胀。
- 把“等待他人”做成系统状态，而不是让成员手写在评论里。
- GitHub、日历、飞书/邮件都放到第二阶段以后；首版先把核心协作闭环跑通。
- 任务状态不只做 To Do / Doing / Done，增加 Blocked / Waiting / Need Review。
- 每个成员维护“可投入时间”和“当前负载”，任务分配时用负载条显示，而不是只列负责人。
- Agent 不直接替代队长做决定，而是给出“推荐方案 + 原因 + 可修改字段”。
- 风险判断触发条件可先规则化：关键任务延期、无负责人、依赖未完成、证据缺失、阻塞超过 24 小时。
- Demo 数据要内置一个“关键任务延期”的样例，展示风险判断和动态调整能力。
- 生成“中期评审报告”时，自动从方向卡、任务完成度、风险卡、Demo 链接中组装。
- 把“导师反馈”当成输入，自动转成任务、风险或方向调整建议。
- 首版避免聊天功能，把讨论集中在任务更新和阻塞说明里。
- 新建项目向导应先问“你们现在卡在哪”：方向不清 / 任务混乱 / 分工混乱 / 进度失控 / 评审临近。
- 成员能力录入不要太复杂，用标签 + 自评等级 + 每周可投入小时数即可。
- 风险看板默认按“最晚处理时间”排序，而不是按风险类型排序。
- 动态调整建议应显示“新旧计划对比”，让用户知道改了什么、为什么改。
- 每个任务必须有验收标准，否则“完成”没有判断依据。
- 任务拆解后自动标出“最小 Demo 主链路任务”，防止团队先做边缘功能。
- 方向卡必须包含“不做清单”，并在任务生成时校验任务是否越界。
- 可加入“AI 适配度”标签：适合 Coding Agent / 适合 LLM 写作 / 适合人工判断 / 不建议交给 AI。
- 首页不要做大而全 dashboard，而是做“今日推进面板”：今天要做什么、谁卡住了、哪个风险最急。
- 进度摘要要区分“已完成产出”和“口头进展”，避免虚假进度。
- 支持把训练营阶段作为默认里程碑模板：集中授课、项目孵化、中期评审、迭代展示、结营。
- 任务卡加“依赖解释”：为什么这个任务必须等另一个任务。
- 协调页展示“单点依赖”：某个人一旦延迟，会影响哪些任务。
- 自动建议砍功能时必须说明“保留主链路、砍非核心展示/高级能力”。
- 项目风险不使用复杂雷达图做核心，优先用风险卡列表 + 红黄绿状态。
- 个人任务页需要“我今天只看这一页就能开工”的体验。
- 最终展示前自动生成“Demo 检查清单”：核心链路、数据样例、风险说明、答辩话术、备用方案。

---

# RESEARCH

## 1. 核心判断

综合来看，现有主流产品普遍更擅长把 **项目、任务、issue、状态和 AI 执行** 收进一个工作台，却很少直接解决：

> 学生团队如何从模糊想法收敛成可执行节奏。

而高校 group work 研究与公开学生讨论显示，失败往往来自 coordination costs、communication breakdown、free-riding、time management 和缺少明确结构，而不是单纯没有看板。

ProjectFlow 的项目方案把重点放在“方向确定”和“动态调整”的闭环上，这不是短板，而是市场缝隙。

---

## 2. 重要判断表

| 重要判断 | 研究依据 | 对 ProjectFlow 的直接建议 |
|---|---|---|
| 差异化重点应放在“项目启动器”，而不是“又一个任务记录器” | 现有工具大多围绕 project / task / issue / status 展开，而学生协作失败样本更集中在方向不清、沟通失联、依赖阻塞和责任不明。 | 首页核心不是看板，而是 **新建项目向导 + 方向卡 + 团队契约**。 |
| 强引导比空白页更重要 | 公开评论中，高自由度常常带来高学习成本和任务散落；Leantime 等产品明确定位 non-project manager。 | 固定 6 阶段主流程，顶部导航控制在 6 个核心模块以内，不开放任意自定义数据库。 |
| 个人执行面板必须是一等公民 | “我的任务”跨端不一致、提醒不稳、任务散落，是多个公开样本中的反复抱怨。 | 登录后第一屏优先展示 **我的任务**，团队总览放二级。 |
| 风险判断必须绑定任务、人和时间 | 学生样本里“一人兜底”“lead 卡住大家都停”“组员失联”不是抽象风险，而是具体任务链断裂。 | 风险页不要只做雷达图，必须有风险原因、影响范围、责任对象、调整动作、最迟处理时间。 |
| 提醒机制要“少而狠”，不是“多而全” | 通知过载和多应用消息噪声是公开反馈中的持续主题。 | 只做 3 类提醒：日摘要、黄灯、红灯；默认关闭碎片化推送。 |
| Agent 架构应 workflow-first、schema-first | ProjectFlow 主链路本身是固定阶段；Structured Outputs 能保证输出稳定可执行。 | 把 6 阶段做成受控工作流，每一步返回结构化对象，人可修改，系统再继续往下跑。 |
| GitHub 同步是证据层，不是核心层 | GitHub Projects 对开发任务强，但产品、设计、方向、评审风险不天然沉淀。 | GitHub 集成放 MVP 后，不要让项目价值依赖代码同步。 |
| “团队契约”可能是强差异化功能 | 教师侧 group work 管理常强调 team charter，学生侧问题也集中在角色、责任、失联和截止不明。 | 在方向卡后生成团队契约页，可成为答辩中的亮点。 |
| 任务拆解必须包含验收标准 | 学生项目常见问题不是没有任务，而是任务粗、做完标准不清。 | 任务字段必须包含输出物、验收标准、依赖、风险等级。 |
| 动态调整要展示新旧计划差异 | 用户需要知道 AI 为什么改计划，否则会不信任调整建议。 | 动态调整页必须展示“调整前 / 调整后 / 调整原因 / 影响任务”。 |

---

## 3. 产品机会分析

### 3.1 真正的切口不是“项目管理”，而是“项目推进”

如果把 ProjectFlow 讲成项目管理工具，很容易被 Jira、Asana、Linear、Notion、ClickUp 覆盖。更准确的定位是：

> 面向大学生团队的项目推进 Agent。

这个定位更窄，但更强。它强调的不是“记录任务”，而是解决学生团队最早、最乱、最容易失败的几步：

1. 不知道做什么。
2. 不知道怎么拆。
3. 不知道谁做什么。
4. 不知道哪里卡住。
5. 不知道该不该砍。
6. 不知道下一步怎么推。

这正好对应 ProjectFlow 的六阶段链路。

### 3.2 最小可赢产品不是 dashboard，而是“四件套”

建议把产品核心包装成四件套：

1. **方向卡**  
   定义项目是什么、解决谁的问题、MVP 做什么、不做什么、风险是什么。

2. **团队契约**  
   定义成员角色、可投入时间、同步频率、失联规则、最终决策人。

3. **我的任务**  
   每个人只看自己今天要做什么、等待谁、是否阻塞、是否需要 AI 辅助。

4. **风险调整卡**  
   当项目偏离时，告诉团队为什么有风险、影响谁、怎么调整、最迟何时处理。

这四件套比“大而全项目管理系统”更适合 7 天 MVP，也更容易答辩讲清楚。

---

## 4. 技术可行性评估

## 4.1 推荐技术路线

最稳妥的落地方式是 **Web-first + Workflow-first + Schema-first**。

### 前端

- React / Next.js
- Tailwind CSS
- shadcn/ui
- TanStack Query
- React Flow
- Recharts

### 后端

- FastAPI
- Pydantic
- PostgreSQL / Supabase
- Supabase Realtime 可选
- Redis 可选，首版可不做

### Agent 编排

- LangGraph 或自定义状态机
- 每个阶段固定输入输出
- 所有 LLM 输出走 JSON Schema
- 人可编辑中间结果

### 数据库核心表

- projects
- members
- tasks
- progress_updates
- risks
- adjustments
- reminders

## 4.2 为什么不建议首版做“完全自主 Agent”

ProjectFlow 的主链路是固定的：

> Direction → TaskBreakdown → Coordination → ExecutionTracking → RiskCheck → Adjustment

它更像一个受控工作流，而不是完全开放环境下的 autonomous agent。

因此首版不要追求“Agent 自己想做什么就做什么”，而应追求：

- 每一步输出稳定。
- 每一步可人工确认。
- 每一步可回滚修改。
- 每一步都有结构化数据落库。
- Agent 只在需要判断、解释、生成建议时发挥智能。

这比做“看起来很酷但不可控”的多 Agent 更适合比赛和 Demo。

---

## 5. MVP 优先级建议

## P0：必须做

| 模块 | 必须能力 | 原因 |
|---|---|---|
| 项目创建 | 输入训练营周期、赛道说明、团队成员、初始想法 | 主链路起点 |
| 方向卡 | 生成定位、目标用户、MVP 边界、不做清单、方向风险 | 差异化核心 |
| 任务拆解 | 生成任务表、依赖、验收标准、优先级 | 让方向变成行动 |
| 个性化协调 | 根据成员能力和时间推荐任务 | 解决协调难 |
| 我的任务 | 每人看到今日任务、等待他人、阻塞、风险 | 解决推进慢 |
| 进度更新 | 成员提交进度、证据、阻塞 | 风险判断数据源 |
| 风险判断 | 输出风险类型、等级、原因、影响、建议 | Agent 价值体现 |
| 动态调整 | 新旧计划对比、下一步行动 | 闭环能力 |

## P1：建议做，但可简化

| 模块 | 建议能力 | 简化方式 |
|---|---|---|
| 团队契约 | 角色、失联规则、同步频率、最终拍板权 | 可由方向卡后自动生成 Markdown |
| 依赖图 | 展示任务依赖和阻塞传播 | React Flow 只读图，不做复杂编辑 |
| 评审模式 | 中期/最终展示检查清单 | 用固定模板生成 |
| 日摘要 | 每日进度、风险、明日重点 | 先做站内摘要，不做外部推送 |
| 示例数据 | 内置一个训练营项目样例 | 保证 Demo 稳定 |

## P2：MVP 后再做

| 模块 | 暂缓原因 |
|---|---|
| GitHub 自动同步 | 不是核心差异化，事件噪声高 |
| 日历提醒 | 会带来权限和通知复杂度 |
| 飞书/邮件/Slack 集成 | 对学生团队首版不是必要 |
| 导师视图 | 有价值，但先跑通团队内部闭环 |
| 移动端 App | 交互主场在 Web |
| 高级甘特图 | 不符合“低认知负担”目标 |
| 企业级权限 | 场景不需要，成本高 |

---

## 6. 风险拆解

| 风险 | 表现 | 规避方案 |
|---|---|---|
| 产品范围膨胀 | 想同时做 Notion + Asana + AI Agent + 日历 + GitHub | 坚持四件套：方向卡、团队契约、我的任务、风险调整卡 |
| Agent 输出不稳定 | 任务字段缺失、风险解释散乱、前端无法渲染 | 所有生成结果走 JSON Schema，前端只接结构化对象 |
| 看起来像普通看板 | 评委认为只是 Todo List 加 AI | Demo 必须从“模糊想法”开始，而不是从已有任务开始 |
| 用户不信任 AI 分工 | 觉得 AI 不懂成员真实情况 | 分工建议必须显示原因，并允许人工修改 |
| 风险判断太虚 | 只说“可能延期” | 风险必须绑定任务、负责人、依赖、截止、调整动作 |
| 提醒变打扰 | 高频通知导致用户关闭 | 默认日摘要，只对黄灯/红灯升级提醒 |
| 技术路线过重 | 多 Agent、实时协作、GitHub 同步一起上 | 7 天只做主链路，实时和集成延后 |
| Demo 不稳定 | 现场 LLM 输出慢或失败 | 准备缓存样例数据和固定 fallback 输出 |
| UI 信息过载 | 首页塞满图表和卡片 | 首页只回答：今天做什么、谁卡住、最大风险是什么 |
| 数据模型漂移 | 前端、后端、LLM 输出字段不一致 | 单一 schema 源，Pydantic + TypeScript 类型同步 |

---

## 7. 推荐信息架构

```text
ProjectFlow Agent
├── 0. 项目首页
│   ├── 今日推进
│   ├── 最大风险
│   └── 当前阶段
├── 1. 项目启动
│   ├── 新建项目向导
│   ├── 团队信息
│   └── 训练营阶段
├── 2. 方向卡
│   ├── 项目定位
│   ├── MVP 边界
│   ├── 不做清单
│   └── 方向风险
├── 3. 团队契约
│   ├── 成员角色
│   ├── 可投入时间
│   ├── 同步规则
│   └── 失联处理
├── 4. 任务拆解
│   ├── 任务表
│   ├── 依赖图
│   ├── 验收标准
│   └── AI 适配度
├── 5. 我的任务
│   ├── 今天必须做
│   ├── 等待他人
│   ├── AI 可辅助
│   └── 风险中
├── 6. 进度跟踪
│   ├── 状态更新
│   ├── 证据记录
│   ├── 阻塞列表
│   └── 阶段摘要
└── 7. 风险与调整
    ├── 风险卡
    ├── 调整建议
    ├── 新旧计划对比
    └── 下一步行动
```

---

## 8. 推荐页面设计重点

## 8.1 新建项目向导

不要做一个长表单。建议 5 步：

1. 项目场景：训练营 / 科创 / 课程项目。
2. 当前阶段：方向探索 / MVP 推进 / 中期评审 / 最终展示。
3. 团队信息：人数、角色、技能、可投入时间。
4. 初始想法：项目想法、赛道说明、是否需要 Demo。
5. 约束信息：截止时间、预算、技术栈、已有材料。

输出：方向卡草案。

## 8.2 方向卡页

页面核心字段：

- 一句话定位
- 目标用户
- 核心问题
- MVP 必做
- 当前不做
- 方向风险
- 下一步任务

交互重点：

- 每个字段可编辑。
- 修改后可重新生成任务。
- 不做清单常驻显示。

## 8.3 任务拆解页

默认用表格，不默认用图。

字段：

- 任务名称
- 类型
- 负责人
- 状态
- 优先级
- 截止时间
- 依赖
- 验收标准
- 风险等级
- AI 适配度

依赖图作为右上角“查看依赖”辅助入口。

## 8.4 我的任务页

这是产品最重要页面之一。不要做成普通过滤表，而要做 cockpit。

分区：

1. 今天必须做
2. 等待他人
3. 我卡住了
4. AI 可辅助
5. 风险任务

每张任务卡显示：

- 做什么
- 为什么重要
- 截止时间
- 验收标准
- 下一步最小动作
- 是否需要提交证据

## 8.5 风险与调整页

风险卡字段：

- 风险类型
- 风险等级
- 风险原因
- 影响任务
- 影响成员
- 最晚处理时间
- 调整建议
- 接受 / 修改 / 忽略

动态调整必须展示：

- 调整前计划
- 调整后计划
- 被砍掉的内容
- 被提前的任务
- 新增负责人
- 调整原因

---

## 9. Demo 策略

Demo 不要从“已有项目看板”开始，而要从一个混乱学生团队场景开始：

> 我们是 5 人 AI Agent 训练营团队，有人擅长前端，有人擅长后端，有人熟悉大模型 API，另外两人负责产品和测试。训练营从 4 月下旬到 8 月初。我们想做一个校园通知处理 Agent，但不确定方向是否合适，也不知道任务怎么分。

演示顺序：

1. 输入团队与想法。
2. Agent 生成方向卡。
3. 方向卡指出方向过大，并收敛 MVP。
4. Agent 生成任务拆解和验收标准。
5. Agent 根据成员能力分配任务。
6. 模拟后端接口任务延期。
7. Agent 判断 Demo 风险和依赖风险。
8. Agent 生成调整方案：砍非核心功能、重排任务、转移低依赖任务。
9. 展示新旧计划对比和下一步行动。

这样评委看到的是“推进闭环”，不是普通看板。

---

## 10. 最终建议

ProjectFlow 最有机会赢的点，不是把看板做得更全，而是把：

> 大学生团队如何开始、如何分、如何追、如何识别风险并改计划

做成默认开箱即用的流程。

最佳产品楔子不是企业味很重的项目管理，而是：

> **方向卡 + 团队契约 + 我的任务 + 风险调整卡**

四件套成立后，ProjectFlow 就已经比多数通用 PM 工具更贴近目标场景。

---

# Sources

## Product / Project References

- Taskade AI Project Management Team: https://www.taskade.com/agents/teams/project-management
- Taskade GitHub: https://github.com/taskade/taskade
- Plane AI: https://plane.so/ai
- Plane GitHub: https://github.com/makeplane/plane
- Linear Projects: https://linear.app/docs/projects
- Linear Cycles: https://linear.app/docs/use-cycles
- Motion AI Project Manager: https://www.usemotion.com/features/ai-project-manager.html
- Asana Smart Status: https://help.asana.com/s/article/smart-status
- Asana AI: https://asana.com/product/ai
- Notion Projects and Tasks: https://www.notion.com/help/guides/getting-started-with-projects-and-tasks
- GitHub Projects: https://docs.github.com/en/issues/planning-and-tracking-with-projects
- Leantime: https://leantime.io/
- Leantime GitHub: https://github.com/leantime/leantime
- OpenProject: https://www.openproject.org/
- OpenProject GitHub: https://github.com/opf/openproject
- ClickUp Brain: https://clickup.com/brain

## UI References

- Linear Onboarding Flow - Mobbin: https://mobbin.com/explore/flows/64ae582c-747c-4c77-8629-812abcbef186
- Notion Onboarding Flow - Mobbin: https://mobbin.com/explore/flows/693f819f-17d0-467f-96d6-890eacb5518e
- Asana Web Task List - Mobbin: https://mobbin.com/screens/2d9f6e18-e7cf-43ce-b0e8-cfda7cab2a1b
- Trello Web Board - Mobbin: https://mobbin.com/explore/screens/027b1a4d-07e5-41f0-863c-2bc077cd5664
- TaskFlow Dashboard - Dribbble: https://dribbble.com/shots/27107108-TaskFlow-Project-Management-Dashboard-SaaS-Web-App
- Team Members Overview - Dribbble: https://dribbble.com/shots/26790776-Project-Management-Dashboard-Team-Members-Overview
- Web Side Navigation UI - Mobbin: https://mobbin.com/explore/web/ui-elements/side-navigation
- Web Skeleton Loading UI - Mobbin: https://mobbin.com/explore/web/ui-elements/skeleton
- Web Dialog UI - Mobbin: https://mobbin.com/explore/web/ui-elements/dialog

## Technical References

- LangGraph Workflows and Agents: https://docs.langchain.com/oss/python/langgraph/workflows-agents
- OpenAI Structured Outputs: https://developers.openai.com/api/docs/guides/structured-outputs
- FastAPI: https://fastapi.tiangolo.com/
- Pydantic: https://pydantic.dev/docs/validation/latest/get-started/
- React Flow: https://reactflow.dev/
- shadcn/ui Components: https://ui.shadcn.com/docs/components
- TanStack Query: https://tanstack.com/query/latest/docs/framework/react/overview
- Supabase Realtime: https://supabase.com/docs/guides/realtime
- GitHub Webhooks: https://docs.github.com/en/webhooks
- GitHub Webhook Events and Payloads: https://docs.github.com/en/webhooks/webhook-events-and-payloads
- Recharts: https://recharts.org/
- Next.js Docs: https://nextjs.org/docs
- Supabase Docs: https://supabase.com/docs

## User Feedback / Discussion Sources

- Reddit r/college: Group project due tonight but other members not responding: https://www.reddit.com/r/college/comments/1rvro66/group_project_due_tonight_but_other_members/
- Reddit r/college: Anyone else hate group projects?: https://www.reddit.com/r/college/comments/z2u6w8/anyone_else_hate_group_projects/
- Reddit r/college: Why don't students care about group projects?: https://www.reddit.com/r/college/comments/1go7lek/why_dont_students_care_about_group_projects/
- Reddit r/Professors: Problems with group work: https://www.reddit.com/r/Professors/comments/12cgyt1/problems_with_group_work/
- Capterra Asana Reviews: https://www.capterra.com/p/184581/Asana-PM/
- App Store Asana Reviews: https://apps.apple.com/us/app/asana-work-management/id489969512?platform=iphone&see-all=reviews
- Capterra ClickUp Reviews: https://www.capterra.com/p/158833/ClickUp/reviews/
- Capterra Notion Reviews: https://www.capterra.com/p/186596/Notion/reviews/
- Reddit r/Notion: I think Notion for most people is counter-productive: https://www.reddit.com/r/Notion/comments/180xave/i_think_notion_for_most_people_is/
- Reddit r/Notion: Is Notion enough for managing projects, teams and tasks?: https://www.reddit.com/r/Notion/comments/1mx0jnt/is_notion_enough_for_managing_projects_teams_and/
- G2 Taskade Reviews: https://www.g2.com/products/taskade-taskade/reviews?page=2
- Google Play Taskade: https://play.google.com/store/apps/details?id=com.taskade.mobile
- Reddit r/productivity: Handling notification overload: https://www.reddit.com/r/productivity/comments/1kycitu/handling_notification_overload/

## Academic / Guidance References

- Carnegie Mellon University: Group Projects - Challenges: https://www.cmu.edu/teaching/designteach/design/instructionalstrategies/groupprojects/challenges.html
- University of Colorado Boulder: 6 tips for successful group projects: https://www.colorado.edu/studentlife/2024/02/27/6-tips-successful-group-projects
- University Affairs: Planning for effective skills-building group projects: https://universityaffairs.ca/career-advice/planning-for-effective-skills-building-group-projects/
