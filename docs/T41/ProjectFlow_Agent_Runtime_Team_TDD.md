# ProjectFlow Agent 底座重构技术方案

> **推荐结论**：采用 **Pi SDK Sidecar + ProjectFlow Tool Contract + Proposal-Confirm** 的折中架构  

---

## 1. 背景与问题定义

ProjectFlow 当前的 Agent 能力更接近固定流程驱动的 Coordinator：系统能够完成项目方向澄清、阶段规划、任务拆解、分工建议、风险识别、重新规划等模块化能力，但整体交互仍偏“机械式流程触发”。

训练营当前阶段的目标不是从零开发一个完整 Agent Framework，而是在可控时间内完成 Agent 底座升级，使 ProjectFlow 具备更接近现代 Agent 产品的能力：

- 能根据上下文自主选择工具；
- 能将项目管理能力封装为 Tool / Skill；
- 能展示工具调用过程和 Agent 执行轨迹；
- 能保留人类确认机制，避免 Agent 直接修改核心业务状态；
- 能为后续 MCP、LangGraph、多 Agent 或其他 Runtime 迁移留下接口空间。

因此，本方案需要在 **短期可落地** 与 **中长期可扩展** 之间取得平衡。

---

## 2. 方案结论

本方案建议采用以下架构：

```text
Pi SDK Sidecar
+ ProjectFlow Tool Contract
+ Proposal-Confirm-Commit
+ Runtime Adapter 抽象
+ Unified Agent Event Timeline
```

核心结论如下：

1. **Pi SDK 作为外置 Agent Runtime**  
   Pi 负责 Agent Session、工具选择、Skill 加载、流式事件、Agent Loop 等通用 Agent 能力。

2. **ProjectFlow 继续持有业务事实源**  
   项目、任务、成员、阶段、风险、Proposal、Timeline 等业务状态仍由 FastAPI 和数据库负责。

3. **所有高影响写入动作必须先生成 Proposal**  
   Agent 可以分析、建议、生成方案，但不能绕过确认流程直接修改核心项目状态。

4. **Tool Contract 作为长期稳定边界**  
   ProjectFlow 的项目管理能力应抽象为稳定工具接口，而不是直接绑定 Pi 的具体 API 格式。

5. **Runtime Adapter 保证后续可替换**  
   Pi 是当前推荐实现，但系统设计上应允许未来替换为 LangGraph、OpenAI Agents SDK、OpenCode 或 MCP Runtime。

---

## 3. 架构决策记录（ADR）

### 3.1 决策主题

为 ProjectFlow 引入更现代的 Agent Runtime，使 Agent 从固定 Coordinator 流程升级为具备工具调用、Skill 加载、上下文管理、事件流展示和可控执行能力的项目管理 Agent。

### 3.2 决策结果

采用 **Pi SDK Sidecar + ProjectFlow Tool Contract + Proposal-Confirm** 方案。

### 3.3 决策依据

#### 3.3.1 训练营阶段优先考虑落地效率

直接重写为 LangGraph / 多 Agent / MCP-first 架构虽然长期上限更高，但会显著增加学习、集成和调试成本。训练营阶段更适合先接入一个成熟 Runtime，再把 ProjectFlow 已有流程封装为工具能力。

#### 3.3.2 Pi SDK 适合作为外置 Runtime

Pi SDK 的优势在于：

- 适合嵌入其他应用；
- 支持 AgentSession；
- 支持 custom tools；
- 支持 extensions；
- 支持 skills；
- 支持 session 与上下文管理；
- 支持事件流和工具执行生命周期；
- 提供 RPC 作为降级备选。

这些能力正好覆盖 ProjectFlow 当前缺失的 Agent Runtime 层。

#### 3.3.3 ProjectFlow 的业务状态不应交给 Agent Runtime 管理

ProjectFlow 是项目管理产品，不是纯 Coding Agent。项目、阶段、任务、分工、风险、行动卡片等状态必须保持一致性和可追踪性。因此，业务事实源应继续由 FastAPI / DB 管理。

Agent Runtime 只负责：

- 理解用户意图；
- 选择合适工具；
- 调用工具；
- 组织多步推理；
- 生成结构化建议；
- 输出事件流；
- 触发待确认 Proposal。

#### 3.3.4 保留 Proposal-Confirm 是安全边界

项目管理场景中的写入操作通常具有较高影响，例如：

- 生成或修改阶段计划；
- 拆解任务；
- 调整分工；
- 重新规划进度；
- 生成行动卡片；
- 标记风险状态。

这些动作不应由 Agent 自动提交。正确流程应为：

```text
Agent 分析
  → 调用工具
  → 生成 Proposal
  → 前端展示
  → 成员确认 / 拒绝
  → FastAPI 确定性 Commit
```

### 3.4 被放弃的方案

| 方案 | 放弃原因 |
|---|---|
| 继续使用当前单 Coordinator | 改动小，但 Agent 能力提升有限，仍偏机械流程触发 |
| 从零开发 Agent Framework | 工程量过大，不适合训练营周期 |
| 直接全面迁移 LangGraph | 长期合理，但短期集成成本高，容易影响已有闭环 |
| OpenCode 作为主 Runtime | 更偏 Coding Agent，不完全贴合 ProjectFlow 的项目管理场景 |
| MCP-first 重构 | 长期有价值，但短期会引入额外协议复杂度 |

---

## 4. 推荐总体架构

### 4.1 架构图

```text
┌───────────────────────────────────────────────────────────┐
│                    ProjectFlow Frontend                   │
│                                                           │
│  Chat Panel / Tool Timeline / Proposal Banner / Confirm   │
└───────────────────────────────┬───────────────────────────┘
                                │
                                ▼
┌───────────────────────────────────────────────────────────┐
│                    FastAPI ProjectFlow Core               │
│                                                           │
│  - WorkspaceState                                         │
│  - Project / Stage / Task / Member / Risk                 │
│  - AgentProposal                                          │
│  - Confirm / Reject / Commit                              │
│  - AgentEvent Timeline                                    │
│  - Internal Tool APIs                                     │
└───────────────────────────────┬───────────────────────────┘
                                │
                                ▼
┌───────────────────────────────────────────────────────────┐
│                    Agent Bridge Sidecar                   │
│                                                           │
│  - Runtime Adapter                                        │
│  - Tool Registry                                          │
│  - Skill Loader                                           │
│  - Policy Gate                                            │
│  - Event Mapping                                          │
│  - Stream Adapter                                         │
└───────────────────────────────┬───────────────────────────┘
                                │
                                ▼
┌───────────────────────────────────────────────────────────┐
│                    Pi SDK Runtime                         │
│                                                           │
│  - AgentSession                                           │
│  - Tool Calling                                           │
│  - Skills                                                 │
│  - Extensions                                             │
│  - Session Context                                        │
│  - Runtime Events                                         │
└───────────────────────────────────────────────────────────┘
```

### 4.2 核心数据流

```text
用户输入自然语言需求
  ↓
Frontend 发送 Agent Run 请求
  ↓
FastAPI 读取最新 WorkspaceState
  ↓
FastAPI 将上下文与用户输入发送给 Agent Bridge
  ↓
Agent Bridge 调用 Pi SDK Runtime
  ↓
Pi 根据上下文选择 Tool / Skill
  ↓
Tool 通过内部 API 读取或生成 ProjectFlow 业务结果
  ↓
高影响结果写入 AgentProposal，而不是直接 Commit
  ↓
Agent Bridge 将过程事件转为统一 AgentEvent
  ↓
Frontend 展示 Tool Timeline 和 Proposal Banner
  ↓
成员确认后 FastAPI 执行确定性 Commit
```

---

## 5. 各层职责划分

### 5.1 Frontend

前端负责呈现 Agent 体验，但不直接依赖 Pi Runtime。

职责包括：

- 展示 Agent 对话；
- 展示工具调用时间线；
- 展示 Proposal Banner；
- 支持 Confirm / Reject 操作；
- 展示 Agent 的过程解释；
- 展示风险、行动卡片、重新规划建议等结果。

前端只消费 ProjectFlow 统一事件格式，不直接消费 Pi 原生事件格式。

### 5.2 FastAPI Core

FastAPI 是业务核心和事实源。

职责包括：

- 维护数据库；
- 组装 WorkspaceState；
- 管理 Project / Stage / Task / Member / Risk；
- 管理 AgentProposal；
- 执行 Confirm / Reject / Commit；
- 写入 AgentEvent Timeline；
- 暴露面向 Agent Bridge 的 internal tool APIs；
- 维护权限、校验和幂等逻辑。

FastAPI 不应承担复杂 Agent Loop，也不应直接依赖 Pi SDK。

### 5.3 Agent Bridge Sidecar

Agent Bridge 是 ProjectFlow 与外部 Runtime 的适配层。

职责包括：

- 管理 Runtime 生命周期；
- 初始化 Pi AgentSession；
- 注册 ProjectFlow Tools；
- 加载 ProjectFlow Skills；
- 将 Pi Runtime Event 映射为统一 AgentEvent；
- 执行工具调用权限控制；
- 将工具调用转发给 FastAPI internal API；
- 将流式事件返回给 FastAPI 或前端网关；
- 通过 Runtime Adapter 屏蔽具体 Runtime 差异。

Agent Bridge 不应直接访问数据库，也不应保存核心业务状态。

### 5.4 Pi SDK Runtime

Pi 负责通用 Agent 能力。

职责包括：

- Agent Session；
- 模型调用；
- 工具选择；
- Tool Calling；
- Skill 按需加载；
- 上下文管理；
- 流式事件输出；
- 多轮推理。

Pi 不应成为 ProjectFlow 的业务状态源。

---

## 6. 核心设计原则

### 6.1 DB 是唯一事实源

Agent Session 中的记忆不能替代数据库状态。每次关键 Agent Run 都应优先读取最新 WorkspaceState。

```text
正确：Agent 读取 DB 状态后生成建议
错误：Agent 凭会话记忆判断项目真实状态
```

### 6.2 Agent 只建议，后端负责确定性提交

Agent 可以调用工具生成方案，但核心业务写入必须由 FastAPI 的确定性服务完成。

```text
Agent → Proposal
User / Member → Confirm
FastAPI → Commit
```

### 6.3 Tool Contract 稳定优先

工具接口应围绕 ProjectFlow 业务语义设计，而不是围绕 Pi 的 SDK 格式设计。

这样后续可以平滑迁移到：

- MCP tools；
- LangGraph nodes；
- OpenAI Agents tools；
- OpenCode server tools；
- 自研 Runtime。

### 6.4 Runtime 可替换

Pi 是当前实现，不是永久绑定。

系统内部应抽象出 Runtime Adapter：

```text
AgentRuntimePort
  ├─ PiRuntimeAdapter
  ├─ PiRpcRuntimeAdapter
  ├─ LangGraphRuntimeAdapter
  ├─ OpenAIAgentsRuntimeAdapter
  └─ OpenCodeRuntimeAdapter
```

训练营阶段只需要实现 PiRuntimeAdapter，但接口应提前设计好。

### 6.5 事件格式统一

前端和 FastAPI 不应直接依赖 Pi 原生事件。

统一事件建议包括：

```text
agent.started
agent.delta
agent.completed
tool.started
tool.progress
tool.completed
tool.blocked
proposal.created
approval.required
runtime.error
```

---

## 7. Tool Contract 设计

### 7.1 工具分类

ProjectFlow Tools 建议分为四类。

| 类型 | 说明 | 默认策略 |
|---|---|---|
| 只读工具 | 读取项目状态、Timeline、待确认 Proposal | 自动允许 |
| 分析工具 | 分析 check-in、风险、分工合理性 | 自动允许，但记录 trace |
| Proposal 工具 | 生成阶段计划、任务拆解、重排方案 | 允许生成 Proposal，不允许直接 Commit |
| 写入确认工具 | Confirm / Reject Proposal | 必须由人类触发 |

### 7.2 推荐工具清单

| Tool | 作用 | 风险级别 | 落库方式 |
|---|---|---|---|
| `get_workspace_state` | 读取当前项目完整状态 | Low | 不落库 |
| `get_agent_conversation` | 读取当前对话上下文 | Low | 不落库或 conversation service |
| `list_pending_proposals` | 查询待确认 Proposal | Low | 不落库 |
| `get_timeline_slice` | 获取近期事件轨迹 | Low | 不落库 |
| `generate_direction_card_proposal` | 生成方向卡提案 | Medium | AgentProposal |
| `generate_stage_plan_proposal` | 生成阶段计划提案 | Medium | AgentProposal |
| `generate_task_breakdown_proposal` | 生成任务拆解提案 | Medium | AgentProposal |
| `recommend_assignment` | 生成分工建议 | Medium | 可直接写建议或进入 Proposal |
| `analyze_checkins_and_risks` | 分析 check-in 与风险 | Medium | Risk / Event / ActionCard |
| `generate_replan_proposal` | 生成重新规划提案 | High | AgentProposal |

### 7.3 工具调用边界

#### 允许 Agent 自动调用

- `get_workspace_state`
- `get_agent_conversation`
- `list_pending_proposals`
- `get_timeline_slice`
- `analyze_checkins_and_risks`

#### 允许 Agent 生成 Proposal

- `generate_direction_card_proposal`
- `generate_stage_plan_proposal`
- `generate_task_breakdown_proposal`
- `generate_replan_proposal`

#### 不允许 Agent 自动执行

- 直接删除任务；
- 直接修改阶段；
- 直接确认 Proposal；
- 直接覆盖成员分工；
- 任意 shell / file write / delete；
- 绕过 FastAPI 的数据库写入。

---

## 8. Skill 设计

### 8.1 Skill 的定位

Skill 用于沉淀 ProjectFlow 的专业项目管理流程，而不是简单堆 Prompt。

每个 Skill 应包含：

- 触发场景；
- 处理流程；
- 可调用工具；
- 输出格式；
- 决策原则；
- 失败或不确定时的回退策略。

### 8.2 推荐 Skill 清单

| Skill | 场景 | 主要工具 | 输出 |
|---|---|---|---|
| `project-intake` | 项目目标模糊，需要澄清方向 | `get_workspace_state`, `generate_direction_card_proposal` | 方向卡 Proposal |
| `project-planning` | 已有方向，需要阶段计划 | `get_workspace_state`, `generate_stage_plan_proposal` | 阶段计划 Proposal |
| `task-breakdown` | 已有阶段，需要任务拆解 | `get_workspace_state`, `generate_task_breakdown_proposal` | 任务拆解 Proposal |
| `assignment-negotiation` | 需要分工或协调成员冲突 | `get_workspace_state`, `recommend_assignment` | 分工建议 / 协调解释 |
| `risk-replan` | check-in 暴露风险或延期 | `analyze_checkins_and_risks`, `generate_replan_proposal` | 风险分析 / 重排 Proposal |

### 8.3 Skill 组织建议

```text
.pi/skills/
  project-intake/
    SKILL.md
    references/intake-checklist.md
  project-planning/
    SKILL.md
    references/planning-rubric.md
  task-breakdown/
    SKILL.md
  assignment-negotiation/
    SKILL.md
  risk-replan/
    SKILL.md
```

Skill 不应包含数据库写入逻辑。Skill 只描述流程、规则和工具使用方式。

---

## 9. Event Timeline 设计

### 9.1 统一事件模型

Agent 的执行过程需要可见、可追踪、可回放。

推荐统一事件类型：

| Event Type | 说明 |
|---|---|
| `agent.started` | Agent Run 开始 |
| `agent.delta` | Agent 流式输出片段 |
| `agent.completed` | Agent Run 完成 |
| `tool.started` | 工具调用开始 |
| `tool.progress` | 工具调用中间进度 |
| `tool.completed` | 工具调用完成 |
| `tool.blocked` | 工具调用被权限策略阻止 |
| `proposal.created` | 已生成待确认 Proposal |
| `approval.required` | 当前操作需要人类确认 |
| `runtime.error` | Runtime 或工具执行错误 |

### 9.2 统一事件字段

```json
{
  "event_id": "evt_xxx",
  "correlation_id": "run_xxx",
  "project_id": "project_xxx",
  "conversation_id": "conv_xxx",
  "session_id": "session_xxx",
  "type": "tool.started",
  "payload": {},
  "created_at": "2026-07-03T00:00:00+09:00"
}
```

### 9.3 Timeline 的产品价值

Agent Timeline 不只是技术日志，也应该成为产品体验的一部分。

前端可以展示：

```text
Agent 正在读取项目状态
Agent 发现阶段计划与成员容量存在冲突
Agent 调用了风险分析工具
Agent 生成了重新规划 Proposal
等待成员确认
```

这会让 Agent 从“黑盒回复”变成“可理解的项目协作助手”。

---

## 10. Proposal 设计

### 10.1 Proposal 的定位

Proposal 是 Agent 建议和业务提交之间的安全缓冲区。

它承担三类职责：

1. 保存 Agent 生成的结构化方案；
2. 供团队成员确认或拒绝；
3. 被确认后由 FastAPI 执行确定性 Commit。

### 10.2 推荐 Proposal 类型

| Proposal Type | 说明 |
|---|---|
| `direction_card` | 项目方向卡 |
| `stage_plan` | 阶段计划 |
| `task_breakdown` | 任务拆解 |
| `assignment` | 分工方案 |
| `risk_replan` | 风险后的重新规划 |
| `action_cards` | 行动卡片建议 |

### 10.3 Proposal 生命周期

```text
created
  ↓
pending
  ↓
confirmed / rejected / expired
  ↓
committed / discarded
```

### 10.4 Commit 原则

确认后的 Commit 必须满足：

- 幂等；
- 可校验；
- 可回滚或可重置；
- 写入 Timeline；
- 不依赖 Agent 再次解释；
- 使用 FastAPI 业务服务完成。

---

## 11. Runtime Adapter 设计

### 11.1 设计目的

Runtime Adapter 的目标是避免业务系统被 Pi 深度绑定。

前端、FastAPI、Tool Contract 不应感知具体 Runtime 是 Pi、LangGraph、OpenAI Agents SDK 还是 OpenCode。

### 11.2 建议接口

```ts
export interface AgentRuntimePort {
  init(config: RuntimeInit): Promise<void>;
  createSession(input: CreateSessionInput): Promise<RuntimeSession>;
  resumeSession(input: ResumeSessionInput): Promise<RuntimeSession>;
  registerTools(tools: ToolDefinition[]): Promise<void>;
  loadSkills(skills: SkillDefinition[]): Promise<void>;
  streamRun(input: StreamRunInput): AsyncIterable<RuntimeEvent>;
  cancelRun(input: CancelRunInput): Promise<void>;
  closeSession(sessionId: string): Promise<void>;
}
```

### 11.3 短期实现

训练营阶段只实现：

```text
PiRuntimeAdapter
```

### 11.4 中长期可扩展实现

```text
PiRpcRuntimeAdapter
LangGraphRuntimeAdapter
OpenAIAgentsRuntimeAdapter
OpenCodeRuntimeAdapter
```

---

## 12. 安全与权限设计

### 12.1 风险判断

Pi 的 project trust 不能被视为安全沙箱。Agent Runtime 通常具备较强执行能力，如果不做限制，可能出现以下风险：

- 访问不该访问的本地文件；
- 执行危险命令；
- 绕过业务确认流程；
- 写入错误项目状态；
- 在上下文误解时重复提交；
- 第三方 extension 或 skill 带来额外风险。

### 12.2 权限策略

推荐权限矩阵：

| 类型 | 默认策略 |
|---|---|
| 只读 ProjectFlow Tool | 自动允许 |
| 分析类 Tool | 自动允许，但记录事件 |
| Proposal 生成 Tool | 自动允许生成 Proposal，不允许 Commit |
| Confirm / Commit | 必须人类确认 |
| Shell / Edit / Delete | 默认禁用 |
| 第三方 Skill / Extension | 默认不引入 |

### 12.3 容器隔离

推荐将 Agent Bridge 与 Pi Runtime 放入独立容器。

原则：

- 不直接挂载宿主机敏感目录；
- 不暴露完整用户主目录；
- 只提供必要 workspace；
- internal API 使用内部 token；
- 禁止 Runtime 直接访问数据库文件；
- 只允许通过 FastAPI internal API 访问业务状态。

---

## 13. 方案优势

### 13.1 短期落地快

不需要从零开发 Agent Framework，也不需要立即重写 LangGraph 流程。Pi SDK 提供现成 Agent Runtime 能力，ProjectFlow 只需要封装工具和事件。

### 13.2 保留现有业务闭环

ProjectFlow 的核心业务能力继续由 FastAPI 管理，降低重构风险。

### 13.3 Agent 体验提升明显

相比单 Coordinator，Sidecar Runtime 可以提供更接近现代 Agent 的体验：

- 工具调用；
- 多步执行；
- Skill 按需加载；
- 流式输出；
- Timeline 展示；
- Proposal 等待确认；
- 可解释执行过程。

### 13.4 安全边界清晰

Agent 不能直接修改核心状态，高影响操作必须进入 Proposal 流程。

### 13.5 中长期扩展性较好

通过 Tool Contract 和 Runtime Adapter，后续可以迁移到 MCP、LangGraph、多 Agent 或其他 Runtime。

---

## 14. 方案缺点

### 14.1 系统复杂度上升

原本系统主要是 Frontend + FastAPI。引入 Sidecar 后，会新增：

- Node/TS Bridge；
- Runtime Adapter；
- Tool Registry；
- Event Mapping；
- Policy Gate；
- 容器隔离；
- 跨服务日志追踪。

这会增加调试成本。

### 14.2 存在 Runtime 依赖风险

即使有 Adapter，短期实现仍然依赖 Pi SDK 的稳定性、文档完整性和事件模型。

### 14.3 Sidecar 与主后端之间存在通信成本

工具调用需要经过：

```text
Pi → Bridge → FastAPI → DB → FastAPI → Bridge → Pi
```

这会增加延迟和错误链路。

### 14.4 长流程持久化能力有限

训练营阶段不建议一开始做复杂 checkpoint / resume。若后续需要真正的长流程任务恢复，LangGraph 等 Graph Runtime 更合适。

### 14.5 权限控制需要自建

Pi 本身不能替代业务层安全策略。ProjectFlow 必须自己实现工具 allowlist、policy gate、proposal-confirm 和容器边界。

---

## 15. 主要风险与缓解措施

| 风险 | 表现 | 缓解措施 |
|---|---|---|
| 状态分裂 | Agent 记忆与 DB 状态不一致 | 每次 Run 强制读取 WorkspaceState；DB 为唯一事实源 |
| SDK 绑定 | 后续难以迁移 Runtime | 引入 Runtime Adapter；统一事件格式；工具接口独立设计 |
| 权限过大 | Agent 误执行危险工具 | 默认禁用 shell/edit/delete；只开放必要工具 |
| Proposal 绕过 | Agent 直接修改业务状态 | 所有写操作必须经 FastAPI confirm |
| 调试困难 | 跨服务链路复杂 | 统一 correlation_id 与 AgentEvent Timeline |
| Demo 不稳定 | Runtime 出错影响展示 | 保留 legacy runtime 或 mock fallback |
| 工具设计混乱 | 工具参数不稳定，后续难维护 | 固定 Tool Contract，并与业务语义对齐 |
| Skill 变成 Prompt 堆砌 | 规则不可维护 | Skill 只写流程、触发条件、工具选择和输出规范 |

---

## 16. 与其他方案的对比

| 方案 | 适配度 | 优点 | 缺点 | 结论 |
|---|---:|---|---|---|
| Pi SDK Sidecar | 高 | 落地快，Agent 能力完整，适合外置 Runtime | 需要自建权限和 Bridge | 推荐 |
| Pi RPC | 中 | 更薄，跨语言方便 | 控制粒度较弱，事件处理更原始 | 作为 fallback |
| LangGraph | 中高 | 长流程、持久化、人类中断强 | 短期重构成本高 | 后续演进方向 |
| OpenAI Agents SDK | 中 | Agent primitives 清晰，HITL/tracing 完整 | 与当前 TS/Sidecar 组合需额外适配 | 可作为未来 Runtime |
| OpenCode | 中 | server-first、权限、SDK 友好 | 更偏 Coding Agent，不贴合项目管理主线 | 参考，不作为主底座 |
| MCP-first | 中 | 标准化工具生态 | 短期协议成本高 | 中期 Tool Contract 演进方向 |
| 当前 Coordinator | 低 | 稳定，改动小 | Agent 能力提升有限 | 仅作为回退 |

---

## 17. 工程交付范围建议

### 17.1 本阶段应完成

- Agent Bridge Sidecar；
- Pi SDK Runtime Adapter；
- ProjectFlow Tool Registry；
- 核心只读工具；
- 核心 Proposal 生成工具；
- 统一 Runtime Event；
- Tool Timeline 展示；
- Proposal Banner 展示；
- Policy Gate；
- 基础容器隔离；
- Legacy fallback；
- 基础验收测试。

### 17.2 本阶段不建议完成

- 完整 MCP Server；
- 完整 LangGraph 迁移；
- 多 Agent 协作系统；
- 长任务 checkpoint/resume；
- 自研 Agent Framework；
- 任意文件编辑 / shell 执行能力；
- 大规模权限系统；
- 复杂长期记忆系统。

这些内容可以作为后续版本演进。

---

## 18. 验收标准

### 18.1 功能验收

- 用户输入自然语言后，Agent 能创建一次 Run；
- Agent 能读取最新 WorkspaceState；
- Agent 能选择并调用至少一个 ProjectFlow Tool；
- 前端能展示工具调用过程；
- Agent 能生成至少一种 Proposal；
- Proposal 能被确认或拒绝；
- Confirm 后业务状态真实更新；
- Timeline 中能看到完整执行轨迹。

### 18.2 安全验收

- Agent 不能直接修改 DB；
- Agent 不能绕过 Proposal-Confirm；
- 禁用工具被请求时必须阻断；
- Confirm 必须来自用户操作；
- 重复 Confirm 不应产生重复写入；
- Bridge 容器不暴露宿主机敏感目录。

### 18.3 稳定性验收

- Bridge 重启不破坏数据库；
- Runtime 出错时前端有明确提示；
- FastAPI 可保留 legacy fallback；
- Seed/reset 后可复现演示流程；
- Tool 调用失败能写入 Timeline。

### 18.4 体验验收

- 用户能看懂 Agent 正在做什么；
- 工具调用过程不是黑盒；
- Proposal 内容结构清晰；
- Confirm / Reject 入口明显；
- Agent 结果能落到项目管理对象中，而不只是聊天回复。

---

## 19. 后续演进路线

### V1：训练营落地版

```text
Pi SDK Sidecar
+ Tool Contract
+ Proposal-Confirm
+ Tool Timeline
+ Basic Policy Gate
```

目标是快速完成 Agent 体验升级，并保证演示稳定。

### V2：标准化工具层

```text
ProjectFlow Tool Contract
→ MCP-compatible Tools / Resources / Prompts
```

目标是让 ProjectFlow 能被更多 Agent Host 调用，例如 Claude Code、Cursor、OpenCode 或其他 MCP Client。

### V3：Graph Runtime / 多 Agent

```text
Runtime Adapter
→ LangGraph / OpenAI Agents / Multi-Agent Runtime
```

目标是支持更复杂的长流程、暂停恢复、多 Agent 分工和更强的状态管理。

---

## 20. 最终推荐

综合训练营周期、当前项目性质、工程风险和后续扩展性，本方案的最终推荐是：

```text
短期：Pi SDK Sidecar 作为 Agent Runtime
中期：ProjectFlow Tool Contract 对齐 MCP
长期：通过 Runtime Adapter 迁移到 Graph / Multi-Agent 架构
```

该方案的价值在于：

- 训练营阶段可以快速交付；
- 不破坏 ProjectFlow 已有业务闭环；
- Agent 能力提升明显；
- 风险边界清晰；
- 后续技术债可控；
- 未来仍可演进到更标准、更强的 Agent 架构。

最终架构原则可以概括为：

> **Agent Runtime 负责思考与工具调用，ProjectFlow 负责事实源与确定性提交，Tool Contract 负责解耦，Proposal-Confirm 负责安全边界，Event Timeline 负责可观测体验。**

---

## 参考来源

- Pi SDK Documentation: https://pi.dev/docs/latest/sdk
- Pi Extensions Documentation: https://pi.dev/docs/latest/extensions
- Pi Skills Documentation: https://pi.dev/docs/latest/skills
- Pi RPC Documentation: https://pi.dev/docs/latest/rpc
- Pi Security Documentation: https://pi.dev/docs/latest/security
- Pi Containerization Documentation: https://pi.dev/docs/latest/containerization
- OpenAI Agents SDK: https://openai.github.io/openai-agents-python/
- OpenAI Agents SDK Human-in-the-loop: https://openai.github.io/openai-agents-python/human_in_the_loop/
- LangGraph Overview: https://docs.langchain.com/oss/python/langgraph/overview
- LangGraph Interrupts: https://docs.langchain.com/oss/python/langgraph/interrupts
- LangGraph Persistence: https://docs.langchain.com/oss/python/langgraph/persistence
- Model Context Protocol Overview: https://modelcontextprotocol.io/docs/learn/architecture
- MCP Tools Specification: https://modelcontextprotocol.io/specification/2025-06-18/server/tools
- OpenCode Server Documentation: https://opencode.ai/docs/server/
- OpenCode SDK Documentation: https://opencode.ai/docs/sdk/
- OpenCode Permissions Documentation: https://opencode.ai/docs/permissions/
- ProjectFlow Repository: https://github.com/wubq511/ProjectFlow
- ProjectFlow Technical Design: https://github.com/wubq511/ProjectFlow/blob/main/docs/TECH-DESIGN.md
- ProjectFlow API Contract: https://github.com/wubq511/ProjectFlow/blob/main/docs/api-contract.md
- ProjectFlow Runbook: https://github.com/wubq511/ProjectFlow/blob/main/docs/runbook.md
