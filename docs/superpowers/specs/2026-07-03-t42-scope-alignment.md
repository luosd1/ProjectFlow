# T42 Agent 功能补强范围对齐说明

## 结论

当前已设计的三份方案符合 T42 的范围。

它们不是 Agent 底座设计，也不替代 T41。它们是在 T41 提供的新 Agent 底座、tools 和 skill 能力之上，对 ProjectFlow 现有项目管理 Agent 进行功能补强，让 Agent 从“能输出”推进到“可用、好用、稳定”。

## T41 与 T42 的分工

### T41：Agent 底座设计

T41 解决的是 Agent 能力基础设施问题。

范围包括：

```text
通用 agent loop
tool 调用能力
skill 调用能力
上下文装配
执行轨迹
权限与副作用控制
agent runtime / orchestration
```

T41 的目标是让 Agent 不再只是固定模块集合，而是具备可扩展、可组合、可调用工具的通用底座。

### T42：基于新底座的功能补强

T42 解决的是项目管理 Agent 的产品可用性问题。

范围包括：

```text
主动感知项目状态
调用场景化专业分析能力
记住历史决策原因
输出前检查边界和依据
减少误打扰
减少越权动作
提升项目推进体验
```

T42 不重新设计 agent runtime，也不负责通用 tool loop。T42 假设这些能力由 T41 提供，然后在此基础上设计 ProjectFlow 的上层产品能力。

## 当前三份方案与 T42 能力映射

### Project Pulse

文件：

```text
docs/superpowers/specs/2026-07-02-project-pulse-design.md
```

对应 T42 能力：

```text
感知能力
主动巡检能力
专业分析能力的一部分
```

解决的问题：

```text
Agent 不能只等用户触发，而要定期读取任务、分工、check-in、风险、行动卡和协作链路状态，主动生成今日待确认。
```

核心产物：

```text
PulseRun
PulseItem
PulseSignal
每日轻巡检
check-in 深巡检
今日待确认
项目脉搏摘要
```

### Project Memory

文件：

```text
docs/superpowers/specs/2026-07-03-project-memory-design.md
```

对应 T42 能力：

```text
连续记忆能力
```

解决的问题：

```text
Agent 不能只看当前状态，还要记住当初为什么这么决定，哪些历史判断仍然有效，哪些已经被替代。
```

核心产物：

```text
LongTermMemory
ShortTermMemory
长期记忆图谱
正式项目事件抽取
记忆可见性
记忆检索与上下文注入
```

### Self-Constraint Gate

文件：

```text
docs/superpowers/specs/2026-07-03-self-constraint-gate-design.md
```

对应 T42 能力：

```text
自我约束能力
专业分析输出的边界控制
```

解决的问题：

```text
Agent 输出前要检查依据是否足够、是否越权、是否偏离方向或阶段目标、是否和项目记忆冲突、是否过度打扰用户。
```

核心产物：

```text
CandidateOutput
SelfConstraintGate
ConstraintCheck
OutputPolicy
ConstraintTrace
场景化 Check Profile
人工确认边界
```

## 对 T42 五种能力的覆盖情况

T42 原始能力包括：

```text
感知能力
专业分析能力
连续记忆能力
裁决能力
自我约束能力
```

当前三份方案的覆盖情况：

```text
感知能力：Project Pulse 覆盖
连续记忆能力：Project Memory 覆盖
自我约束能力：Self-Constraint Gate 覆盖
专业分析能力：部分覆盖，主要体现在 Pulse 的 Check-in / Task / Handoff / Risk 模块，以及 Gate 的场景化 Check Profile
裁决能力：V1 明确暂不做
```

裁决能力暂不纳入 V1 的原因：

```text
范围裁决涉及方向卡、MVP 边界、阶段目标、资源约束和交付风险的综合判断，误判成本高。当前阶段先补强感知、记忆和自我约束，让 Agent 具备稳定项目意识，再考虑裁决模块。
```

## T42 不做什么

为了避免和 T41 重叠，T42 不做：

```text
不设计通用 agent runtime
不设计底层 tool loop
不设计 skill 调用框架
不设计通用执行编排器
不重写 Agent 底座权限系统
不把固定模块改造成通用 Agent 平台
```

为了控制 V1 范围，T42 当前也不做：

```text
不做范围裁决模块
不做复杂图谱编辑器
不做个人成长报告
不做完整通知中心
不做通用知识库
不让 Agent 自动修改高影响项目状态
```

## T42 依赖 T41 什么

T42 方案落地时需要 T41 提供这些底座能力：

```text
Agent 可以调用 tools
Agent 可以调用场景化 skill
Agent 运行有结构化输入输出
Agent 运行有可追踪 agent_run_id
Agent 可以获取项目上下文
Agent 副作用可以被拦截或转人工确认
Agent 输出可以被后处理为产品对象
```

如果 T41 暂时没有完全提供这些能力，T42 仍可先用现有模块做局部实现，但最终架构应迁移到 T41 底座之上。

## 对外表述建议

汇报时建议这样表述：

```text
T41 负责把 Agent 从固定模块集合升级为可调用 tools 和 skills 的通用底座。

T42 不重复做底座，而是在这个底座之上补强项目管理 Agent 的产品能力。我们当前设计了三块：Project Pulse 让 Agent 主动感知项目状态，Project Memory 让 Agent 记住历史决策原因，Self-Constraint Gate 让 Agent 输出前检查依据、边界、权限和打扰成本。

这三块覆盖了 T42 中优先级最高、最影响可用性的能力：感知、连续记忆和自我约束。专业分析能力先在巡检和风险等场景中局部增强；范围裁决因为复杂度和误判风险较高，暂不纳入 V1。
```

## 自检

本说明没有把 T42 描述成 Agent 底座设计。

本说明明确了 T42 依赖 T41，而不是替代 T41。

本说明把三份已确认方案映射到 T42 的能力目标。

本说明明确了专业分析能力是部分覆盖，裁决能力 V1 暂不覆盖。
