# T42 Self-Constraint Gate 自我约束能力设计方案

## 背景

ProjectFlow 的 Agent 会参与方向卡、阶段计划、任务拆解、分工建议、行动卡、风险分析、周期巡检和项目记忆检索。随着 Agent 越来越主动，它不再只是回答问题，还会生成 PulseItem、ActionCard、proposal 草稿、风险升级建议和 check-in 追问。

这带来一个新的问题：Agent 不能只追求“给出建议”，还必须知道自己什么时候证据不足、什么时候越权、什么时候不该打扰用户、什么时候需要人工确认。

如果自我约束只靠一段泛化 prompt，很容易失效。不同场景的边界不同：Project Pulse 关注打扰成本和升级边界，ActionCard 关注是否可执行和是否越权，Risk Pulse 关注证据质量，Replan / Proposal 关注方向、阶段和项目结构影响。它们不应该全部靠同一个宽泛提示词硬扛。

T42 的自我约束能力要做成 Agent 输出前的一道结构化审查层：专业模块先生成候选输出，Self-Constraint Gate 再判断这个候选输出能否按原样呈现、是否需要降级、是否需要追问、是否需要人工确认，或者是否必须阻断。

## 设计目标

1. 在 Agent 输出或产生副作用前，检查是否越过项目边界、阶段边界、权限边界和证据边界。
2. 将自我约束做成结构化机制，而不是依赖更长的 prompt。
3. 按场景使用不同 Check Profile，避免所有输出都跑全量检查。
4. 让高影响动作必须经过 Gate，尤其是对象创建、通知、升级和正式状态修改。
5. Gate 改变输出时，给用户一句轻量解释，不展示完整审查表。
6. Gate 改变输出时，记录短生命周期的 ConstraintTrace，便于解释和避免重复越界。
7. Gate 失败时不允许执行高影响副作用。
8. 与 Project Memory、Project Pulse 保持清晰边界。

## 非目标

V1 不做范围裁决模块。Self-Constraint Gate 不判断一个新想法最终应纳入、延后、驳回还是需要澄清。它只判断当前候选输出或候选动作是否越界、证据是否足够、是否需要确认。

V1 不做第二个 Agent。Gate 不重新做完整业务分析，不生成长篇建议，不直接创建任务、PulseItem、ActionCard 或 proposal。

V1 不做主观聪明度评分。它不评价建议是否足够聪明、创意是否足够好、方案是否最优，只检查硬边界、证据质量和打扰成本。

V1 不展示完整审查表给普通用户。用户只在输出被改变时看到一句原因。

V1 不把 ConstraintTrace 直接写入长期记忆。ConstraintTrace 是运行审计，不是项目记忆。

V1 不覆盖纯 UI 文案、导航提示、按钮反馈、无项目状态影响的帮助问答和历史记录查看。

## 核心原则

Self-Constraint Gate 的位置：

```text
用户请求 / 后台触发
→ 场景 Agent Skill 生成 CandidateOutput
→ Self-Constraint Gate 审查
→ OutputPolicy
→ Renderer / ObjectCreator
→ 最终输出或产品对象
```

硬规则：

```text
No side effect without SelfConstraintGate
```

任何能创建对象、通知成员、升级风险、修改正式状态或影响项目推进路径的动作，都必须先经过 Self-Constraint Gate。

另一条硬规则：

```text
Gate unavailable means no side effects
```

如果 Gate 不可用，高影响动作不能自动执行，只能降级为低风险文本、草稿或人工确认。

## 模块边界

V1 采用四层结构：

```text
Agent Skill
→ CandidateOutput
→ SelfConstraintGate
→ OutputPolicy
→ Renderer / ObjectCreator
```

### Agent Skill

Agent Skill 负责专业判断，不负责最终越权检查。

例如：

```text
Check-in Readiness
Task Progress Patrol
Handoff Patrol
Risk Pulse
Replan Advisor
普通聊天 Agent
```

它们输出结构化候选结果：

```text
CandidateOutput {
  scenario
  intent
  claims
  proposed_actions
  proposed_effects
  affected_entities
  evidence_refs
  confidence
  draft_user_output
}
```

`draft_user_output` 是原始候选文案。它不能直接展示或执行，必须先经过 Gate。

### SelfConstraintGate

SelfConstraintGate 只做审查和策略决定。

输入：

```text
CandidateOutput
ProjectContext
RelevantMemories
CheckProfile
```

输出：

```text
SelfConstraintResult {
  status
  checks
  output_policy
  user_facing_reason
  trace_required
}
```

Gate 不直接创建业务对象，不直接修改业务状态，不直接通知成员。

### OutputPolicy

OutputPolicy 是 Gate 的核心产物。它告诉下游候选输出能以什么方式继续。

```text
OutputPolicy {
  allowed_effects
  blocked_effects
  required_confirmation
  visibility
  delivery_mode
  rewrite_instruction
}
```

示例：

```text
原候选：直接修改任务 deadline
Gate 结果：require_confirmation
OutputPolicy:
  blocked_effects: modify deadline
  allowed_effects: create proposal draft
  required_confirmation: project_owner
  rewrite_instruction: 改成待确认 proposal，不直接执行
```

### Renderer / ObjectCreator

Renderer 负责生成用户可见内容，例如聊天回复、卡片文案、轻量解释。

ObjectCreator 负责创建产品对象，例如 PulseItem、ActionCard、proposal draft、check-in draft。

Renderer 和 ObjectCreator 必须遵守 OutputPolicy，不能绕过 Gate。

## Common Precheck

所有场景都先跑 Common Precheck。它不做价值判断，只负责识别候选输出的类型、影响对象和动作等级，为后续 Check Profile 分流。

识别输出类型：

```text
answer：回答问题
suggestion：提出建议
action：生成行动
proposal：生成提案
question：发起追问
summary：生成摘要
```

识别影响对象：

```text
task
stage
member
risk
direction
mvp_boundary
deadline
owner
assignment
memory
```

识别动作等级：

```text
inform：解释信息
suggest：提出建议，不改状态
ask：向用户追问
create：创建 PulseItem / ActionCard / proposal 草稿
modify：修改任务、阶段、分工、风险等正式状态
escalate：升级给负责人或团队
```

权限边界默认规则：

```text
inform / suggest / ask：大多允许
create：允许创建低风险 PulseItem、ActionCard、proposal 草稿
modify：默认不允许 Agent 直接做，必须人工确认
escalate：P0 或明确规则允许，否则需要确认
```

Common Precheck 还要生成 `proposed_effects`：

```text
proposed_effects {
  creates
  modifies
  notifies
  escalates
  visibility_changes
}
```

Gate 必须看产品影响，而不是只看输出文本。否则无法判断一句话只是建议，还是会触发通知、创建对象或修改状态。

## 检查维度

V1 保留七个检查维度，只管硬边界、证据和打扰成本。

```text
context_sufficiency：上下文是否足够
direction_alignment：是否符合方向卡 / MVP 边界
stage_alignment：是否符合当前阶段目标
authority_boundary：是否越权
memory_consistency：是否和项目记忆冲突
evidence_quality：是否把推测当事实
user_burden：是否过度打扰或生成过多事项
```

每个检查输出统一结构：

```text
ConstraintCheck {
  dimension
  status: pass / warning / violation / unknown
  reason
  evidence_refs
  suggested_action
}
```

状态含义：

```text
pass：通过
warning：有风险，但可以降级输出
violation：不能按原样输出
unknown：缺少必要上下文，不能装作确定
```

## 检查结果聚合

SelfConstraintResult 支持六种结果：

```text
pass：可以直接输出
revise：内部修正后再输出
degrade：降低确定性，改成建议、提醒或观察
ask_clarification：信息不足，先追问
require_confirmation：涉及高影响动作，需要人工确认
blocked：硬条件不足，不能继续
```

聚合规则：

```text
出现 authority_boundary violation → require_confirmation 或 blocked
出现 context_sufficiency unknown → ask_clarification
出现 direction_alignment violation → degrade 或 require_confirmation
出现 stage_alignment violation → degrade
出现 memory_consistency violation → revise，必须引用历史原因
出现 evidence_quality warning → degrade
出现 user_burden warning → 合并、降频或转摘要
全部 pass → pass
```

处理优先级：

```text
能 revise 就 revise
能 degrade 就 degrade
能 ask_clarification 就追问
能 require_confirmation 就转待确认
最后才 blocked
```

自我约束不能变成 Agent 的道歉机器。它应该尽量把输出改成合适的形式，而不是频繁说无法处理。

## 场景化 Check Profile

V1 不做全局七项硬跑，而是按场景启用不同 profile。

```text
Self-Constraint Gate
= Common Precheck
+ Scenario Check Profile
+ Aggregation Policy
```

### 普通聊天建议

检查：

```text
context_sufficiency
memory_consistency
evidence_quality
```

适用范围：

```text
项目建议
Agent 面板解释
任务详情页建议文案
不产生副作用的聊天回答
```

### Project Pulse

检查：

```text
context_sufficiency
authority_boundary
evidence_quality
user_burden
```

重点：

```text
是否证据足够
是否自动打扰了不该打扰的人
是否把弱信号升级成强提醒
是否重复生成 PulseItem
```

### ActionCard

检查：

```text
stage_alignment
authority_boundary
evidence_quality
user_burden
```

重点：

```text
是否符合当前阶段目标
是否可执行
是否暗中改变正式分工
是否给成员增加不必要负担
```

### Risk 分析

检查：

```text
context_sufficiency
memory_consistency
evidence_quality
authority_boundary
```

重点：

```text
是否夸大风险
是否证据足够
是否和已有风险处理结论冲突
是否需要负责人确认后再升级
```

### Replan / Proposal

检查：

```text
direction_alignment
stage_alignment
authority_boundary
memory_consistency
evidence_quality
```

重点：

```text
是否偏离方向卡或 MVP 边界
是否影响阶段目标
是否改变项目结构
是否和历史取舍冲突
是否需要负责人确认
```

## 人工确认边界

V1 将动作分成三层。

### 必须确认

凡是会改变正式项目状态、方向或成员责任的动作，Agent 不能直接执行。

```text
改方向卡
改 MVP 边界
改阶段目标
改任务 owner
改任务 deadline
取消 / 延后任务
调整成员分工
升级风险给全队
创建 replan proposal 并标记为推荐方案
把短期记忆转成长久项目约束
```

处理方式：

```text
require_confirmation
→ 生成 proposal / 待确认项
→ 负责人或相关用户确认后执行
```

### 无需确认

凡是只解释、提醒、草拟或低风险推进，不改变正式状态，可以直接做。

```text
生成普通建议
生成低风险 ActionCard
生成状态追问 PulseItem
生成 check-in 草稿
合并重复提醒
把弱信号放进摘要
引用项目记忆解释原因
```

处理方式：

```text
pass / revise / degrade
→ 直接输出或创建低风险对象
```

### 灰区规则

灰区按三条判断：

```text
1. 是否影响正式项目状态
2. 是否打扰多人
3. 是否涉及个人状态
```

规则：

```text
影响正式项目状态 → require_confirmation
打扰多人 → 至少 degrade，必要时 require_confirmation
涉及个人状态 → 限制可见性，只发本人和负责人
仅作为观察项 → 可以进入摘要，不打扰
```

示例：

```text
提醒负责人关注某成员：
可以，但默认 subject_and_owner，不发全队。

把风险从 P2 提到 P1：
如果只是摘要标记，可以；如果推送多人，需要确认或强证据。

建议下游成员先做 mock / 替代动作：
如果不改变任务状态，可以生成低风险 ActionCard。

创建 proposal 草稿但不推荐：
可以；如果标记为推荐方案，需要确认。

生成“可能需要重排”的观察项：
可以进入摘要，不直接生成 replan。
```

## 用户可见反馈

用户不看完整审查表。只有 Gate 改变输出时，才给一句轻量原因。

可见规则：

```text
pass：不提示
revise：通常不提示
degrade：提示一句为什么降级
ask_clarification：直接把缺口变成追问
require_confirmation：说明为什么需要确认
blocked：说明不能继续的硬原因
```

示例：

```text
degrade：
这个判断缺少任务最新状态，我先把它作为观察项，而不是直接升级为风险。

ask_clarification：
我还缺当前阶段优先级，先确认一下：这轮更看重交付稳定性还是功能完整度？

require_confirmation：
这个建议会影响任务截止时间，所以我不能直接修改，只能生成一个待确认 proposal。

blocked：
当前没有方向卡或阶段目标，无法判断这项建议是否偏离项目范围。
```

内部记录和用户提示分开：

```text
ConstraintTrace：给系统和审计用
UserFacingReason：给用户看的一句话
```

`UserFacingReason` 结构：

```text
UserFacingReason {
  result_status
  message
  related_entities
  action_label
}
```

## ConstraintTrace

ConstraintTrace 是运行审计，不是项目记忆。

写入规则：

```text
pass：不记录
revise：默认不记录，除非修正原因会影响后续判断
degrade：记录
ask_clarification：记录
require_confirmation：记录
blocked：记录
```

结构：

```text
ConstraintTrace {
  id
  project_id
  workspace_id
  agent_run_id
  trigger_type
  scenario
  original_intent
  original_effects
  gate_result
  reasons
  check_results
  affected_entities
  evidence_refs
  user_facing_reason
  linked_pulse_item_id
  linked_proposal_id
  linked_risk_id
  created_at
  expires_at
}
```

默认生命周期：

```text
ConstraintTrace 保留 72 小时
```

例外：

```text
关联 PulseItem → 跟随 PulseItem 生命周期
关联 proposal → 跟随 proposal 生命周期
关联 risk → 跟随 risk 生命周期
关联 AgentRun 且无后续对象 → 72 小时
```

ConstraintTrace 与 ShortTermMemory 的分工：

```text
ConstraintTrace 记录“为什么这次输出被 Gate 改了”
ShortTermMemory 记录“这个原因是否会影响未来几天的判断”
```

只有这类 Trace 才转成 ShortTermMemory：

```text
本轮证据不足，暂不升级风险
本次因阶段目标不清，暂不生成重排建议
本次因成员状态不明，先追问而不是创建行动卡
本次因打扰成本过高，合并提醒
本次因历史取舍冲突，降级为需确认
```

不转短期记忆：

```text
普通缺字段导致追问
一次性格式修正
轻微证据不足但不影响后续
权限边界拦截且已经生成 proposal
```

ConstraintTrace 永远不直接生成 LongTermMemory。

## 与 Project Memory 的关系

Project Memory 提供历史上下文，Self-Constraint Gate 检查候选输出是否违反这些上下文。

`memory_consistency` 默认检查：

```text
active LongTermMemory
unexpired ShortTermMemory
```

默认不检查：

```text
archived LongTermMemory
superseded LongTermMemory
expired ShortTermMemory
```

例外：如果当前问题本身是在问“当初为什么这么做”“以前是不是拒绝过”“这个判断怎么来的”，才检索 archived / superseded 记忆作为历史解释材料。

`memory_consistency` 不负责判断新想法值不值得做，只负责发现冲突。

示例：

```text
候选输出：建议本阶段加入完整数据可视化
active 记忆：本阶段只交付任务协作闭环，数据可视化延后
结果：violation
处理：require_confirmation 或 degrade
```

```text
候选输出：建议小林继续承担 P0 后端任务
active 短期记忆：小林今天只能投入 1 小时，且 22:00 前才可更新
结果：warning
处理：degrade，改为先追问或建议 backup 方案
```

长期记忆图谱里的 `conflicts_with` 边不是一定要阻止输出。

规则：

```text
看到 active conflicts_with → 输出时说明冲突存在，降级为需确认
看到 superseded conflicts_with → 只在解释历史时使用
```

MemoryRetriever 为 Gate 提供：

```text
relevant_active_memories
relevant_short_term_memories
historical_memories_if_requested
```

如果 MemoryRetriever 失败：

```text
普通建议 → degrade，提示未使用项目记忆
高影响动作 → ask_clarification 或 require_confirmation
```

## 与 Project Pulse 的关系

Project Pulse 负责主动巡检和生成“今日待确认”。Self-Constraint Gate 负责在 Pulse 产物写入前审查其证据、权限和打扰成本。

关系：

```text
PulseSignal
→ Pulse 专业模块生成 CandidateOutput
→ SelfConstraintGate
→ OutputPolicy
→ 写入 PulseItem / 合并提醒 / 进入摘要 / 转人工确认
```

Project Pulse 的 fallback 也必须遵守 Gate 失败策略。即使 LLM 不可用，规则 fallback 也不能绕过高影响边界。

例如：

```text
低风险 check-in 逾期提醒 → 可以创建 PulseItem
建议更换 owner → 只能生成 proposal_required 或负责人确认项
升级风险给全队 → 需要强证据或负责人确认
弱信号过多 → 合并为 P1 或进入摘要
```

## V1 接入范围

V1 先管高影响出口，再覆盖普通聊天。

接入优先级：

```text
P0：Project Pulse
P0：ActionCard
P0：Risk Pulse
P1：Replan / Proposal
P2：普通聊天建议
```

V1 必须接入：

```text
创建 PulseItem
创建 ActionCard
创建 / 推荐 Risk 升级
创建 replan proposal
创建 proposal draft
发送或展示主动追问
生成 check-in 深巡检问题
```

V1 可轻量接入：

```text
普通聊天中的项目建议
Agent 面板解释
项目脉搏摘要
任务详情页里的建议文案
```

V1 暂不接入：

```text
纯 UI 文案
普通导航提示
按钮状态反馈
无项目状态影响的帮助问答
历史记录查看
```

## 失败处理与 fallback

Gate 失败时：

```text
SelfConstraintGate 失败
→ 高影响动作默认阻断
→ 低风险文本允许降级输出
→ 可转人工确认，不自动执行副作用
```

失败时允许：

```text
普通解释
低风险建议
展示已有项目状态
展示已有项目记忆
生成不落库的草稿文本
提示“未完成完整约束检查”
```

失败时不允许：

```text
创建 PulseItem
创建 ActionCard
创建 proposal
发送通知
升级风险
修改任务 / 阶段 / 分工 / deadline / owner
写入长期记忆
```

场景降级策略：

```text
Project Pulse：规则 fallback 只能生成低风险提醒；高影响项转负责人确认
ActionCard：不创建新卡，只输出建议文本或进入待确认
Risk Pulse：不升级，只生成观察项
Replan / Proposal：不推荐方案，只生成草稿或要求确认
普通聊天：可以回答，但降低确定性
```

## API 与服务边界

V1 可以把 Self-Constraint Gate 做成内部服务接口，不需要做成普通用户可调用 API。

建议内部接口：

```text
POST /internal/agent/self-constraint/check
GET /projects/{project_id}/constraint-traces
GET /agent-runs/{agent_run_id}/constraint-traces
```

`POST /internal/agent/self-constraint/check` 输入：

```text
candidate_output
project_context
relevant_memories
check_profile
current_user
```

输出：

```text
self_constraint_result
output_policy
constraint_trace
```

`GET /projects/{project_id}/constraint-traces` 只用于负责人、调试视图或后续审计入口。V1 不需要把它做成主要产品页面。

V1 不提供：

```text
手动创建 ConstraintTrace
手动编辑 ConstraintTrace
手动把 ConstraintTrace 转 LongTermMemory
绕过 Gate 创建高影响对象的接口
```

## 执行流程

完整流程：

```text
1. 接收用户请求或后台触发
2. 识别 scenario
3. 选择 Agent Skill
4. Skill 生成 CandidateOutput
5. Common Precheck 识别输出类型、对象、动作等级
6. 选择 CheckProfile
7. MemoryRetriever 提供相关记忆
8. SelfConstraintGate 执行检查
9. 生成 OutputPolicy
10. 必要时写 ConstraintTrace
11. 必要时把 Trace 转 ShortTermMemory
12. Renderer / ObjectCreator 输出最终结果
```

核心要求：

```text
Renderer / ObjectCreator 只能执行 OutputPolicy 允许的 effect
ObjectCreator 创建高影响对象前必须拿到 Gate result
任何 modify / escalate effect 都必须经过 authority_boundary 检查
```

## 示例

### 直接修改截止时间

```text
候选输出：建议直接把 A 任务延期 3 天
检查结果：authority_boundary violation
Gate 结果：require_confirmation
最终输出：生成延期 proposal，由负责人确认
```

### 风险证据不足

```text
候选输出：这个风险已经严重阻塞，需要立刻升级
检查结果：evidence_quality warning
Gate 结果：degrade
最终输出：目前有阻塞迹象，但证据不足以判断严重阻塞，先追问成员补充状态
```

### 超出阶段目标

```text
候选输出：重新做一个完整新功能
检查结果：direction_alignment violation，stage_alignment warning
Gate 结果：require_confirmation
最终输出：这可能超出当前 MVP 和阶段目标，建议先作为后续想法记录，不直接进入当前阶段
```

### 重复打扰成员

```text
候选输出：给同一成员生成 4 个状态追问
检查结果：user_burden warning
Gate 结果：degrade
最终输出：合并成 1 个 P1 提醒，其他弱信号进入摘要
```

## V1 范围

V1 交付的核心能力：

1. 所有高影响对象创建路径都经过 Self-Constraint Gate。
2. CandidateOutput 能描述 claims、evidence、proposed_effects 和 affected_entities。
3. Common Precheck 能识别输出类型、影响对象和动作等级。
4. 五类场景 Check Profile 生效。
5. 七个检查维度有统一 ConstraintCheck 输出。
6. Gate 能返回 pass、revise、degrade、ask_clarification、require_confirmation、blocked。
7. Gate 能生成 OutputPolicy，限制下游 Renderer / ObjectCreator。
8. Gate 改变输出时记录 ConstraintTrace。
9. ConstraintTrace 默认 72 小时过期，永不直接进入 LongTermMemory。
10. 用户只看到轻量原因，不看到完整审查表。
11. Gate 失败时不执行高影响副作用。
12. memory_consistency 只检查 active 长期记忆和未过期短期记忆。

## 后续扩展

后续可以考虑：

1. 更细的场景 Profile，例如评审准备、成员负载、阶段巡检。
2. ConstraintTrace 的负责人审计入口。
3. 约束规则质量评估。
4. 与范围裁决模块联动。
5. 更细的证据评分。
6. 更完整的通知频率策略。
7. 对历史 ConstraintTrace 做趋势分析。

这些都不进入 V1。

## 验收标准

1. Agent 不能绕过 Gate 创建 PulseItem、ActionCard、proposal 或风险升级。
2. 修改 owner、deadline、阶段目标、方向卡、MVP 边界等动作必须转人工确认。
3. 弱证据风险不会被直接升级为强风险。
4. 同一成员不会因为多个弱信号被重复打扰。
5. 与 active 项目记忆冲突的候选输出会被降级、修正或要求确认。
6. Gate 改变输出时，用户能看到一句清楚原因。
7. Gate 改变输出时，系统能记录 ConstraintTrace。
8. ConstraintTrace 不会污染长期记忆。
9. Gate 不可用时，高影响副作用不会执行。
10. 普通低风险回答不会被过度拦截。

## 自检

本方案没有做范围裁决。它只判断候选输出是否能按原样输出或执行。

本方案没有把 Gate 设计成第二个 Agent。Gate 只产出 SelfConstraintResult 和 OutputPolicy。

本方案没有让用户看到完整审查表。用户只在输出改变时看到轻量原因。

本方案没有让 ConstraintTrace 进入长期记忆。长期记忆仍只来自正式项目事件。

本方案没有要求所有场景跑全量七项检查。V1 采用场景化 Check Profile。

本方案没有允许 Gate 失败时执行高影响副作用。
