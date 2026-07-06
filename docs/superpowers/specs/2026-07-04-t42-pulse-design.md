# T42 Project Pulse 周期巡检设计方案

> 本文件基于 2026-07-02 原版设计，根据 3-5 天可实现性评估后修订。
> 修订原则：保留完整巡检核心链条（PulseRun → PulseItem → 信号检测 → 今日待确认），调度层直接采用 V1.1 APScheduler 方案，不再保留旧版自写 loop 路径。

## 背景

ProjectFlow 的核心不是记录任务，而是让学生项目小队持续知道：现在谁该做什么、谁需要同步、哪些协作链路正在断开。当前 Agent 已经能生成方向卡、阶段计划、任务拆解、分工建议、行动卡、风险和重排提案，但这些能力主要依赖用户触发。用户不点按钮时，Agent 不会主动维护项目状态感知。

这会带来一个直接问题：成员登录网站的主要动机是确认自己的任务、分工和推进状态。如果 Agent 只在被触发时分析，成员之间的对接会变慢，负责人也无法及时发现谁需要更新状态。

T42 的目标是补强 Agent 的主动推进底座，让它通过周期性巡检生成可处理的"今日待确认"，而不是只在聊天里输出建议。但巡检不是所有流程的第二套入口：能由任务状态变化、分工回复、check-in 到期或用户操作直接触发的判断，继续由原流程即时处理；Project Pulse 只补齐没有直接触发、触发后未闭环、或需要跨信号综合判断的部分。

## 设计目标

1. Agent 每天只巡检直接触发流程没有覆盖或未闭环的协作断点，例如状态长期未更新、成员可能卡住、依赖等待和负责人需要介入的升级。
2. 巡检产物以待确认处理项和主动追问为主，短摘要为辅。
3. 成员打开项目后，第一眼看到今天自己需要确认、回复或处理的事项。
4. 负责人能看到项目脉搏摘要和需要介入的协作断点。
5. PulseItem 有状态闭环，Agent 能记住"问过什么、谁回了、是否升级、是否过期"。
6. LLM 不可用时仍有规则 fallback，保证基础推进能力不断。

## 非目标（V1.1 不做）

1. **范围裁决模块**：Agent 不判断一个新想法是否纳入 MVP、延后、驳回或需要澄清。
2. **结构性自动变更**：不让 Agent 自动改 owner、取消任务、改截止时间、改阶段目标、改方向卡或改 MVP 边界。这些仍走现有人工确认流程。
3. **PulseItem 替代 ActionCard**：ActionCard 保持现状，PulseItem 作为独立的巡检结果对象。
4. **重复触发已有即时流程**：任务完成后的阶段推进、成员拒绝分工后的协商、check-in 提交后的分析、任务状态变更后的行动卡更新，都优先走现有事件触发链路。
5. **复杂通知中心、历史归档页、批量处理、巡检频率配置、完整后台管理**：V1.1 不做。
6. **负责人审批队列（needs_owner_approval）**：临时协助、放下原任务处理风险、backup owner 接手沟通等高影响建议在 V1.1 只做 auto_send 给负责人本人，不做完整的"负责人审批后分发"流程。V2 再做审批队列。
7. **expired 状态字段**：PulseItem 的过期判断通过查询时根据 `created_at + 冷却周期` 派生，不存储独立 `expires_at` 字段和 `expired` 状态。

## 核心产品机制

T42 引入 Project Pulse，中文可称为"项目脉搏巡检"。它不是长报告，也不是聊天总结，也不是把已有 Agent 能力每天重跑一遍。系统先按事件直接触发能即时完成的判断，巡检只负责补漏。

### 触发分层

T42 采用"直接触发优先，巡检补位"的机制。

直接触发用于已经有明确事件入口的场景。事件发生时立即处理，不等待每日巡检，也不生成重复 PulseItem，除非处理失败、结果长期 pending、或需要后续追问。

直接触发包括：

1. 任务状态变更：例如任务标记 done 后调用 `try_advance_stage()`，任务改为 blocked 后进入现有风险或行动建议流程。
2. 分工回复：成员接受、拒绝或协商分工时，走 AssignmentConfirmation / AssignmentNegotiation。
3. check-in 到期或提交：到期生成本轮 check-in 入口，提交后走 check-in 分析。
4. 行动卡处理：ActionCard 的 done / dismissed / deferred 仍由 ActionCard 自身流程处理。
5. 风险确认或解决：已存在 Risk 的确认、解决和状态变化走风险流程。

巡检补位只处理直接触发无法稳定覆盖的空白：

1. 成员没有提交 check-in、没有回复追问，或回复后没有形成闭环。
2. 任务长期无状态更新，且可能影响依赖成员。
3. blocker 持续存在，或成员表达"卡住"但没有同步更新任务状态。
4. 多个成员的信号指向同一个协作断点，需要合并判断。
5. 已有分工、行动卡、风险或提案长期 pending，需要提醒、摘要或升级。
6. 后台直接触发失败，用户打开项目时需要兜底补跑。

如果同一问题已经有 active ActionCard、Risk 或 AgentProposal，PulseItem 只关联并解释它，不再生成同义的新建议。

巡检结果分三类：

1. 行动项：明确让某个人做一件事。
2. 追问题：信息不足，需要成员补充状态。
3. 摘要项：给负责人或团队看的短状态判断。

巡检产物主入口是"今日待确认"。它放在项目总览和我的任务页顶部，并作为打开项目后的首屏焦点。它不强制跳转、不弹全屏、不锁页面；有 P0 必答追问时，只限制本轮 check-in 完成，不阻止用户浏览项目或更新任务。

Agent 面板不承载主要处理动作。它负责解释为什么出现这些待确认项，展示最近一次项目脉搏摘要和触发信号。

## 巡检节奏

V1.1 使用"每日轻巡检 + check-in 深巡检"，两者均在后台定时运行。

### 后台定时实现

后端启动后在 FastAPI `lifespan` 中创建 APScheduler `AsyncIOScheduler`，运行在当前 asyncio event loop 上。调度器注册低频 job：每小时扫描 due projects、每天 09:00 兜底触发 daily_light，并对 check-in cycle 的 `next_due_date` 做到期扫描。APScheduler 只负责触发 `scan_due_projects()`，真正的巡检、去重、落库和闭环仍由 `PulseRunService` 负责。

实现约束：

- 调度器实例：全局一个 `AsyncIOScheduler`，只在 FastAPI `lifespan` 中创建和启动一次，并把 scheduler handle 挂在 app state 或同等生命周期对象上。
- job 数量：V1.1 固定注册少量 job，不做用户可配置巡检频率。至少包含 hourly due-project scan 和 daily 09:00 daily_light scan。
- job 标识：每个 job 必须有稳定 id，并使用 `replace_existing=True`，避免 reload 或重启后重复注册同义 job。
- job store：V1.1 使用 APScheduler 默认内存 job store；调度定义在启动时重建，业务执行状态由 PulseRun / PulseItem 持久化，不使用 APScheduler SQLAlchemyJobStore 作为事实源。
- job 配置：默认 `coalesce=True`、`max_instances=1`；hourly scan 的 `misfire_grace_time` 建议 30 分钟，daily 09:00 scan 的 `misfire_grace_time` 建议 1 小时，超过窗口后交给下一轮 hourly scan 或页面补跑。
- 时区：scheduler 和 cron trigger 必须显式使用项目时区，当前为 `Asia/Shanghai`，不得依赖服务器本地时区。
- 崩溃恢复：job 内部所有异常必须被捕获并记录日志，不能让单次巡检异常影响后续调度。
- 重载保护：FastAPI `--reload` 模式下只允许实际服务进程启动 scheduler，避免 reload watcher 和子进程重复运行。
- 优雅退出：shutdown 时主动调用 scheduler shutdown；持久化一致性由 PulseRun 状态和 DB 幂等窗口保证。
- 幂等前置：每次运行前先抢 DB lease，拿不到 lease 直接跳过本轮。

## 技术选型调研与确认

### 结论

Project Pulse V1.1 的技术选型确认为：

```text
FastAPI lifespan
+ APScheduler 3.x AsyncIOScheduler
+ SQLite / SQLModel 持久化 PulseRun、PulseItem 和 cooldown 状态
+ 纯 Python deterministic signal detectors
+ 现有 Agent 模块只做解释性增强
```

V1.1 引入的唯一调度依赖是 APScheduler 3.x。它不引入 Celery、Redis、RabbitMQ、Temporal、Prefect、Airflow、Dagster 或通用规则引擎。也不把 Project Pulse 放进 T41 sidecar runtime。Pulse 是 ProjectFlow 后端业务能力，事实源和副作用仍归 FastAPI / DB 管。

这个选择的核心判断是：Project Pulse V1.1 不是分布式工作流系统，也不是数据管道编排系统。它只需要在单个 ProjectFlow 后端进程里周期性扫描项目状态、生成少量 PulseRun / PulseItem，并且在 LLM 不可用时用规则 fallback 保持可用。可靠性不靠外部队列兜底，也不靠 APScheduler 单独保证 exactly-once，而靠数据库里的幂等窗口、cooldown 去重和 run 状态记录兜底。

APScheduler 是 V1.1 的首版调度层，而不是可选增强。它只负责 `PulseScheduler` 的触发层：interval / cron job 到点后调用 `scan_due_projects()`；`PulseRunService`、`PulseSignalDetector`、PulseRun/PulseItem 数据模型和去重逻辑不随之改变。

依赖策略：

```toml
apscheduler>=3.11,<4.0
```

版本固定在 APScheduler 3.x 稳定线。截至 2026-07-05，PyPI 上 APScheduler 3.11.3 是 latest release，4.0.0a6 仍标记为 pre-release，不作为本项目生产依赖。实施时只修改 `backend/pyproject.toml` 增加 APScheduler 3.x，不引入 Redis、RabbitMQ、Celery、SQLAlchemyJobStore 配置或独立 worker。

### 项目约束

本次选型必须服从现有项目技术栈和 T41 边界：

1. 后端是 FastAPI + Python 3.11 + SQLModel + SQLite，本地演示和零配置优先。
2. 当前 `backend/pyproject.toml` 没有 Redis、RabbitMQ、Celery、SQLAlchemy 独立 job store、workflow server 等依赖；V1.1 只允许新增 APScheduler 3.x 作为轻量本地调度库。
3. `main.py` 已经使用 FastAPI `lifespan` 初始化数据库，适合挂载一个可测试、可关闭的 APScheduler `AsyncIOScheduler`。
4. T41 sidecar 负责 Agent runtime loop、tool、skill、policy，不负责业务定时任务，也不直接读写 DB。
5. Pulse V1.1 的所有高影响建议仍必须走 proposal confirmation，不能通过后台任务直接改 Primary Project State。

因此，Pulse 的第一版可以引入 APScheduler 这种本地调度库，但不应该为了“看起来更工程化”引入独立任务队列或工作流服务。真正需要抽象的是 `PulseScheduler`、`PulseRunService`、`PulseSignalDetector` 和幂等写入边界，而不是外部工作流平台。

### 候选项目对比

| 候选 | 适配判断 | 主要原因 |
|---|---|---|
| APScheduler | V1.1 采用 | APScheduler 的 `AsyncIOScheduler` 适合 FastAPI + asyncio 场景，能以 interval / cron / date trigger 替换自写循环，也支持 misfire、coalescing、max_instances、scheduler events 等调度能力。它能让调度层更标准，同时仍保持本地进程、低依赖、低运维成本。 |
| FastAPI lifespan + 自写 asyncio loop | 不作为首版方案 | 这是最轻的兜底实现，但会把 cron、misfire、timezone、job lifecycle 等细节继续留给项目自己维护。既然决定直接做 V1.1，就不再把它作为推荐路径。 |
| Celery + Celery Beat | 不进 V1.1 | 适合分布式后台任务和独立 worker，但需要 broker / result backend，通常是 Redis 或 RabbitMQ。ProjectFlow 当前没有这层基础设施，Pulse V1.1 的任务量也撑不起这套运维成本。 |
| Dramatiq / RQ / Huey | 不进 V1.1 | 比 Celery 轻，但仍引入 worker / broker 或额外队列语义。Pulse V1.1 不需要异步任务吞吐，只需要低频扫描和幂等落库。 |
| Temporal | V2 候选，不进 V1.1 | Temporal 的 durable timers、workflow replay 和 worker 模型适合长周期、高可靠、跨进程的业务流程。对 Project Pulse V1.1 来说，它会把简单巡检变成独立工作流平台，部署和测试成本过高。 |
| Prefect / Dagster / Airflow | 不采用 | 这些更偏数据 pipeline / workflow orchestration。Project Pulse 是产品内协作补位，不是数据平台作业，不需要 UI 编排、DAG 管理或远程 flow deployment。 |
| durable_rules / business-rules / rule-engine | 不进 V1.1 | Pulse 信号规则需要引用 ProjectFlow 的任务、阶段、check-in、风险、分工等强类型业务对象。V1.1 的规则数量少且需要单元测试，直接写 Python detector 更清晰。通用规则引擎适合业务人员动态配置规则，但当前没有这个产品需求。 |
| LangGraph | 不采用 | LangGraph 适合 Agent graph state 和 checkpoint，不适合做应用内周期巡检。T41 已明确不把 LangGraph 作为主 runtime，Pulse 也不应绕过这个架构决策。 |

### 为什么 V1.1 采用 APScheduler

1. **调度语义更标准。** Daily 09:00、hourly scan、check-in due scan 都是典型 interval / cron / one-off 触发，APScheduler 能直接表达，不需要项目继续维护 `while True + sleep` 的细节。
2. **仍然贴合当前部署形态。** APScheduler 作为本地库嵌入 FastAPI 进程，不新增 broker、worker、workflow server、调度 UI，也不修改 `.env` 或 CI/CD。
3. **和 asyncio 匹配。** `AsyncIOScheduler` 可运行在 asyncio event loop 上，默认 executor 支持执行 native coroutine job，适合当前 FastAPI 后端。
4. **失败可接受且可恢复。** 每小时扫描一次，错过一轮不会破坏项目状态；页面打开补跑和手动运行可以兜底。PulseRun 记录 `success / fallback / failed`，下一轮根据 DB 状态判断是否需要补跑。
5. **副作用边界清楚。** scheduler 只触发 `pulse_service.run_patrol(...)`，不直接写业务对象。所有 PulseItem 写入仍在 service transaction 中完成，并遵守 proposal boundary。
6. **可测试性仍然可控。** `PulseSignalDetector` 可以用固定时间和 fixtures 单测；`PulseScheduler` 可以用单轮 scan / fake service 测试；不用模拟 broker、worker 或外部 workflow server。

### 推荐实现形态

V1.1 建议拆成四层，而不是把所有逻辑塞进 `main.py`：

```text
FastAPI lifespan
→ APScheduler AsyncIOScheduler
→ PulseScheduler
→ PulseRunService
→ PulseSignalDetector / Agent module enhancer
→ PulseRun + PulseItem persistence
```

`PulseScheduler` 只负责：

1. 创建并启动 `AsyncIOScheduler`。
2. 配置 scheduler timezone、job_defaults 和 stable job ids。
3. 注册 hourly / daily job。
4. job 触发时调用 `scan_due_projects(now)`。
5. 对 due project 调 `run_patrol(project_id, patrol_type, trigger="scheduled")`。
6. 捕获异常并记录日志。
7. shutdown 时关闭 scheduler。

`PulseRunService` 负责：

1. 创建 PulseRun。
2. 读取 ProjectState / CheckInCycle / AssignmentProposal / ActionCard / Risk。
3. 调用 deterministic detectors。
4. 必要时调用现有 Agent 模块做解释性增强。
5. 去重、合并、分级、写入 PulseItem。
6. 写入 summary 和 status。

`PulseSignalDetector` 负责纯规则检测：

1. `detect_stale_tasks(...)`
2. `detect_missing_checkins(...)`
3. `detect_blockers(...)`
4. `detect_pending_assignments(...)`
5. `detect_overdue_action_cards(...)`
6. `detect_dependency_gaps(...)`
7. `detect_member_capacity_drop(...)`
8. `detect_stage_stall(...)`
9. `detect_unresolved_high_risks(...)`
10. `detect_assumption_violations(...)`

每个 detector 输出 `PulseSignal`，不直接写 DB。这样后续如果要把 scheduler 换成 Celery 或 Temporal，只替换触发层，不重写信号和落库逻辑。

### APScheduler 接入边界

V1.1 的调度形态是：

```text
FastAPI lifespan
+ APScheduler AsyncIOScheduler
+ 每小时 scan_due_projects()
+ PulseRunService.run_patrol(...)
+ DB logical window / cooldown 去重
```

APScheduler 负责的只有"什么时候触发 scan"：

1. 每小时 interval job：扫描 due projects。
2. 每天 09:00 cron job：触发或兜底 daily_light。
3. check-in `next_due_date` 到期：由每小时扫描判断，V1.1 不注册长期 one-off job。
4. shutdown 时调用 scheduler shutdown，并保留 DB run 状态作为恢复依据。

APScheduler 不负责：

1. 判断一个项目是否应该巡检。
2. 保证复杂分布式 exactly-once。
3. 生成 PulseItem。
4. cooldown 去重。
5. 决定是否创建 ActionCard / Risk / AgentProposal。
6. 任何 Primary Project State 变更。

因此，V1.1 的真实改动范围是 `PulseScheduler` 使用 APScheduler `AsyncIOScheduler` 实现触发层。`PulseRunService` / `PulseSignalDetector` / PulseRun / PulseItem / API 都保持独立于调度器。

### APScheduler 配置约定

V1.1 使用最小可控配置，不使用持久 job store：

```text
scheduler = AsyncIOScheduler(
  timezone="Asia/Shanghai",
  job_defaults={
    "coalesce": True,
    "max_instances": 1,
    "misfire_grace_time": 1800
  }
)
```

daily 09:00 job 可以单独设置 `misfire_grace_time=3600`。如果应用在 09:00 后很久才恢复，不追补一串 daily job；下一轮 hourly scan 或页面打开补跑负责发现当天未巡检项目。

固定 job：

```text
pulse_hourly_due_scan_v1
  trigger: interval, hours=1
  replace_existing: true
  max_instances: 1
  coalesce: true

pulse_daily_light_scan_v1
  trigger: cron, hour=9, minute=0, timezone=Asia/Shanghai
  replace_existing: true
  max_instances: 1
  coalesce: true
```

V1.1 不直接为每个 check-in cycle 注册长期 one-off job。check-in deep patrol 由 hourly due-project scan 读取 active check-in cycle 的 `next_due_date` 后触发。这样避免大量动态 job、job 持久化、重启恢复和删除过期 job 的复杂度。

每个 APScheduler job 必须：

1. 自己创建短生命周期 DB session，不能复用 request session。
2. 只调用 `PulseScheduler.scan_due_projects()` 或同层薄封装。
3. 捕获异常并写日志，不让异常冒泡到 scheduler。
4. 对每个项目先拿 DB lease，再进入 `PulseRunService`。
5. 不直接创建 PulseItem、ActionCard、Risk、AgentProposal 或修改任务状态。

### 调度层验收标准

V1.1 的调度层验收不看“有没有准时打印日志”，而看它是否安全触发业务 service：

1. FastAPI lifespan 启动后只存在一个 `AsyncIOScheduler` 实例。
2. 重复执行 scheduler 初始化不会注册重复 job，同名 job 通过 `replace_existing=True` 替换。
3. hourly job 触发时只调用 `scan_due_projects()`，不直接写 PulseItem。
4. daily 09:00 job 使用 `Asia/Shanghai` 时区。
5. job 函数异常不会终止 scheduler，下一轮 job 仍能运行。
6. 同一个 `project_id + patrol_type + run_date` 重复触发时不会生成重复 PulseItem。
7. shutdown 时 scheduler 被关闭，不留下仍在运行的 background task。

### 幂等和多进程风险

APScheduler 嵌入应用进程后的脆弱点是多进程或多副本部署时可能重复触发。V1.1 通过数据库幂等缓解，不靠 scheduler 自己保证 exactly-once。

建议规则：

1. `PulseRun` 增加 logical window 概念，例如 `run_date` + `patrol_type` + `project_id`。
2. 同一 `project_id + patrol_type + run_date` 只允许一个 active / success / fallback run。
3. 手动运行使用独立 trigger，但仍要复用 cooldown 去重，避免重复 PulseItem。
4. `PulseItem` 以 `cooldown_key` 做业务去重，不以 run 次数判断是否重复。
5. scheduler 执行前先查 DB lease；拿不到 lease 就跳过。

SQLite 没有复杂分布式锁语义，所以 V1.1 不承诺跨多实例 exactly-once。它承诺的是：即使重复触发，也不会重复生成同义 PulseItem，不会直接修改 Primary Project State。

### 升级路径

如果后续出现以下任一条件，再升级调度层：

1. 后端需要多 worker / 多实例部署。
2. 巡检任务耗时明显影响 API 响应。
3. 需要任务重试、misfire 管理、持久 job store 或运行历史 UI。
4. 需要把通知、邮件、外部 webhook 等 open-world 副作用纳入队列。
5. Pulse 需要跨天、跨阶段的 durable workflow。

后续升级优先级：

```text
V1.5：Celery/RQ/Dramatiq + Redis（如果需要独立 worker）
V2：Temporal（如果需要 durable workflow / timer / replay）
```

即使升级，`PulseRunService`、`PulseSignalDetector`、PulseRun/PulseItem 数据模型和 API 不应该变化。外部调度系统只替换触发层。

### 每日轻巡检

默认每天 09:00 运行。它关注协作链路是否断开，不做完整项目评审，也不重复重新计算已被直接触发处理的任务、分工、check-in 或风险结果。如果当天 09:00 没跑成功，用户第一次打开项目时异步补跑。

### check-in 深巡检

本质是 check-in 到期事件的兜底与汇总。到期后由 active check-in cycle 的 next_due_date 直接触发；如果到期后未运行，项目打开时异步补跑。它优先生成缺失回复、卡点补充和 check-in 草稿，不重复分析已经提交且完成处理的 check-in。

### 异步补跑与页面加载

页面加载不等待巡检。打开项目时先展示已有项目状态、最近一次 PulseRun 和 active PulseItems；随后后台判断是否需要补跑。补跑完成后刷新"今日待确认"和 Agent 面板摘要。

用户也可手动点击"运行巡检"按钮主动触发一次巡检。

所有巡检日期按项目时区计算。当前项目沿用 Asia/Shanghai。

## 数据对象

### PulseRun

PulseRun 表示一次巡检执行。它用于防重复、记录巡检结果、支撑 Agent 面板显示"上次巡检时间"和短摘要。

字段：

- id
- project_id
- workspace_id
- patrol_type：daily_light / checkin_deep
- status：success / fallback / failed
- summary_status：on_track / watch / needs_action / blocked
- summary_text
- today_focus
- attention_items：string[]
- started_at
- finished_at

### PulseItem

PulseItem 表示巡检生成的一条需要处理、回复、解释或升级的项目脉搏项。它是用户可见、可追踪、可闭环的正式对象。

字段：

- id
- pulse_run_id
- project_id
- workspace_id
- type：action / question / summary / escalation
- priority：P0 / P1 / P2
- status：pending / answered / resolved / deferred / escalated
- audience_type：member / owner / team
- audience_user_id
- source_signal
- delivery_policy：auto_send / proposal_required
- title
- content
- evidence
- expected_response
- response_payload
- linked_task_id
- linked_stage_id
- linked_risk_id
- linked_action_card_id
- cooldown_key
- last_seen_at
- created_at
- updated_at

> 修订说明：`expires_at` 字段和 `expired` 状态在本版中移除。过期的判断通过查询时根据 `created_at + cooldown_key 对应冷却时间` 派生。

PulseItem 不支持 dismiss。它不能无语义消失，只能回答、稍后处理、标记解决或系统自动解决。

### PulseSignal

PulseSignal 是巡检内部使用的候选信号，不持久化。补位规则和专业模块先产出 PulseSignal，再经过合并、分级、分发策略和去重，最终写入 PulseItem。

流程：

```text
collect_project_state()
→ exclude_closed_direct_events()
→ collect_gap_signals()
  ├── 确定性规则信号（check-in 逾期、任务停滞等）
  ├── 行为洞察信号（behavior_insight_service 聚合 4 个指标，作为证据增强）
  └── 假设检验信号（direction_card.assumptions 关键词匹配）
→ merge_signals()
→ classify_priority()
→ apply_delivery_policy()
→ dedupe_by_cooldown_key()
→ persist_pulse_items()
```

合并规则：

```text
同一 project + same audience_user_id + same linked_task_id + same intent
→ 合并为一个 PulseItem
```

intent 可包括 ask_status、ask_blocker、confirm_assignment、remind_action、escalate_to_owner、suggest_handoff_adjustment。

## PulseItem 与 ActionCard 的边界

ActionCard 用于主动推进流程里的可执行行动建议，回答"现在做什么、怎么开始、完成标准是什么"。它的生命周期保持 active → done / dismissed。

PulseItem 用于周期性巡检流程里的协作状态处理，回答"为什么 Agent 现在要打扰这个人、这件事有没有闭环、是否需要升级"。它的生命周期更复杂。

关系：

```text
PulseItem 可以关联 ActionCard
ActionCard 不依赖 PulseItem
```

例如：巡检发现"小林的 P0 后端任务状态不明，影响小陈联调"，可以生成给小林的追问 PulseItem、给负责人的升级 PulseItem，以及给小陈的替代行动 ActionCard。

## 信号库

信号分为直接触发信号和巡检补位信号。直接触发信号不进入每日巡检重复处理，只在结果未闭环、处理失败或需要跨信号综合时作为巡检输入。

直接触发信号：

1. 任务状态变更。
2. 任务完成后的阶段自动推进。
3. 分工提案接受、拒绝或协商。
4. check-in 到期或提交。
5. ActionCard 被处理或延期。
6. Risk 被确认、解决或更新。

每日轻巡检只处理补位信号：

1. P0/P1 任务临近截止但状态长期未更新。
2. 任务状态超过 24 小时无变化，且没有直接事件解释。
3. check-in 逾期未提交或提交后仍缺关键信息。
4. blocker 持续存在，或成员可能卡住但没有同步任务状态。
5. 分工提案长时间未确认。
6. 行动卡过期或长期未完成。
7. 依赖任务未完成，后续任务受到影响。
8. 成员本周期可用时间明显下降，且影响已承诺任务。
9. 当前阶段完成率长期不动。
10. 高风险未处理或被忽略后状态未改善。

### 补位信号判定规则

| # | 信号 | 数据源 | 判断条件 | 阈值 | 产出 PulseItem |
|---|------|--------|---------|------|---------------|
| 1 | P0/P1 任务临近截止但状态长期未更新 | Task.due_date, Task.status, Task.updated_at | due_date 在 3 天内且 status 未变 > 24h | due_date ≤ today + 3 | type=question, priority=P0, audience=owner |
| 2 | 任务状态超过 24 小时无变化 | Task.updated_at, TaskStatusUpdate.created_at | 最近一条 status_update 或 Task.updated_at > 24h 前，且 status ≠ done/cancelled | status 无变化 > 24h | type=question, priority=P1, audience=owner |
| 3 | check-in 逾期未提交 | CheckInCycle.next_due_date, 各成员 CheckInResponse | cycle 状态为 active，next_due_date < today，未提交成员 | next_due_date 超过 today | type=question, priority=P1, audience=member |
| 4 | blocker 持续存在 | Task.status = blocked, Task.updated_at | blocked 状态持续 > 48h，且没有生成对应风险 | blocked > 48h | type=escalation, priority=P0, audience=owner |
| 5 | 分工提案长时间未确认 | AssignmentProposal.status = proposed, created_at | proposed 状态且 created_at > 48h | > 48h 未回复 | type=question, priority=P1, audience=member |
| 6 | 行动卡过期或长期未完成 | ActionCard.status = active, due_date | 有 due_date 且超过 due_date，或无 due_date 且 created_at > 5 天 | 超过 due_date 或 > 5 天 | type=summary, priority=P1, audience=member |
| 7 | 依赖任务未完成 | Task.dependency_ids, task.status | A 依赖 B，B.status ≠ done，且 A 的 due_date ≤ today + 2 | B 未完成且 A 临近截止 | type=escalation, priority=P0, audience=owner |
| 8 | 成员可用时间明显下降 | CheckInResponse.available_hours_next_cycle | 最近一次相比该成员的 MemberProfile.available_hours_per_week 下降 ≥ 40% | 下降 ≥ 40% | type=summary, priority=P1, audience=owner |
| 9 | 当前阶段完成率长期不动 | Task.status, Stage.activated_at | active 阶段中 done 任务比例在 48h 内未增加 | 完成率未变 > 48h | type=summary, priority=P2, audience=owner |
| 10 | 高风险未处理或状态未改善 | Risk.status, Risk.severity, updated_at | severity=high 的 risk 状态为 open/ignored 且 > 72h | severity=high 且 > 72h 未处理 | type=escalation, priority=P0, audience=owner |

阈值说明：以上阈值为 V1.1 默认值，巡检运行时按当前时间计算。

### 行为洞察信号（V1.1 新增）

行为洞察作为确定性信号增强层，在 `collect_gap_signals()` 阶段先运行 4 个 SQL 聚合指标，其结果不会独立生成 PulseItem，而是作为已有信号的**证据增强**：

- **指标 1：check-in 缺失率**
  口径：分子 = N 轮中该成员未提交 check-in 的轮次数，
       分母 = N 轮总应提交数（取 min(最近 5 轮, 该成员应参与轮次)）。
       产出："过去 N 轮缺失率 X%"，作为信号 #3 的证据增强。
- **指标 2：blocker 频率**
  口径：分子 = 该成员 `CheckInResponse.blocker` 非空的次数 +
               `TaskStatusUpdate.blocker` 非空的次数，
       分母 = 该成员 CheckInResponse 总数 + TaskStatusUpdate 总数。
       窗口 = 最近 30 天。产出："blocker 频率 X 次/次更新"，作为信号 #4 的证据增强。
- **指标 3：可用时间趋势**
  口径：取最近 3 轮 check-in 的 `available_hours_next_cycle`，
       若连续下降且最新值 < baseline（`MemberProfile.available_hours_per_week`）的 60%，
       则标记为下降趋势。产出："连续 X 轮下降，当前仅为 baseline 的 Y%"，作为信号 #8 的证据增强。
- **指标 4：任务完成速度**
  口径：对于该成员已完成的任务，计算每项任务从 in_progress→done 的小时数，
       取中位数。对比 `Task.estimated_hours`（如存在）。
       窗口 = 最近 10 个已完成任务。产出："实际完成时间 vs 预估对比"，作为信号 #7/9 的证据增强。

行为洞察不依赖 LLM，不新增 API 端点，不新增数据模型。

### 假设检验信号（V1.1 新增）

假设检验作为 patrol 的一个特殊信号源，在 `collect_gap_signals()` 阶段读取 `Project.direction_card["assumptions"]`：

- 关键词匹配：包含"小时/时间/投入" → 聚合对比 `MemberProfile.available_hours_per_week` + `CheckInResponse.available_hours_next_cycle`
- 关键词匹配：包含"联调/测试/评审/完成" → 查对应阶段/任务的状态和截止日期
- 关键词匹配：包含"代码/编程/开发" → 查成员是否填写了技能（仅检查非空，不判断熟练度）
- 以上都不匹配 → 跳过，不生成信号
- 不依赖 LLM 做假设分类

匹配命中的假设违反 → 生成一条 PulseItem（type=summary，audience_type=owner），关联到 project 级别，不关联特定 task/stage。

check-in 深巡检信号：

1. 成员回复中出现 blocker。
2. 成员可用时间下降。
3. 成员信心低。
4. 成员没有提交 check-in。
5. 任务状态和 check-in 内容冲突。
6. 多人提到同一个阻塞点。
7. P0 任务未按预期推进。
8. 现有行动卡没有被执行。
9. 风险已经持续多轮。
10. 当前阶段目标与已完成任务不匹配。

确定性补位信号由规则直接判断，例如 check-in 逾期未提交、分工长时间未确认、行动卡长期未完成、P0/P1 临近截止且无更新、任务 24 小时无变化、成员可用时间下降。

解释性补位信号交给专业模块分析，例如多人是否提到同一个 blocker、任务状态与 check-in 内容是否冲突、阶段目标与已完成任务是否不匹配、风险是否多轮未改善。

## 专业模块边界

V1.1 专业模块少而稳，且只在巡检补位条件成立后运行。其他信号先用规则 fallback 覆盖。

模块组织方式：专业模块不创建独立文件目录，而是作为现有 agent modules 的方法：

- **Check-in Readiness** → 挂到 `checkin_analysis.py`，新增 `patrol_checkin_readiness()` 方法
- **Task & Dependency Patrol** → 挂到 `active_push.py`，新增 `patrol_task_dependency()` 方法。覆盖任务长期未更新检测和依赖链路断开检测，不做 LLM，纯规则判断
- **Risk Pulse** → 挂到 `risk_analysis.py`，新增 `patrol_risk_pulse()` 方法
- **行为洞察** → 新增 `services/member_behavior_service.py`，纯 SQL 聚合，不涉及 Agent

V1.1 不做深的模块：

- 成员负载深分析
- 评审准备深分析
- 阶段目标匹配分析
- 范围裁决

这些方向的信号保留，但先用基础规则或摘要覆盖。

## 分级与分发策略

巡检敏感度采用平衡型：

```text
P0 快速追问
P1 合并提醒
P2 进入摘要
```

P0 表示如果不立刻补信息，协作链路会断。它自动发给相关成员；到期未回复时，默认升级给负责人。如果存在明确依赖关系，且被影响成员能做出替代行动，再少量提醒被影响成员。

P1 表示今天值得处理，但不应该打断所有人。它合并成每日提醒，每个成员最多一条 P1 汇总。

P2 表示需要被 Agent 记住，但不应该打扰人。它只进入项目脉搏摘要，后续巡检继续观察。

delivery_policy 决定是否自动分发：

- auto_send：追问、状态更新提醒、check-in 提醒、分工确认提醒、依赖对接轻建议。低风险内容直接发送。
- proposal_required：换 owner、改截止时间、取消或延后任务、改阶段计划、改方向卡、改 MVP 边界。走现有 AgentProposal 流程。

> 修订说明：原版的 `needs_owner_approval` 策略在本版 V1.1 中移除。该策略需要完整的"负责人审批队列"基础设施（负责人打开项目看到待审批项 → 同意/拒绝 → 再发送），在 3-5 天窗口内成本过高。V1.1 的应对策略：对于"临时协助""放下原任务处理风险"等场景，PulseItem 以 auto_send 发给负责人本人，由负责人自行决定如何分发。V2 再做审批队列。

V1.1 可以生成 proposal_required 的 PulseItem 作为入口提示，但不直接执行结构性变更。如果同一结构性变更已经存在 pending AgentProposal，PulseItem 只提示和链接该提案，不重复创建新提案。

## 冷却与去重

为避免重复打扰，V1.1 使用 cooldown。

规则：

- P0：同一成员 + 同一任务 + 同一问题，12 小时内不重复追问。
- P1：同一成员每天最多合并提醒 1 次。
- P2：只进摘要，不推送。
- 负责人升级：同一问题 24 小时内最多 1 次。
- 依赖成员提醒：同一依赖链 24 小时内最多 1 次。

如果已有 pending 的 PulseItem 没处理，不生成同类新项，只更新 evidence 和 last_seen_at。

> 实现说明：去重查询为一次数据库查询，同时检查同 `cooldown_key` 的 PulseItem 和同 task/user/type 的 ActionCard，避免两次查询造成的性能和逻辑冗余。状态过滤条件：
> - PulseItem：仅当存在 pending / deferred 状态的同 cooldown_key 项时视为重复，resolved / escalated 的项不影响生成。
> - ActionCard：仅当存在 active 状态的同 task + user + type 项时视为重复，done / dismissed 的项不影响生成。如果 ActionCard 处于 active 但已超过其 due_date，视为可升级替换：关掉旧 ActionCard 并新建 PulseItem priority=P0。

> 修订说明：`expired` 不在 PulseItem.status 中存储。当查询时，如果 PulseItem 的 `created_at + cooldown_key 对应冷却时间 < now`，且状态为 pending/answered/deferred，系统将其视为"已过期"。这种派生方式避免后台定期扫描和额外的过期清理逻辑。

## 今日待确认

"今日待确认"是 Project Pulse 的主要用户入口。

位置：

1. 项目总览顶部：展示项目级和当前用户相关的 P0/P1。
2. 我的任务页顶部：只展示当前用户相关 PulseItem。
3. Agent 面板：展示项目脉搏摘要和解释，不作为主要处理入口。

打开项目后，如果存在 P0/P1 PulseItem，"今日待确认"作为首屏焦点突出显示，但不强制跳转。

排序：

```text
P0 必须处理
→ P1 今日建议处理
→ 分工确认
→ check-in 草稿
→ 普通行动卡
```

数量限制：

- P0 永远显示。
- 最多显示 5 条。
- P1 超过 3 条时合并。
- P2 不进 inbox，只进摘要。

卡片交互保持极简。每张卡只有一个主操作，最多一个次操作。

- 追问卡：回答 / 稍后处理。
- 行动卡：标记已处理 / 稍后处理。
- 分工确认卡：去确认 / 稍后处理。
- 升级卡：查看影响 / 稍后处理。
- check-in 草稿卡：确认提交 / 继续编辑。

卡片正文固定三层：

```text
标题：请确认后端 API 的当前进度
原因：这个 P0 任务 24 小时未更新，且会影响前端联调。
需要你做：回答当前是否卡住，或选择稍后处理。
```

卡片元信息用标签展示，例如 P0、需回复、今天到期、影响 1 人。

## PulseItem 状态闭环

支持状态流转：

```text
pending → answered → resolved
pending → deferred → escalated
pending / deferred → escalated
pending / answered / deferred → resolved（含派生过期）
```

回答用于追问类 PulseItem。稍后处理需要给原因或预计时间。标记已解决用于用户确认问题已经不存在。系统自动解决用于任务完成、阶段结束、分工确认、风险解决或新一轮 check-in 已提交等场景。系统自动解决时，系统通过查询时根据 `created_at + 冷却周期` 派生过期状态，标记为 resolved。

如果用户标记 blocker 已解决，但关联任务仍是 blocked，系统应提示用户同步更新任务状态，或生成轻量追问："是否把任务状态从 blocked 更新为 in_progress？"

## Check-in 汇入机制

Pulse 回复可以汇入 check-in，但只限 check-in 相关追问。

可汇入的 PulseItem：

- 任务状态追问
- blocker 是否解除
- 今天或本周期可投入时间
- 任务是否已经开始
- 当前任务进度说明
- 信心或风险反馈

不汇入 check-in 的 PulseItem：

- 给负责人的升级提醒
- 给下游成员的替代行动建议
- 分工确认提醒
- 负责人确认项
- 风险摘要
- 非个人任务相关建议

汇入方式：PulseItem 的回答（`response_payload`）先整理成 CheckInResponse draft（做了什么、卡点、下周期可用时间、信心），用户确认后再提交 check-in。

## 项目脉搏摘要

摘要不做长报告，不做评分。它是一张短状态提示卡。

固定结构：

```text
状态
一句话判断
今日重点
需要关注
```

状态四档：

- on_track：正常推进
- watch：需要关注
- needs_action：需要处理
- blocked：已阻塞

中文显示：

- 正常推进
- 需要关注
- 需要处理
- 已阻塞

示例：

```text
状态：需要介入
一句话判断：当前阶段的关键链路卡在后端任务状态不明。
今日重点：先确认小林能否完成接口字段。
需要关注：
- 小林有 1 个 P0 追问待回复
- 小陈可以先做接口 mock
- 分工提案还有 1 个未确认
```

摘要来源是 PulseRun.summary_*。LLM 不可用时，规则 fallback 生成基础摘要。

## 失败处理与 fallback

周期性巡检不能完全依赖 LLM。执行链路：

```text
读取项目状态
→ 过滤已由直接触发流程处理且已闭环的信号
→ 确定性规则检测未闭环补位信号（含行为洞察增强和假设检验匹配）
→ 生成基础 PulseSignal
→ 必要时调用专业模块解释、归并和生成自然追问
→ Agent 成功：用 Agent 优化后的 PulseItem
→ Agent 失败：用规则 fallback 生成基础 PulseItem
→ 写入 PulseRun + PulseItem
→ 前端显示今日待确认
```

fallback 至少生成：

- check-in 逾期未提交提醒
- P0/P1 任务临近截止且状态长期未更新提醒
- 任务长时间未更新追问
- 分工提案长时间未确认提醒
- blocker 持续存在提醒
- 行动卡长期未完成提醒

fallback 只能生成 auto_send 的低风险内容，不能生成临时协作安排、换 owner、砍任务、改计划等高影响建议。

## API 边界

V1.1 只做五个核心接口：

```text
POST /projects/{project_id}/pulse-runs/run
GET /projects/{project_id}/pulse
POST /pulse-items/{id}/answer
POST /pulse-items/{id}/defer
POST /pulse-items/{id}/resolve
```

`GET /projects/{project_id}/pulse` 支持 `current_user_id` 参数，用于后端整理 my_items 和 checkin_draft。

返回结构建议：

```text
latest_run
active_items
my_items
owner_items
team_items
checkin_draft
```

V1.1 不做：

- PulseItem 删除
- dismiss
- 完整历史列表
- 批量处理
- 复杂负责人审批流
- PulseItem 转正式 replan 的专门接口
- 巡检频率配置
- 行为洞察独立 API（数据作为信号增强嵌入已有返回）
- 假设检验独立 API（数据作为 summary PulseItem 嵌入）

## 运行策略

后台定时为主，打开项目补跑兜底。

后台通过 FastAPI `lifespan` 启动 APScheduler `AsyncIOScheduler`。调度器注册 hourly scan 和 daily 09:00 job；job 只负责触发 `scan_due_projects()`，每个 due project 再由 `PulseRunService.run_patrol(...)` 执行巡检。

Daily light patrol：

- 默认每天 09:00 运行。
- 如果当天没有 success 或 fallback 的 daily_light PulseRun，用户打开项目时异步补跑。
- 手动刷新不重复生成同类 PulseItem。

Check-in deep patrol：

- 跟随 active check-in cycle 的 next_due_date。
- 到期后后台尝试运行。
- 如果到期后还没运行，项目打开时异步补跑。

异步补跑期间：

- 页面先显示旧状态。
- "今日待确认"先显示已有 active PulseItem。
- 可显示轻提示"正在更新项目脉搏..."。
- 补跑完成后刷新数据。
- 不弹 modal。

## V1.1 范围

V1.1 交付的核心体验：

1. 直接触发流程优先；巡检只补直接触发没有覆盖、处理失败或未闭环的协作断点。
2. 项目有每日轻巡检和 check-in 深巡检，后台定时运行。
3. 巡检会生成 PulseRun 和 PulseItem。
4. "今日待确认"成为项目打开后的首屏焦点。
5. 我的任务页展示当前用户相关 PulseItem。
6. Agent 面板展示短项目脉搏摘要和解释。
7. P0/P1/P2 分级生效。
8. P0 未回复默认升级给负责人；有明确依赖且下游能调整时，少量提醒被影响成员。
9. PulseItem 不支持忽略，必须回答、稍后处理、解决或自动过期。
10. check-in 相关 Pulse 回复可整理成 check-in。
11. LLM 失败时使用规则 fallback。
12. **行为洞察**：4 个确定性 SQL 聚合指标，作为巡检信号的证据增强层，不额外建数据。
13. **假设检验**：方向卡 assumptions 的关键词规则匹配，匹配命中的违反生成 summary PulseItem 给负责人。

## 后续扩展

后续可以考虑：

- 范围裁决模块。
- 负责人审批队列（needs_owner_approval）。
- 成员负载深分析。
- 评审准备深分析。
- 阶段目标匹配分析。
- PulseItem 历史页。
- 巡检频率配置。
- 更完整的通知渠道。
- PulseItem 与 ActionCard 的长期模型统一。
- expired 状态和过期扫描的完整实现。

## 参考资料

- [FastAPI lifespan events](https://fastapi.tiangolo.com/advanced/events/)
- [FastAPI Background Tasks caveat](https://fastapi.tiangolo.com/tutorial/background-tasks/#caveat)
- [APScheduler user guide](https://apscheduler.readthedocs.io/en/3.x/userguide.html)
- [APScheduler AsyncIOScheduler](https://apscheduler.readthedocs.io/en/3.x/modules/schedulers/asyncio.html)
- [APScheduler PyPI release history](https://pypi.org/project/APScheduler/#history)
- [Celery periodic tasks / beat](https://docs.celeryq.dev/en/main/userguide/periodic-tasks.html)
- [Temporal Python SDK durable timers](https://docs.temporal.io/develop/python/workflows/timers)
- [Prefect deployments and schedules](https://docs.prefect.io/v3/concepts/deployments)
- [Dramatiq documentation](https://dramatiq.io/)
- [RQ documentation](https://python-rq.org/)
- [Huey documentation](https://huey.readthedocs.io/)
- [durable_rules GitHub README](https://github.com/jruizgit/rules)
- [business-rules GitHub README](https://github.com/venmo/business-rules)
- [rule-engine documentation](https://zerosteiner.github.io/rule-engine/)

## 自检

本方案没有把 Agent 升级为自动决策者。高影响变更仍需人工确认。

本方案没有让 PulseItem 替代 ActionCard。两者边界独立。

本方案没有让巡检重复已有直接触发流程。任务、分工、check-in、行动卡和风险的即时处理仍由原流程负责。

本方案没有把摘要做成长报告。摘要保持短状态提示卡。

本方案保留完整信号库，但 V1.1 专业模块少而稳，避免一口气扩成通用项目管理系统。
