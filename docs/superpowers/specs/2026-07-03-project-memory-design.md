# T42 Project Memory 连续记忆设计方案

## 背景

ProjectFlow 的 Agent 当前已经能围绕方向卡、阶段计划、任务拆解、分工建议、行动卡、风险和巡检产物输出判断。但这些判断如果只依赖当前状态和最近一轮对话，就会出现一个项目管理产品里很致命的问题：Agent 不知道“当初为什么这么做”。

例如，某个任务曾经因为超出 MVP 被延后；某个成员曾经因为本周时间不足被分配轻任务；某个风险曾经被接受而不是继续升级。如果 Agent 之后忘记这些原因，它可能今天建议砍掉 A，明天又建议补回 A，或者反复提出已经被团队拒绝过的方案。

T42 的连续记忆能力要解决的不是“让 Agent 记住更多聊天”，而是让 Agent 拥有项目意识：知道哪些历史判断仍然有效，哪些约束来自正式决策，哪些最近上下文只是临时状态，以及旧判断何时被新判断替代。

## 设计目标

1. 记住历史决策的理由，而不是只保存结论。
2. 区分长期项目约束和短期推进上下文。
3. 防止普通聊天、临时想法和 Agent 猜测污染长期记忆。
4. 让 Agent 能在同类问题上引用过去的取舍理由。
5. 让长期记忆变成可追溯的网状结构，而不是单纯时间线。
6. 所有会影响 Agent 判断的记忆都对用户可见。
7. 旧记忆不能被直接删除，只能失效、归档或被正式新事实替代。
8. Agent 每次只注入相关记忆，避免上下文膨胀。

## 非目标

V1 不做自我约束能力。项目记忆只负责存储、检索和呈现历史上下文，不负责在输出前做方向、阶段、依据或人工确认检查。

V1 不做范围裁决模块。Agent 可以引用项目记忆辅助分析，但不在本模块内判断新想法是纳入、延后、驳回还是需要澄清。

V1 不允许用户手动创建、编辑、删除长期记忆，也不允许用户手动维护长期记忆关系边。

V1 不把普通聊天直接沉淀为长期记忆。普通聊天最多形成短期记忆，只有正式项目事件才可以生成长期记忆。

V1 不做个人成长报告、团队复盘报告、复杂知识库、完整图谱编辑器或记忆训练中心。

V1 不提供“忽略记忆”。记忆不能无语义消失，只能通过正式新事实替代、归档、过期或失效。

## 核心原则

项目记忆采用“事实源 + 系统投影”的结构：

```text
Formal Project Event 是事实源
LongTermMemory 是系统生成的认知索引
ShortTermMemory 是临时推进上下文
Agent Context 是按需检索后的上下文切片
```

长期记忆不由人直接维护。用户如果要改变长期记忆，必须改变正式项目事实，例如修改方向卡、确认新阶段计划、重新确认分工、拒绝 proposal 并填写原因、解决或接受风险。系统再根据新的正式事件抽取、替代、归档旧记忆。

这条边界保证长期记忆保持干净：它不是团队备忘录，不是聊天摘要，不是 Agent 主观猜测，也不是用户临时手写的提示词。

## 总体架构

项目记忆分为两层：

```text
LongTermMemory：长期记忆，轻、稳定、可追溯、网状结构
ShortTermMemory：短期记忆，细、临时、默认 3 天过期
```

整体流向：

```text
正式项目事件
→ 记忆抽取器
→ 长期记忆节点与关系边
→ Agent 按需检索

日常推进信号
→ 短期记忆写入器
→ 3 天内参与 Agent 判断
→ 到期自动失效
```

更完整的运行链路：

```text
DirectionCard / StagePlan / Assignment / Replan / Proposal / Risk
→ FormalEvent
→ MemoryExtractor
→ LongTermMemoryNode + LongTermMemoryEdge
→ MemoryRetriever
→ Agent Context
```

```text
PulseItem response / check-in answer / defer reason / temporary constraint
→ ShortTermMemory
→ MemoryRetriever
→ Agent Context
→ expires_at 到期后自动失效
```

## 事实源

长期记忆只能从正式项目事件生成。V1 的正式事件包括：

1. 方向卡确认。
2. MVP 边界确认。
3. 阶段计划确认。
4. 任务拆解确认。
5. 分工最终确认。
6. replan 确认或拒绝。
7. proposal 拒绝原因。
8. 高风险处理结论。
9. 成员关键约束更新。

正式事件需要满足三个条件：

1. 它改变或确认了项目事实。
2. 它有明确来源对象。
3. 它能被用户在产品中回溯。

普通聊天、一次性问答、按钮成功反馈、Agent 自己的中间分析，都不是正式事件。

## 长期记忆

长期记忆回答的问题是：这个项目有哪些仍然有效的历史判断？

长期记忆采用图结构。每条长期记忆是一个节点，节点之间通过关系边连接。默认展示时可以按主题聚合，但底层不按时间线组织。

### LongTermMemoryNode

字段：

```text
id
project_id
workspace_id
scope: project / stage / task / member / risk
memory_type: direction / boundary / plan / assignment / risk / preference / tradeoff / rejection
content
rationale
source_type
source_id
source_hash
extractor_version
schema_version
status: active / superseded / archived
visibility
subject_user_id
validity_type: persistent / until_stage_end / until_date / until_superseded
valid_until
created_at
updated_at
archived_by
archived_at
archive_reason
```

字段含义：

- `content` 是可被 Agent 引用的结论。
- `rationale` 是当时为什么这么决定。
- `source_type` 和 `source_id` 指向正式项目事件。
- `source_hash` 用于判断事实源是否变化。
- `extractor_version` 用于支持未来重抽取。
- `schema_version` 用于支持记忆结构升级。
- `status` 表示这条记忆当前是否仍然有效。
- `validity_type` 表示这条记忆的生命周期。

### 记忆类型

V1 保留少量稳定类型：

```text
direction：项目方向判断
boundary：MVP 或范围边界
plan：阶段计划与阶段目标
assignment：分工与资源安排
risk：风险处理结论
preference：成员或团队偏好
tradeoff：方案取舍
rejection：被拒绝方案及原因
```

不单独做“summary”类长期记忆。摘要只适合展示，不适合作为 Agent 判断依据。

### 生命周期

长期记忆不是永久有效，也不是统一过期。V1 使用分类型生命周期：

```text
persistent：持续有效，直到被正式新事实替代
until_stage_end：当前阶段结束后失效
until_date：指定日期后失效
until_superseded：直到被新记忆替代
```

默认规则：

```text
方向 / MVP 边界：until_superseded
阶段计划：until_stage_end
任务取舍：until_stage_end 或 until_superseded
分工 / 成员限制：until_date 或 until_superseded
风险处理结论：linked_risk_id 解决或归档后失效
```

长期记忆一般不直接过期。除非它的生命周期明确到期，否则应通过新正式事件替代。

## 长期记忆关系边

长期记忆需要是网状结构，而不是线性列表。V1 的关系边由系统自动生成，不开放人工编辑。

### LongTermMemoryEdge

字段：

```text
id
project_id
from_memory_id
to_memory_id
relation_type: supports / constrains / supersedes / derived_from / conflicts_with
reason
created_at
```

关系类型：

```text
supports：一个记忆支持另一个判断
constrains：一个记忆限制另一个事项的处理方式
supersedes：一个新记忆替代旧记忆
derived_from：一个记忆从另一个记忆或事实推导出来
conflicts_with：两个记忆存在冲突，需要正式事件解决
```

`supersedes` 是特殊关系。创建 `supersedes` 边时，旧节点状态同步改为 `superseded`，不再作为 active 约束注入 Agent。

`conflicts_with` 不代表系统已经裁决。V1 只记录冲突，后续必须通过正式项目事件解决。

## 短期记忆

短期记忆回答的问题是：最近几天有哪些临时情况会影响下一次判断？

短期记忆比长期记忆更具体，但生命周期短。默认保留 3 天。高影响短期记忆可以保留到当前 check-in 周期结束，但不能自动进入长期记忆。

### ShortTermMemory

字段：

```text
id
project_id
workspace_id
trigger
context_snapshot
issue
alternatives
chosen
rationale
related_task_id
related_stage_id
related_member_id
related_pulse_item_id
related_risk_id
visibility
created_at
expires_at
```

字段说明：

- `trigger` 表示触发来源，例如 check-in、分工确认、方向澄清、重排前、PulseItem 回复。
- `context_snapshot` 保存当时的阶段、截止日期、成员负载等轻量上下文。
- `issue` 表示当时讨论或处理的问题。
- `alternatives` 和 `chosen` 可选，只在存在方案取舍时填写。
- `rationale` 必填，避免短期记忆变成无意义日志。
- `expires_at` 默认是创建后 3 天。

短期记忆参考结构：

```text
Decision {
  trigger
  context_snapshot
  alternatives
  chosen
  rationale
  timestamp
}
```

但 V1 不要求所有短期记忆都是 decision。它也可以记录临时约束、延期承诺、未升级原因或降噪原因。

## 写入规则

长期记忆和短期记忆的写入规则必须分开。

### 长期记忆写入

长期记忆只从正式事件写入。写入流程：

```text
FormalEvent created
→ MemoryExtractor 读取事件和关联项目状态
→ 输出候选 LongTermMemoryNode
→ 校验 content、rationale、source_id
→ 生成关系边
→ 写入 active 节点
→ 必要时 supersede 旧节点
```

抽取器必须输出：

```text
content
rationale
source_type
source_id
source_hash
validity_type
visibility
```

缺少来源或理由的候选记忆不入库。

### 短期记忆写入

短期记忆不是每次对话都写。它只在内容会影响未来判断时写入。

必写：

1. 出现临时约束。
2. 多个处理方式中选择了一个。
3. 用户给出延期承诺。
4. 用户说明了暂不升级的原因。
5. 成员回复会影响下一次巡检。
6. PulseItem defer 时给出原因或预计时间。
7. proposal 或 replan 被拒绝且有理由。
8. 高风险暂不升级且有理由。

可写但应合并：

1. 每日巡检多个 P1 信号被合并提醒。
2. check-in 后多个小异常暂不升级。
3. fallback 生效。
4. 同一任务连续状态不明。
5. 重复信号被降噪。

不写：

1. 普通问答。
2. 按钮成功反馈。
3. 例行提醒。
4. 低风险行动卡。
5. 无未来影响的一次性回复。
6. 已被长期记忆覆盖的重复内容。

## 清洁机制

为了保证记忆干净，V1 设置四道闸。

第一道是来源闸。长期记忆只能来自正式项目事件，不能来自普通聊天或 Agent 自己的中间想法。

第二道是抽取闸。抽取器必须生成 `content + rationale + source_id`。没有理由或来源的记忆不入库。

第三道是替代闸。新记忆如果和旧记忆冲突，不能简单并存为两个 active 约束。系统先生成 `conflicts_with`，只有当正式事件明确取代旧判断时，才生成 `supersedes`。

第四道是注入闸。Agent 每次只拿相关记忆，不拿全量记忆。记忆越多，越需要检索和裁剪，而不是扩大上下文。

## 可见性

原则：

```text
凡是会进入 Agent 上下文、影响 Agent 判断的记忆，都必须对用户可见。
```

可见的是结构化记忆，不是聊天原文、内部 prompt 或模型推理链。

V1 可见范围：

```text
team：团队可见
owner_only：负责人可见
subject_and_owner：相关成员本人和负责人可见
private：保留字段，V1 尽量不用
```

默认规则：

```text
方向 / MVP / 阶段 / 任务取舍：team
分工限制 / 成员可用时间 / 个人偏好：subject_and_owner
风险处理结论：team，涉及个人状态则 subject_and_owner
proposal 拒绝原因：team 或 owner_only
短期临时项目约束：team
defer 承诺：subject_and_owner
未升级原因：owner_only 或 team
巡检合并 / 降噪原因：owner_only
```

如果一条记忆的可见性不足以让当前用户查看，它也不能被注入到这个用户触发的 Agent 上下文中，除非输出不会泄露该记忆内容。

## 记忆检索与上下文注入

Agent 不读取全部项目记忆。每次运行前，系统先识别当前场景，再检索相关记忆。

检索输入：

```text
project_id
current_user_id
current_stage_id
task_id
member_id
risk_id
intent
visible_scope
```

检索流程：

```text
识别当前意图、阶段、任务、成员、风险
→ 检索相关 LongTermMemoryNode
→ 扩展 1 跳关系
→ 过滤非 active 或不可见记忆
→ 选择 6-8 条长期记忆
→ 选择最多 5 条短期记忆
→ 按固定顺序注入 Agent 上下文
```

注入顺序：

```text
方向与 MVP 边界
当前阶段目标
相关历史取舍
成员 / 资源约束
短期临时上下文
冲突、替代、失效记录
```

长期记忆优先级：

1. 与当前任务、阶段、成员、风险直接关联。
2. `memory_type` 是 direction、boundary、plan、tradeoff、rejection。
3. 与当前问题存在 `constrains` 或 `conflicts_with` 关系。
4. 仍为 active 状态。
5. 来源更新，且没有被 supersede。

短期记忆优先级：

1. 与当前任务或成员直接关联。
2. P0 或高影响事项。
3. 最近创建。
4. 距离过期时间近。
5. 与当前 PulseItem 或 check-in cycle 相关。

## 产品入口

项目内增加一个轻量“项目记忆”入口。它不是编辑器，而是可见性和可追溯入口。

页面分两个 tab：

```text
长期记忆
短期记忆
```

长期记忆默认按主题聚合，而不是按时间排序：

```text
方向与边界
阶段计划
任务取舍
分工与资源
风险处理
被替代的历史判断
```

每条长期记忆展示：

```text
结论
理由
来源
状态
有效期
关联对象
关系提示
```

短期记忆按关联对象和过期时间展示：

```text
最近临时约束
延期承诺
未升级原因
巡检降噪记录
check-in 相关上下文
```

短期记忆需要清楚显示 `expires_at`，让用户知道哪些内容只会短期影响 Agent。

Agent 生成重要建议时，可以显示“参考了 X 条项目记忆”。用户可以点开查看结构化记忆列表。

## API 边界

V1 只需要支持记忆读取、抽取触发和后台维护，不提供人工编辑长期记忆接口。

建议接口：

```text
GET /projects/{project_id}/memories
GET /projects/{project_id}/memories/context
POST /projects/{project_id}/memories/extract
POST /projects/{project_id}/memories/rebuild
POST /short-term-memories/{id}/archive
```

说明：

- `GET /projects/{project_id}/memories` 用于项目记忆页面。
- `GET /projects/{project_id}/memories/context` 用于 Agent 运行前检索上下文。
- `POST /projects/{project_id}/memories/extract` 由正式事件触发，不作为普通用户入口。
- `POST /projects/{project_id}/memories/rebuild` 用于系统升级抽取器后重建项目记忆。
- `POST /short-term-memories/{id}/archive` 只用于提前归档明显过期的短期记忆，不用于长期记忆。

V1 不提供：

```text
POST /long-term-memories
PATCH /long-term-memories/{id}
DELETE /long-term-memories/{id}
POST /long-term-memory-edges
PATCH /long-term-memory-edges/{id}
DELETE /long-term-memory-edges/{id}
```

长期记忆的变化只能来自正式事件、系统抽取、系统重建和生命周期规则。

## 失败处理

如果长期记忆抽取失败，不阻塞正式项目事件本身。系统记录失败状态并允许后台重试。

如果抽取器输出缺少来源、理由或生命周期，不写入长期记忆，并记录为 extractor validation failed。

如果生成关系边失败，节点可以先写入，但需要标记 `edge_status: pending`，由后台补建关系。

如果记忆检索失败，Agent 可以降级为只读取当前项目状态，但输出中需要标记“未使用项目记忆”。

如果发现 active 记忆冲突，V1 不自动裁决。系统展示冲突，等待后续正式事件解决。

如果系统重建记忆失败，旧记忆继续有效，不切换到半成品结果。

## 数据重建与版本化

长期记忆需要支持机制升级。V1 每条长期记忆都记录：

```text
source_hash
extractor_version
schema_version
```

当抽取器升级时，系统可以基于正式事件重新抽取记忆。重建流程不直接覆盖旧记忆，而是先生成新版本候选：

```text
读取 FormalEvent
→ 使用新 extractor_version 重新抽取
→ 对比旧 LongTermMemoryNode
→ 未变化则保留
→ 语义变化则创建新节点并 supersede 旧节点
→ 关系边重建
→ 原子切换
```

这保证系统可以不断改进存储机制，同时不破坏记忆的可追溯性。

## 与 Project Pulse 的关系

Project Pulse 负责主动巡检和生成“今日待确认”。Project Memory 负责记住历史原因和临时上下文。

两者关系：

```text
PulseItem 可以产生 ShortTermMemory
PulseRun 摘要不直接进入 LongTermMemory
PulseItem 的处理结果如果形成正式项目事件，才可能生成 LongTermMemory
Project Memory 可以被 Pulse 巡检读取，用于避免重复追问和重复建议
```

例如，巡检发现某个任务状态不明，成员回复“今晚 22:00 前补接口字段，因为今天白天上课”。这可以形成短期记忆，默认 3 天内参与判断。

如果负责人随后正式调整任务截止时间或确认分工变化，这个正式事件才会生成长期记忆。

## V1 范围

V1 交付的核心体验：

1. 项目有长期记忆和短期记忆两层。
2. 长期记忆只从正式项目事件自动生成。
3. 长期记忆以图结构保存节点和关系边。
4. 用户不能手动创建、编辑、删除长期记忆。
5. 短期记忆默认 3 天过期。
6. 短期记忆只记录会影响未来判断的临时上下文。
7. Agent 运行前按场景检索 6-8 条长期记忆和最多 5 条短期记忆。
8. 所有影响 Agent 判断的记忆都有结构化可见入口。
9. 新正式事件可以让旧长期记忆 superseded。
10. 抽取器和 schema 支持版本化重建。

## 后续扩展

后续可以考虑：

1. 更细的记忆检索评分。
2. 长期记忆冲突解决流程。
3. 记忆质量评估。
4. 按阶段生成记忆审计摘要。
5. 更完整的记忆重建后台任务。
6. 与范围裁决模块联动。
7. 与自我约束能力联动。

这些都不进入 V1。

## 验收标准

1. 用户能在项目内看到 Agent 可引用的长期记忆和短期记忆。
2. 长期记忆不能被人工直接创建、编辑或删除。
3. 普通聊天不会污染长期记忆。
4. 长期记忆都有来源、理由、状态和生命周期。
5. 旧决策被新正式决策替代后，旧记忆不再作为 active 约束。
6. Agent 在同类问题上能引用过去的取舍理由。
7. 短期记忆默认 3 天后失效，不撑爆上下文。
8. 成员相关记忆有可见性边界。
9. 记忆抽取失败不会阻塞正式项目流程。
10. 抽取器升级后可以基于正式事件重建记忆。

## 自检

本方案没有把项目记忆做成聊天历史或知识库。长期记忆只来自正式项目事件。

本方案没有开放人工维护长期记忆。用户通过改变事实源来改变长期记忆。

本方案没有引入自我约束能力。输出前检查、人工确认判断和阶段边界检查会在后续方案中单独设计。

本方案没有把 Project Pulse 的摘要直接沉淀为长期记忆。Pulse 只能产生短期上下文，或通过正式项目事件间接产生长期记忆。

本方案没有把图谱复杂度暴露给用户。用户看到的是按主题聚合的结构化记忆，底层关系边由系统维护。
