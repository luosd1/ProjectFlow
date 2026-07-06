# ProjectFlow Agent 自我约束能力 V1.5 设计方案

版本：V1.5  
日期：2026-07-05  
关联原始方案：`docs/superpowers/specs/2026-07-04-t42-self-constraint-gate-design-v2.md`

## 1. 背景

ProjectFlow 是面向项目协作的主动推进型 AI Agent 系统。当前 MVP 已经完成，Agent 已经参与项目建议、任务拆解、阶段规划、Proposal 生成、ActionCard 生成、风险分析、项目记忆检索等流程。

MVP 阶段的核心目标是跑通主动推进闭环。进入 MVP 后增强阶段后，新的问题不是“Agent 能不能给建议”，而是“Agent 什么时候不能直接行动”。ProjectFlow 的 Agent 已经能够影响项目对象、成员责任、任务节奏和风险呈现，因此需要在输出或副作用发生前增加一个可测试、可解释、低侵入的自我约束层。

原始 T42 方案提出了 Self-Constraint Gate 的完整方向，但包含 ConstraintTrace 独立化、Project Memory、Project Pulse、Risk Pulse、外部策略引擎等较重内容。V1.5 的定位是：比 MVP 更可信，但不进入完整治理系统。

## 2. 为什么需要自我约束能力

ProjectFlow 的 Agent 当前会生成不同影响级别的内容：

| 输出类型 | 影响级别 | 风险 |
|---|---:|---|
| 普通项目建议、解释文案、摘要 | 低 | 证据不足时可能误导用户 |
| Proposal、Replan Proposal | 高 | 可能改变方向、阶段、任务边界 |
| ActionCard | 中到高 | 可能引导成员执行错误下一步 |
| 风险升级、多人通知 | 高 | 可能制造不必要的团队压力 |
| owner、deadline、阶段目标调整 | 高 | 直接改变项目事实或责任 |

自我约束能力要解决的是：Agent 在足够主动之前，先确认自己是否有权、是否有证据、是否正在改变正式项目结构。V1.5 不追求覆盖所有治理问题，只覆盖项目协作中的业务副作用边界。

## 3. 为什么不能只靠 prompt

Prompt 可以提醒 Agent “不要越权”，但不能作为最终控制面。原因如下：

1. Prompt 不是强制执行层。模型仍可能输出“我已经帮你延期了”这类越权表述。
2. Prompt 难以单元测试。不能稳定断言某个候选输出一定被降级、确认或阻断。
3. Prompt 与场景耦合。普通建议、风险升级、ActionCard、Replan 的边界不同，不能靠一段统一提示词覆盖。
4. Prompt 无法约束 service 层。即使模型文本合规，下游持久化逻辑仍可能直接创建对象。
5. Prompt 无法 fail-closed。LLM 或解析失败时，高影响动作必须默认不执行。

因此 V1.5 的核心不是“写更长的约束 prompt”，而是在 `AgentRunResult` 之后、service 层副作用之前加入结构化 Gate。

## 4. 为什么不能直接上重型治理框架

ProjectFlow 当前的问题不是企业级权限治理，也不是通用聊天安全，而是项目业务副作用控制。典型副作用包括修改 deadline、owner、方向卡、MVP 边界、阶段目标、升级风险、通知全队。

| 方案 | 当前不作为主路径的原因 |
|---|---|
| Microsoft Agent Governance Toolkit | 适合更完整的 Agent 治理、策略执行、身份、沙箱和审计。当前 ProjectFlow 只需要少量确定性业务规则，引入会增加概念和依赖重量。 |
| OPA | 是通用 policy-as-code 引擎，适合跨服务、基础设施、API 网关等统一策略。V1.5 的规则数量少，用 Python 函数更直接。 |
| Casbin | 强项是 `{subject, object, action}` 授权模型和 RBAC/ABAC。ProjectFlow 的核心不是“谁能访问什么”，而是“Agent 产出的 effect 是否会改变项目结构”。 |
| Guardrails AI | 适合 LLM 输出校验、重问、验证器组合。ProjectFlow 已经用 Pydantic，结构化输出层优先用 Instructor；业务副作用仍需自研规则。 |
| NeMo Guardrails | 偏 LLM 对话流程、话题、安全策略和可编程 conversational guardrails。V1.5 不需要引入新的对话状态机。 |

V1.5 的判断：业务规则自研，结构化输出借助轻量开源库，外部治理框架作为 V2 候选。

## 5. V1.5 设计目标

| 目标 | 说明 |
|---|---|
| 真实自我约束 | Agent 不能直接把高影响动作写入项目事实。 |
| 保持轻量 | 不做第二个 Agent，不做独立审计系统，不做复杂策略引擎。 |
| 副作用前判断 | Gate 位于候选输出之后、service 层持久化之前。 |
| 高影响动作确认 | 涉及正式项目状态、成员责任、方向结构的 effect 必须转人工确认或 Proposal。 |
| 证据不足降级 | 证据不足时改为观察、建议、追问或确认，不伪装确定。 |
| 可单元测试 | 以确定性规则为主，不用 LLM-as-a-judge 作为 V1.5 主路径。 |
| 兼容现有后端 | 保留 FastAPI、SQLModel、Pydantic、CoordinatorAgent、AgentEvent、AgentProposal 路径。 |
| 开源适度接入 | Instructor 和 Pydantic 解决结构化输出，不把治理外包给通用框架。 |

## 6. 技术选型调研与确认

### 6.1 结论

Self-Constraint Gate V1.5 的技术选型确认为：

```text
Pydantic 模型
+ ProjectFlow 自研 rule-based Gate
+ Python 函数式 policy checks
+ Instructor 作为 LLM 结构化输出适配层
+ AgentEvent 复用为轻量 ConstraintTrace
```

V1.5 不接入 Microsoft Agent Governance Toolkit、OPA、Casbin、Guardrails AI、NeMo Guardrails、Presidio、Llama Guard 或 LLM-as-a-judge 作为主路径。它们要么解决的是企业级 agent runtime governance，要么解决的是通用授权、对话安全、PII 脱敏或模型安全分类；ProjectFlow 当前要解决的是更窄的业务副作用边界：Agent 产出的 effect 是否会改变项目结构、责任、日期、方向、通知范围，以及证据是否足够支撑这个 effect。

最小正确路径是：把 Agent 输出先归一化为 `CandidateOutput`，由确定性检查生成 `OutputPolicy`，service 层只执行 `allowed_effects`。结构化输出可以借助 Instructor，但最终业务裁决必须由 ProjectFlow 自己的 Python 规则完成。

### 6.2 项目约束

本次选型必须服从现有后端和 T41 边界：

1. 后端已经使用 Python 3.11、FastAPI、Pydantic、SQLModel，Agent 输出 schema 也已经是 Pydantic 模型。
2. 当前 `backend/pyproject.toml` 还没有治理框架、OPA server、Casbin adapter、Guardrails runtime 或 Presidio 依赖。
3. T41 已经把 policy gate 放在 sidecar tool execution 层，但 T42 V1.5 要先覆盖旧 Coordinator / service path 的业务副作用出口。
4. Proposal Confirmation 仍是当前唯一的人类确认业务边界，Gate 不能引入 ToolExecutionApproval 或第二套审批状态机。
5. Gate 必须 fail-closed，且必须能用普通单元测试稳定验证；不能依赖另一个 LLM 判断是否安全。

因此，V1.5 不应该引入外部策略 DSL 或对话 guardrail runtime。ProjectFlow 的业务 effect 类型少、边界明确，用 Python 函数和 Pydantic 模型最直接，也最容易和现有 `agent_flow_service` 接起来。

### 6.3 候选项目对比

| 候选 | 适配判断 | 主要原因 |
|---|---|---|
| Pydantic | V1.5 采用 | ProjectFlow 已经依赖 Pydantic。`CandidateOutput`、`ProposedEffect`、`ConstraintCheck`、`OutputPolicy` 都是明确数据结构，适合继续用 Pydantic 做类型约束、校验、序列化和测试 fixture。 |
| Instructor | V1.5 采用，但只做结构化输出适配层 | Instructor 基于 Pydantic 做 LLM structured output、retry/reask 和 provider 适配，能减少当前 `str → json.loads → repair → validate` 的脆弱链路。但它只解决“拿到结构化对象”，不负责业务权限裁决。 |
| ProjectFlow rule-based Gate | V1.5 主实现 | authority、evidence、direction alignment 都是 ProjectFlow 领域规则。直接用 Python 函数实现，成本低、可测试、可 fail-closed，并能复用现有 schema 和 service。 |
| Microsoft Agent Governance Toolkit | V2 候选，不进 V1.5 | AGT 面向更完整的 agent runtime governance，包括 policy enforcement、identity、sandboxing、reliability 和多语言集成。方向有参考价值，但对当前少量 ProjectFlow effect 规则过重，并且会和 T41 sidecar policy 形成概念重叠。 |
| OPA / Rego | V2 候选，不进 V1.5 | OPA 适合跨服务、平台级 policy-as-code 和集中化治理。V1.5 规则数量少，且规则强依赖 Python 领域对象和现有 service，上 Rego 会引入 DSL、测试夹层和部署复杂度。 |
| Casbin | 不进 V1.5 | Casbin 强项是 RBAC/ABAC/ReBAC 等访问控制。ProjectFlow 这里不是判断“用户 X 是否能访问对象 Y”，而是判断“Agent effect 是否必须转 proposal / 降级 / 阻断”。 |
| Guardrails AI | 不进 V1.5 | Guardrails 更适合 LLM output validation、validator hub、reask 和内容质量检查。ProjectFlow 已有 Pydantic + Instructor 路线，业务副作用仍需要自研 Gate。 |
| NeMo Guardrails | 不进 V1.5 | NeMo 偏对话输入/输出、话题、流程和安全 rails，需要新的 guardrail 配置与对话控制模型。V1.5 不重构对话状态机。 |
| Microsoft Presidio | 后续隐私工具候选，不进 V1.5 | Presidio 适合 PII 检测和脱敏。Self-Constraint Gate 当前不是隐私脱敏模块，且 ProjectFlow 的主要风险是高影响项目副作用。 |
| Llama Guard / LLM-as-a-judge | 不进 V1.5 | 适合内容安全或模糊语义评估，但 V1.5 需要确定性、可单测、可解释的业务边界。LLM 判断只能作为 V2 辅助信号，不能作为唯一裁决。 |

### 6.4 为什么选择 Pydantic + 自研 Gate + Instructor

1. **与现有技术栈最贴合。** 后端已经用 Pydantic 定义 API / Agent schema。新增 `CandidateOutput`、`ConstraintCheck` 和 `OutputPolicy` 不需要引入新运行时。
2. **业务规则比通用治理更窄。** V1.5 只判断少量 ProjectFlow effect：修改 owner、deadline、方向卡、MVP 边界、阶段目标、多人通知、风险升级、长期约束写入。这些规则用 Python set / enum / 函数比外部 DSL 更清楚。
3. **fail-closed 更容易做实。** Gate exception、evidence ref 解析失败、policy 缺失时，service 层可以直接阻断高影响副作用，不需要跨进程 policy engine 或网络调用。
4. **测试成本低。** 每个 check 都能用 fixture 断言输入输出；集成测试可以直接断言 `_persist_agent_output` 只执行 `allowed_effects`。
5. **Instructor 只补结构化输出短板。** 它减少 JSON repair 和 retry 代码，但不会接管 ProjectFlow 的业务 policy。即使 Instructor 未启用，Gate 也能基于现有 Pydantic output schemas 运行。

### 6.5 接入边界

V1.5 实际接入：

1. `Pydantic`：定义 `CandidateOutput`、`ProposedEffect`、`EvidenceRef`、`ConstraintCheck`、`OutputPolicy`。
2. `Instructor`：在 `LLMClient.generate_structured(..., response_model=...)` 中使用，用于 Agent 输出结构化生成。
3. `ProjectFlow checks.py`：实现 `check_authority_boundary`、`check_evidence_quality`、`check_direction_alignment`。
4. `ProjectFlow policies.py`：把 checks 聚合为 `OutputPolicy`。
5. `AgentEvent`：只在 Gate 改变输出时记录 `constraint_trace`。

V1.5 明确不使用：

1. 外部 policy server。
2. 独立 Rego / Cedar / Casbin policy DSL。
3. Guardrails / NeMo 作为对话主控。
4. LLM-as-a-judge 作为 Gate 主判断。
5. 独立审计数据库或完整治理后台。
6. ToolExecutionApproval 或新的 human approval runtime state。

### 6.6 设计思想借鉴

借鉴 GitHub Agentic Workflows 的 Safe Outputs 思想：Agent 默认不直接获得高影响写权限，而是输出可审查的更新意图，再由安全层判断哪些写操作允许、限制、清洗或拒绝。GitHub 的安全架构中，写操作先经过 Safe Outputs pipeline，只有通过分析的 artifact 才能继续产生副作用。

ProjectFlow 中的 `OutputPolicy` 就是项目协作场景下的 Safe Outputs 机制：

```text
Agent 不直接写项目事实
→ Agent 输出 proposed_effects
→ Gate 生成 OutputPolicy
→ service 层只执行 allowed_effects
→ 高影响 effect 转 Proposal 或人工确认
```

这不是模型安全分类器，而是业务副作用控制层。模型可以生成建议，但 service 层只相信 `OutputPolicy`。

### 6.7 升级路径

如果 V1.5 规则稳定但场景增多，优先继续拆分 Python profile，而不是立刻接治理平台：

```text
V1.6：拆分 ActionCard / Risk / Replan / Memory write profile
V1.7：接入轻量 memory_consistency check
V2：评估 Microsoft Agent Governance Toolkit 或 OPA，用于跨模块 policy-as-code
V2：如需要团队权限矩阵，再评估 Casbin
V2：如需要通用对话安全，再评估 Guardrails AI / NeMo Guardrails
V2：如需要 PII 脱敏，再评估 Presidio
```

升级前提：

1. V1.5 的 `OutputPolicy` 已成为 service 层唯一副作用执行合同。
2. ConstraintTrace 数据证明规则矩阵已经复杂到 Python 函数难以维护。
3. T41 sidecar policy gate 与 T42 business gate 的职责边界已经稳定。

## 7. 总体架构

V1.5 采用后置审查、前置副作用控制：

```text
用户请求 / 后台触发
→ Coordinator Agent / 现有 Agent 模块
→ AgentRunResult
→ CandidateOutputAdapter
→ SelfConstraintGate V1.5
→ OutputPolicy
→ 现有 service 层
→ Message / Proposal / ActionCard
```

硬边界：

1. Gate 不直接创建对象。
2. Gate 不直接修改项目状态。
3. Gate 不直接通知成员。
4. Gate 只判断候选输出允许产生哪些 effect。
5. 现有 service 层必须遵守 `OutputPolicy`。
6. 高影响副作用在 Gate 不可用时必须 fail-closed。

模块职责：

| 模块 | 职责 | 不做 |
|---|---|---|
| Coordinator Agent / Agent 模块 | 生成专业候选输出 | 不做最终权限裁决 |
| CandidateOutputAdapter | 把现有 `AgentRunResult` 归一化为 Gate 输入 | 不重新推理业务结论 |
| SelfConstraintGate | 执行确定性检查并聚合策略 | 不创建 Proposal、ActionCard、Risk |
| OutputPolicy | 描述允许、阻断、需确认的 effect | 不执行 effect |
| service 层 | 按 `OutputPolicy` 创建消息、Proposal、ActionCard | 不绕过 Gate 执行高影响副作用 |

## 8. 核心数据模型

V1.5 只保留 Gate 需要的最小字段，不引入完整 T42 的 claims、confidence、full reasoning、复杂 risk score。

```python
from enum import Enum
from pydantic import BaseModel, Field


class EffectType(str, Enum):
    create_message = "create_message"
    create_proposal = "create_proposal"
    create_replan_proposal = "create_replan_proposal"
    create_action_card = "create_action_card"
    create_risk = "create_risk"
    modify_task_status = "modify_task_status"
    modify_task_owner = "modify_task_owner"
    modify_task_deadline = "modify_task_deadline"
    modify_direction_card = "modify_direction_card"
    modify_mvp_boundary = "modify_mvp_boundary"
    modify_stage_goal = "modify_stage_goal"
    notify_members = "notify_members"
    escalate_risk = "escalate_risk"
    write_long_term_constraint = "write_long_term_constraint"


class EntityRef(BaseModel):
    entity_type: str
    entity_id: str | None = None
    field: str | None = None


class ProposedAction(BaseModel):
    action_type: str
    label: str
    target: EntityRef | None = None


class ProposedEffect(BaseModel):
    effect_type: EffectType
    target: EntityRef | None = None
    payload: dict = Field(default_factory=dict)
    impact: str = "low"  # low / high，仅用于 profile 分流，不做复杂评分


class EvidenceRef(BaseModel):
    entity_type: str
    entity_id: str | None = None
    field: str
    value: str | None = None


class CandidateOutput(BaseModel):
    scenario: str
    intent: str
    proposed_actions: list[ProposedAction] = Field(default_factory=list)
    proposed_effects: list[ProposedEffect] = Field(default_factory=list)
    affected_entities: list[EntityRef] = Field(default_factory=list)
    evidence_refs: list[EvidenceRef] = Field(default_factory=list)
    draft_user_output: str
```

```python
class ConstraintStatus(str, Enum):
    pass_ = "pass"
    warning = "warning"
    violation = "violation"
    unknown = "unknown"


class ConstraintCheck(BaseModel):
    dimension: str
    status: ConstraintStatus
    reason: str
    suggested_action: str | None = None
```

```python
class OutputPolicyStatus(str, Enum):
    pass_ = "pass"
    degrade = "degrade"
    ask_clarification = "ask_clarification"
    require_confirmation = "require_confirmation"
    blocked = "blocked"


class OutputPolicy(BaseModel):
    status: OutputPolicyStatus
    allowed_effects: list[ProposedEffect] = Field(default_factory=list)
    blocked_effects: list[ProposedEffect] = Field(default_factory=list)
    required_confirmation: bool = False
    user_facing_reason: str | None = None
```

设计约束：

1. `proposed_effects` 是 Gate 判断的核心输入。
2. `allowed_effects` 是 service 层唯一可执行的 effect 集合。
3. `blocked_effects` 必须被忽略或转为待确认 Proposal。
4. `draft_user_output` 不能默认直接展示，必须经过 policy 状态处理。

## 9. 检查维度与取舍

V1.5 保留三个维度，全部做成确定性规则。

### 9.1 authority_boundary，必须做实

以下动作不能直接执行，只能 `require_confirmation`，生成待确认 Proposal 或确认项：

| 动作 | 处理 |
|---|---|
| 修改方向卡 | require_confirmation |
| 修改 MVP 边界 | require_confirmation |
| 修改阶段目标 | require_confirmation |
| 修改任务 owner | require_confirmation |
| 修改任务 deadline | require_confirmation |
| 取消或延后任务 | require_confirmation |
| 调整成员分工 | require_confirmation |
| 升级风险给全队 | require_confirmation |
| 发送多人通知 | require_confirmation |
| 把短期记忆转为长期项目约束 | require_confirmation |
| 创建 replan proposal 并标记为推荐方案 | require_confirmation |

规则伪代码：

```python
REQUIRE_CONFIRMATION_EFFECTS = {
    "modify_direction_card",
    "modify_mvp_boundary",
    "modify_stage_goal",
    "modify_task_owner",
    "modify_task_deadline",
    "notify_members",
    "escalate_risk",
    "write_long_term_constraint",
}

def check_authority_boundary(candidate: CandidateOutput) -> ConstraintCheck:
    if any(e.effect_type in REQUIRE_CONFIRMATION_EFFECTS for e in candidate.proposed_effects):
        return ConstraintCheck(
            dimension="authority_boundary",
            status="violation",
            reason="候选输出包含高影响项目副作用，Agent 不能直接执行。",
            suggested_action="require_confirmation",
        )
    return ConstraintCheck(
        dimension="authority_boundary",
        status="pass",
        reason="未发现需要人工确认的高影响副作用。",
    )
```

### 9.2 evidence_quality，轻量版

V1.5 不做复杂证据评分，只做硬规则：

| 条件 | 结果 |
|---|---|
| 要升级风险，但没有 `evidence_refs` | 阻断升级 effect，允许降级为观察项 |
| 要建议延期或更换 owner，但没有任务状态、check-in、历史事件或成员反馈证据 | require_confirmation 或 blocked，取决于是否存在安全替代输出 |
| `evidence_refs` 指向不存在实体 | blocked |
| `evidence_refs` 为空，但只是普通建议 | degrade |
| 证据不足但可继续对话 | ask_clarification |

文案约束：

1. 证据不足时不能写“已经确认”“必然”“一定会延期”。
2. 必须改成“可能”“建议关注”“需要确认”“目前证据不足”。
3. 风险升级类输出必须说明依据来自哪些任务状态、check-in、历史事件或成员反馈。

### 9.3 direction_alignment，硬边界版

V1.5 不判断“这个方向是否聪明”，只判断“Agent 是否试图改变项目结构”。

如果候选输出影响以下实体，结果为 `require_confirmation`：

| affected entity | 说明 |
|---|---|
| `direction_card` | 项目方向卡 |
| `mvp_boundary` | MVP 边界 |
| `stage_goal` | 阶段目标 |
| `project_scope` | 项目范围 |

这条规则避免 Gate 变成第二个产品经理。它不评价建议质量，只守住结构变更必须确认。

## 10. 场景化 Check Profile

V1.5 只分两类 profile。

### 10.1 低影响建议

适用：

1. 普通聊天建议。
2. Agent 面板解释。
3. 任务详情页建议文案。
4. 项目摘要。
5. 不落库的草稿文本。

检查：

```text
evidence_quality(light)
```

结果：

| 条件 | 状态 |
|---|---|
| 无副作用且无需强证据 | pass |
| 证据不足但可作为建议 | degrade |
| 缺少必要上下文，继续回答会误导 | ask_clarification |

### 10.2 高影响动作

适用：

1. 创建 Proposal。
2. 创建 Replan Proposal。
3. 创建 ActionCard。
4. 修改任务状态。
5. 修改 owner / deadline。
6. 通知成员。
7. 升级风险。
8. 改方向卡 / MVP / 阶段目标。

检查：

```text
authority_boundary
evidence_quality
direction_alignment
```

结果：

| 条件 | 状态 |
|---|---|
| 涉及正式状态变化 | require_confirmation |
| 证据引用不存在 | blocked |
| 证据硬缺失且没有安全替代输出 | blocked |
| 证据不足但可降级为观察或草稿 | degrade |
| Gate 不可用 | fail-closed，blocked |

## 11. OutputPolicy 决策规则

聚合优先级：

```text
1. evidence_refs 指向不存在实体 → blocked
2. Gate 执行失败且 profile=high_impact → blocked
3. 缺少判断所需关键上下文 → ask_clarification
4. 命中 authority_boundary → require_confirmation
5. 命中 direction_alignment 硬边界 → require_confirmation
6. 证据不足但存在安全替代输出 → degrade
7. 全部通过 → pass
```

策略表：

| Gate 状态 | allowed_effects | blocked_effects | service 层动作 |
|---|---|---|---|
| pass | 原始低风险 effects | 空 | 直接输出或创建低风险对象 |
| degrade | 安全替代 effects，例如 message / observation | 原始高确定性 effect | 输出降级文案，不执行原高影响 effect |
| ask_clarification | create_message | 原始 effects | 返回追问，不创建业务对象 |
| require_confirmation | create_proposal / create_replan_proposal / create_confirmation_item | 原始直接修改 effect | 生成待确认 Proposal 或确认项 |
| blocked | 空或 create_message | 全部原 effects | 返回硬原因，不创建对象 |

示例 policy：

```json
{
  "status": "require_confirmation",
  "allowed_effects": [
    {
      "effect_type": "create_replan_proposal",
      "target": {"entity_type": "task", "entity_id": "task_123"},
      "payload": {"change": "suggest_deadline_extension"}
    }
  ],
  "blocked_effects": [
    {
      "effect_type": "modify_task_deadline",
      "target": {"entity_type": "task", "entity_id": "task_123"}
    }
  ],
  "required_confirmation": true,
  "user_facing_reason": "这个建议会影响任务截止时间，所以不能直接修改，已转为待确认 proposal。"
}
```

## 12. ConstraintTrace 轻量实现

V1.5 保留 ConstraintTrace，但不新建独立表。

实现方式：

```text
复用 AgentEvent
event_type = "constraint_trace"
只在 Gate 改变输出时记录
```

当前代码中 `AgentEvent` 位于 `backend/app/models/timeline.py`，`AgentEventType` 位于 `backend/app/models/enums.py`。如果继续使用 Python Enum，需要补充：

```python
class AgentEventType(str, Enum):
    constraint_trace = "constraint_trace"
```

记录状态：

| Gate 状态 | 是否记录 |
|---|---|
| pass | 否 |
| degrade | 是 |
| ask_clarification | 是 |
| require_confirmation | 是 |
| blocked | 是 |

建议写入结构：

```json
{
  "input_snapshot": {
    "candidate_output": {},
    "check_profile": "high_impact",
    "workspace_summary": {}
  },
  "output_snapshot": {
    "policy": {},
    "checks": [],
    "changed_output": true
  },
  "reasoning_summary": "SelfConstraintGate changed output: require_confirmation"
}
```

不做：

1. 不建 `constraint_traces` 表。
2. 不做审计页面。
3. 不做生命周期管理。
4. 不自动转 LongTermMemory。

ConstraintTrace 的作用是调试、解释和答辩展示，不是完整审计系统。

## 13. 用户可见反馈

用户不看完整检查表，只在 Gate 改变输出时看到一句轻量原因。

| 状态 | 用户反馈规则 | 示例 |
|---|---|---|
| pass | 不提示 | 无 |
| degrade | 说明已降级为建议或观察 | “目前证据不足以直接升级风险，我先把它降级为观察项。” |
| ask_clarification | 直接把缺口转成追问 | “当前缺少阶段目标，无法判断这项建议是否偏离项目范围。请先确认本阶段目标。” |
| require_confirmation | 说明为什么需要确认 | “这个建议会影响任务截止时间，所以我不能直接修改，已生成一个待确认 proposal。” |
| blocked | 说明不能继续的硬原因 | “证据引用指向不存在的任务，无法继续创建风险升级。” |

反馈原则：

1. 不展示 `ConstraintCheck` 全量细节。
2. 不用系统内部 ID 面向用户，仍遵守项目规则，展示任务标题和成员 display_name。
3. 不把阻断写成道歉文。直接说明边界和下一步。
4. 对低影响建议，降级提示不超过一句。

## 14. 后端接入点

当前相关路径：

| 文件 | 当前职责 | V1.5 改造 |
|---|---|---|
| `backend/app/agent/llm_client.py` | `complete()` 返回字符串，OpenAI-compatible 调用，mock client | 增加 `generate_structured(..., response_model=...)`，接入 Instructor |
| `backend/app/agent/workflow.py` | `complete → json.loads/repair → validate_agent_output → AgentRunResult` | 改为优先调用结构化生成，保留 fallback |
| `backend/app/services/agent_conversation_service.py` | 对话入口、选择模块、调用 `run_agent_flow` | 接收 Gate 结果并展示轻量原因 |
| `backend/app/services/agent_flow_service.py` | `AgentRunResult` 持久化为 Proposal、ActionCard、Risk、StatusUpdate | 在 `_persist_agent_output` 前执行 Gate，只执行 `allowed_effects` |
| `backend/app/agent/output_schemas.py` | 现有 Agent 输出 Pydantic schema | 继续作为 response_model 与 Adapter 输入 |
| `backend/app/models/timeline.py` | `AgentEvent` | 复用为 `constraint_trace` 载体 |

建议新增：

```text
backend/app/agent/constraint/
  __init__.py
  models.py
  adapter.py
  gate.py
  checks.py
  policies.py
```

测试建议按当前项目习惯放在：

```text
backend/app/tests/test_agent_constraint_models.py
backend/app/tests/test_agent_constraint_checks.py
backend/app/tests/test_agent_constraint_gate.py
backend/app/tests/test_agent_flow_constraint_integration.py
```

如果希望约束模块内聚，也可以在 `backend/app/agent/constraint/tests/` 放 fixtures，但主 pytest 集成仍建议走 `backend/app/tests/`。

Instructor 接入方式：

```text
改造前：
workflow.py
→ llm_client.complete()
→ 返回 str
→ json.loads / repair
→ validate_agent_output
→ AgentRunResult

改造后：
workflow.py
→ llm_client.generate_structured(..., response_model=SomeOutput)
→ Instructor 返回 Pydantic 对象
→ AgentRunResult
→ CandidateOutputAdapter
→ SelfConstraintGate
→ OutputPolicy
→ 现有 service 层
```

LLMClient 协议建议：

```python
from typing import TypeVar
from pydantic import BaseModel

T = TypeVar("T", bound=BaseModel)


class LLMClient(Protocol):
    def complete(self, messages: list[dict[str, str]], *, max_tokens: int | None = None) -> str:
        ...

    def generate_structured(
        self,
        messages: list[dict[str, str]],
        *,
        response_model: type[T],
        max_tokens: int | None = None,
        max_retries: int = 2,
    ) -> T:
        ...
```

## 15. 执行流程

高影响路径：

```text
1. 用户请求或后台触发进入 Agent。
2. CoordinatorAgent / Agent 模块生成 AgentRunResult。
3. CandidateOutputAdapter 根据输出类型推断 proposed_effects。
4. 根据 proposed_effects 选择 profile：low_impact 或 high_impact。
5. SelfConstraintGate 执行 checks。
6. policies.py 聚合 ConstraintCheck 为 OutputPolicy。
7. 如果 status != pass，写 AgentEvent constraint_trace。
8. agent_flow_service 只执行 allowed_effects。
9. agent_conversation_service 返回用户可见轻量原因。
10. 前端展示 Message / Proposal / ActionCard。
```

Adapter 推断示例：

| Agent 输出类型 | 默认 proposed_effects |
|---|---|
| `DirectionCardOutput` | `create_proposal`，affected `direction_card` |
| `StagePlanOutput` | `create_proposal`，affected `stage_goal` |
| `TaskBreakdownOutput` | `create_proposal`，affected `task` |
| `AssignmentRecommendationOutput` | `create_assignment_proposal`，affected `task.owner` |
| `ActivePushOutput` | `create_action_card` |
| `CheckInAnalysisOutput.task_updates` | `modify_task_status` |
| `RiskAnalysisOutput.risks` | `create_risk`，高 severity 或多人通知时 `escalate_risk` |
| `ReplanOutput.task_changes.due_date` | `modify_task_deadline`，转 `create_replan_proposal` |
| `ReplanOutput.task_changes.owner_user_id` | `modify_task_owner`，转 `create_replan_proposal` |

## 16. 失败处理与 fallback

V1.5 的失败策略：

| 场景 | 低影响 profile | 高影响 profile |
|---|---|---|
| Instructor 结构化失败 | 使用现有 fallback 文本并标注降级 | 不执行副作用，最多生成草稿消息 |
| Gate 抛异常 | degrade，提示未完成完整检查 | blocked，fail-closed |
| evidence_refs 无法解析 | degrade 或 ask_clarification | blocked |
| service 层发现 policy 缺失 | 不创建对象 | blocked |
| `allowed_effects` 为空 | 只返回 message | 不创建 Proposal/ActionCard/Risk |

高影响动作 fail-closed 规则：

```text
Gate 不可用
→ 不创建 ActionCard
→ 不创建 Risk
→ 不修改 Task/Stage/Project
→ 不发送通知
→ 不写长期记忆
→ 可返回一条说明性 Agent Message
```

Fallback 文案示例：

```text
当前无法完成完整约束检查，所以不会执行项目状态变更。我已保留为草稿建议，等待你确认后再继续。
```

## 17. V1.5 必做范围

| 编号 | 必做项 |
|---:|---|
| 1 | 新增 `CandidateOutputAdapter`。 |
| 2 | 新增 `SelfConstraintGate`。 |
| 3 | 新增 `OutputPolicy`。 |
| 4 | Proposal / Replan Proposal 创建前过 Gate。 |
| 5 | ActionCard 创建前过 Gate。 |
| 6 | 高影响动作 `require_confirmation`。 |
| 7 | 证据不足的风险升级降级或转确认。 |
| 8 | Gate 失败时高影响动作 fail-closed。 |
| 9 | Gate 改变输出时写 `AgentEvent`。 |
| 10 | 用户看到轻量原因。 |
| 11 | Instructor 接入 `llm_client.py` / `workflow.py` 的结构化输出链路。 |
| 12 | Constraint checks 和 policy 聚合有单元测试。 |

## 18. V1.5 暂不做范围

| 编号 | 暂不做项 | 原因 |
|---:|---|---|
| 1 | 不做独立 ConstraintTrace 表 | 复用 AgentEvent 足够，避免迁移和审计系统膨胀。 |
| 2 | 不做审计页面 | 当前目标是开发调试和答辩展示，不是运营审计。 |
| 3 | 不接 Microsoft AGT | 现阶段过重，作为 V2 候选。 |
| 4 | 不接 OPA / Casbin | 规则数量少，业务 effect 判断比通用授权更关键。 |
| 5 | 不做 LLM-as-a-judge | V1.5 需要可测试确定性规则。 |
| 6 | 不做复杂 evidence scoring | 只做 evidence_refs 存在性、引用合法性和强证据硬要求。 |
| 7 | 不做完整 memory_consistency | Project Memory 不是本次主路径。 |
| 8 | 不接 Project Pulse / Risk Pulse 主动生成全路径 | 先覆盖高影响出口。 |
| 9 | 不重构所有 Agent Skill | 先用 Adapter 桥接现有输出。 |
| 10 | 不做普通用户可调用的 internal Gate API | Gate 是内部 service boundary，不暴露给普通用户。 |

## 19. 示例场景

### 19.1 用户要求 Agent 直接延期任务

输入：

```text
“把后端 API 任务直接延期三天。”
```

候选 effect：

```json
[
  {
    "effect_type": "modify_task_deadline",
    "target": {"entity_type": "task", "entity_id": "task_api"}
  }
]
```

Gate 结果：

| 检查 | 结果 |
|---|---|
| authority_boundary | violation |
| evidence_quality | pass 或 warning |
| direction_alignment | pass |

OutputPolicy：

```text
status = require_confirmation
allowed_effects = create_replan_proposal
blocked_effects = modify_task_deadline
```

用户可见反馈：

```text
这个建议会影响任务截止时间，所以我不能直接修改，已生成一个待确认 proposal。
```

### 19.2 Agent 证据不足却想升级风险

候选输出：

```text
“这个延期风险已经很严重，需要立刻通知全队。”
```

候选 effect：

```text
escalate_risk + notify_members
evidence_refs = []
```

Gate 结果：

| 检查 | 结果 |
|---|---|
| evidence_quality | warning 或 violation |
| authority_boundary | violation |

OutputPolicy：

```text
status = degrade
allowed_effects = create_message 或 create_observation
blocked_effects = escalate_risk, notify_members
```

用户可见反馈：

```text
目前证据不足以直接升级风险，我先把它降级为观察项。
```

如果候选 evidence_refs 指向不存在任务：

```text
status = blocked
user_facing_reason = "证据引用指向不存在的任务，无法继续创建风险升级。"
```

### 19.3 Agent 建议修改阶段目标

候选输出：

```text
“建议把当前阶段目标从完成任务协作闭环，改成完整数据看板。”
```

affected_entities：

```json
[
  {"entity_type": "stage_goal", "entity_id": "stage_1"},
  {"entity_type": "project_scope"}
]
```

Gate 结果：

| 检查 | 结果 |
|---|---|
| direction_alignment | violation |
| authority_boundary | violation |

OutputPolicy：

```text
status = require_confirmation
allowed_effects = create_proposal
blocked_effects = modify_stage_goal
```

用户可见反馈：

```text
这个建议会改变阶段目标，不能直接生效，已转为待确认 proposal。
```

### 19.4 Agent 生成普通低风险建议

候选输出：

```text
“建议今天先补齐接口字段说明，再继续联调。”
```

候选 effect：

```text
create_message
```

Gate 结果：

| 检查 | 结果 |
|---|---|
| evidence_quality(light) | pass |

OutputPolicy：

```text
status = pass
allowed_effects = create_message
blocked_effects = []
```

用户可见反馈：

```text
不额外提示，直接展示建议。
```

## 20. 验收标准

功能验收：

| 编号 | 标准 |
|---:|---|
| 1 | Agent 不能绕过 Gate 创建 Proposal / Replan Proposal / ActionCard。 |
| 2 | 修改方向卡、MVP 边界、阶段目标必须 require_confirmation。 |
| 3 | 修改 task owner、deadline、取消或延后任务必须 require_confirmation。 |
| 4 | 发送多人通知或升级风险给全队必须 require_confirmation。 |
| 5 | evidence_refs 指向不存在实体时，高影响动作 blocked。 |
| 6 | 证据不足的普通建议 degrade，不阻断。 |
| 7 | Gate 不可用时，高影响动作不产生副作用。 |
| 8 | Gate 改变输出时写入 `AgentEvent(event_type="constraint_trace")`。 |
| 9 | pass 不写 constraint_trace。 |
| 10 | 用户只看到一句轻量原因，不看到完整检查表。 |

测试验收：

| 测试类型 | 覆盖 |
|---|---|
| 单元测试 | `check_authority_boundary`、`check_evidence_quality`、`check_direction_alignment`。 |
| 聚合测试 | 多个 `ConstraintCheck` 聚合为正确 `OutputPolicy`。 |
| Adapter 测试 | 各类 `AgentOutputBase` 推断出正确 `proposed_effects`。 |
| 集成测试 | `_persist_agent_output` 只执行 `allowed_effects`。 |
| 失败测试 | Gate exception 下 high_impact fail-closed。 |
| 回归测试 | 普通低风险建议仍 pass，不被过度拦截。 |

建议命令：

```powershell
cd backend
.venv\Scripts\python -m pytest app/tests/test_agent_constraint_checks.py -v
.venv\Scripts\python -m pytest app/tests/test_agent_flow_constraint_integration.py -v
.venv\Scripts\python -m pytest app/tests/test_agent_workflow.py -v
```

## 21. 后续演进路线

V1.5 之后按问题规模演进，不提前引入重系统。

| 阶段 | 条件 | 演进 |
|---|---|---|
| V1.6 | Gate 规则稳定，但场景增多 | 拆分更细 profile，例如 ActionCard、Risk、Replan。 |
| V1.7 | Project Memory 成熟 | 增加轻量 `memory_consistency`，仍不做复杂图谱推理。 |
| V2 | authority_boundary 规则矩阵复杂 | 评估 Microsoft AGT 或 OPA 作为策略执行层。 |
| V2 | 需要团队审计 | 再考虑独立 ConstraintTrace 表和审计页面。 |
| V2 | 模糊语义边界增多 | 局部引入 LLM-as-a-judge，但只作为辅助信号，不作为唯一裁决。 |
| V2+ | T41 sidecar 接管 runtime | 将 Gate 下沉到 sidecar policy gate，与 Tool Contract 对齐。 |

V2 前提：

1. V1.5 的 rule-based Gate 已经覆盖主要高影响出口。
2. 现有 service 层已经严格执行 `OutputPolicy`。
3. ConstraintTrace 数据证明需要更强审计或配置化。

## 22. 参考资料

- [Instructor structured outputs](https://python.useinstructor.com/)
- [Pydantic models](https://docs.pydantic.dev/latest/concepts/models/)
- [GitHub Agentic Workflows security architecture](https://github.blog/ai-and-ml/generative-ai/under-the-hood-security-architecture-of-github-agentic-workflows/)
- [Microsoft Agent Governance Toolkit](https://github.com/microsoft/agent-governance-toolkit)
- [Open Policy Agent documentation](https://www.openpolicyagent.org/docs)
- [Casbin overview](https://casbin.org/docs/overview)
- [Guardrails AI Guard documentation](https://www.guardrailsai.com/docs/concepts/guard)
- [NVIDIA NeMo Guardrails documentation](https://docs.nvidia.com/nemo/guardrails/latest/index.html)
- [Microsoft Presidio documentation](https://microsoft.github.io/presidio/)
- [Meta Llama Guard 2 model card](https://developer.meta.com/ai/docs/model-cards-and-prompt-formats/meta-llama-guard-2/)

## 23. 自检

| 检查项 | 结论 |
|---|---|
| 是否比 MVP 更完整 | 是。新增 CandidateOutput、Gate、OutputPolicy、ConstraintTrace、fail-closed。 |
| 是否变成完整治理系统 | 否。不建审计表，不接策略引擎，不做权限中心。 |
| 是否解决副作用前边界判断 | 是。Gate 位于 `AgentRunResult` 和 service 持久化之间。 |
| 高影响动作是否必须人工确认 | 是。owner、deadline、方向卡、MVP、阶段目标、多人通知、风险升级均 require_confirmation。 |
| 证据不足是否降级 | 是。普通建议 degrade，风险升级阻断原 effect 或转观察/确认。 |
| 是否可单元测试 | 是。三类 check 和 policy 聚合均为确定性规则。 |
| 是否兼容当前后端 | 是。复用 Pydantic、AgentRunResult、AgentEvent、AgentProposal、agent_flow_service。 |
| 是否合理接入开源 | 是。Instructor/Pydantic 用在结构层，业务规则自研。 |
| 是否明确不做事项 | 是。第 18 节列出 V1.5 暂不做范围。 |
| 是否符合 Safe Outputs 思想 | 是。`proposed_effects → OutputPolicy → service enforcement` 是 ProjectFlow 版 Safe Outputs。 |
| 是否完成技术选型 | 是。主线采用 Pydantic + 自研 rule-based Gate + Instructor，AGT / OPA / Casbin / Guardrails / NeMo / Presidio 均作为后续候选或非主路径。 |
