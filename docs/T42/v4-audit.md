# V4 设计方案审核报告

> 审核 object：`docs/T42/project-memory-design-v4.md`
> 审核基准：T41 设计文档（目标架构，以文档为准）+ 当前代码（T41 未完成部分以文档为准）
> 审核时间：2026-07-05

## 一、总评

V4 整体质量高：T41 底座边界遵守严格、选型有外部验证、4 类事件给了代码改造方案、表结构干净。**可以进入 issue 拆分**，但有 **3 个 P0 阻塞项**必须在动手前定方案，否则实现时会卡住或返工。另有 5 个 P1、3 个 P2。

V4 最值得肯定的几点：
- T41 边界合规：sidecar 不读 DB、记忆走 context-builder 不走 LLM tool、extractor 在 FastAPI、不扩 AgentEventType、read-only 纯读。全部对齐 T41 文档。
- 选型翻转（sqlite-vec 默认 + Mem0 可选）有腾讯 6.4k stars 方案背书，且保持零配置。
- 4 类正式事件逐条给代码落点，是 V3 最大的空洞被补上了。
- `ProjectMemorySync` 拆表 + 幂等唯一索引 + 可见性 2 档 owner 按作用域，都合理。

## 二、P0 阻塞项（动手前必须定方案）

### P0-1：`reject_proposal` 写 AgentEvent 的语义未解决

**问题**：V4 要求 `reject_proposal` 写一条 timeline AgentEvent，并说"复用 `AgentEventType` 现有值 + `AgentEventStatus.failed` 标记 rejected"。但核对 `enums.py`：`AgentEventStatus` 只有 `success/repaired/fallback/failed`，**没有 `rejected`**。用 `failed` 表示"被拒绝"是语义重载——`failed` 现在表示"agent 事件失败/兜底"，前端 timeline 和 parity test 都按这个语义用。重载会让"真正的失败"和"用户主动拒绝"混在一起。

**而且**：`confirm_proposal` 写的 AgentEvent 用 `event_type=AgentEventType(proposal.proposal_type)`（如 clarify）。如果 reject 也用同 event_type，那同一 proposal 的 confirm 和 reject 两条事件只靠 status 区分，现有按 event_type 过滤的 timeline 查询会被污染。

**要决策**（三选一）：
- (a) 新增 `AgentEventStatus.rejected`——只扩 AgentEventStatus（4→5 值），不动 AgentEventType。影响最小，但仍是 enum 变更，要查前端 timeline 渲染和 parity test。
- (b) 不写 AgentEvent，`proposal_rejected` 的 `source_id` 直接指 `AgentProposal.id` + 用 `AgentProposal.status==rejected` + `rejection_reason` 作事实源。extractor 在 `reject_proposal` 末尾直接调，不经过 AgentEvent。**这条最干净**——因为 `AgentProposal` 本身就记录了拒绝（status + rejection_reason），不需要再造一个事件。
- (c) 在 `AgentEvent.output_snapshot` 里加 `action: "reject_proposal"` 标记，status 仍用现有值。结构化但隐式。

**我的建议**：选 **(b)**。`AgentProposal` 已经是拒绝的事实记录（status=rejected, rejection_reason），`source_id=AgentProposal.id` 即可，不需要再写 AgentEvent。`direction_card_confirmed`/`replan_confirmed` 的 source_id 也是 `AgentProposal.id`，这样 4 类事件的 source_id 语义统一为"产生该决策的 proposal 对象 id"，一致性更好。**这条同时解决 P1-5（source_id 不一致）**。

### P0-2：FTS5 + jieba 在 Python SQLModel 里的实现路径未定

**问题**：V4 检索依赖 SQLite FTS5 + jieba 中文分词。但核对代码：**项目里没有任何 FTS5 用法**，是纯新增。SQLite FTS5 内置 tokenizer 是 `simple`/`unicode61`，**不支持 jieba**。在 Python + SQLModel 里接 jieba 有三种实现路径，复杂度差很多：

- (a) **FTS5 external content + Python 预分词**：写入前用 jieba.cut 把 content 分词成空格分隔的 token 串，存进 FTS5 虚拟表。检索前同样分词 query。简单可控，但要维护 ProjectMemory ↔ FTS5 索引的同步（写入/删除/supersede 都要同步 FTS5 行）。
- (b) **SQLite FTS5 jieba tokenizer 扩展**（如 `simpletokenizer` C 扩展或 `jieba` 的 SQLite 扩展）：原生支持，但要编译/加载扩展，跨平台麻烦（macOS/Linux/Windows 的 .so/.dylib/.dll），破坏零配置。
- (c) **不用 FTS5，用 Python 侧 BM25**（如 `rank_bm25` 库）：检索时在 Python 里跑 BM25 over 所有 active memory。零 SQLite 扩展依赖，但千条以上性能差，且要全量加载到内存。

**我的建议**：选 **(a)**。FTS5 external content + Python jieba 预分词。零扩展依赖，跨平台一致，性能够（百~千条）。代价是要写 FTS5 索引同步逻辑（ProjectMemory 写入/删除/supersede 时同步 FTS5 行），但这本就是 `MemoryIndexBackend.index()` 的职责。V4 应在「检索流程」节明确这个实现路径，否则实现的人会卡在"FTS5 怎么接 jieba"。

### P0-3：extractor "事务后异步" 的实现机制未定

**问题**：V4 说 extractor "在 `session.commit()` 之后异步调用，不阻塞正式事件"。但核对代码：**项目里没有任何后台任务基础设施**（无 FastAPI BackgroundTasks、无 celery/rq、无 asyncio.create_task）。当前 service 全是同步的。

"异步"要落到具体机制，三选一：
- (a) **FastAPI BackgroundTasks**：route 层把 extractor 作为 background task 挂在 response 后。简单，同进程，进程崩了丢任务。对"best effort"可接受。但要求 extractor 在 route 层调用，不能在 service 层（因为 service 层拿不到 BackgroundTasks 对象）——这会改变 V4 说的"业务 service 内部调用"结构。
- (b) **同步调用 + try/except 吞掉异常**：extractor 在 commit 后同步调，失败只记日志不抛。简单，但会增加正式事件的响应延迟（多一次 DB 写 + 索引同步）。对百~千条记忆、本地索引，延迟可能 50–200ms，可接受。
- (c) **引入轻量任务队列**（如 RQ + Redis）：过重，V1 不该引入。

**我的建议**：V1 选 **(b) 同步 + 吞异常**。理由：最简单、不引入新依赖、不改变 service 层结构、延迟可接受（本地 sqlite-vec + FTS5 写入快）。extractor 写在 service 层 `commit()` 之后、`return` 之前，包在 try/except 里。V1.1 如果延迟成问题再上 BackgroundTasks。V4 应明确写这个机制。

## 三、P1 应解决

### P1-1：replan 路径 (b) 覆盖缺口是真实的

**问题**：V4 说"V1 只 hook 路径 (a) `confirm_proposal(proposal_type=replan)`，路径 (b) `replan_service.confirm_replan` 的统一属于 T41"。但核对：`replan_service.confirm_replan` 被 `routes_replans.py:api_confirm_replan` 直接调用，**是 live API**。用户通过这个 API 确认 replan 不会产生记忆。这不是理论缺口，是实际覆盖空洞。

**建议**：V4 明确标注这是 V1 已知覆盖缺口，在验收标准里加一条："通过 `routes_replans.py` 确认的 replan 不产生 ProjectMemory（V1.1/T41 统一 replan 路径后补）"。同时推动 T41 把 replan 路径统一列为待办（V4 已提，但要进 T41 issue tracker）。

### P1-2：幂等 "skip or supersede" 规则未定

**问题**：V4 说 extractor 写入前查幂等键，"命中则跳过或 supersede"。但什么时候跳过、什么时候 supersede 没说。例：方向卡被重新确认（内容变了）→ source_hash 变 → 不命中 → 新建 memory，旧的该 supersede 吗？如果该，怎么找到要 supersede 的旧 memory（按 project_id + memory_type=direction 找 active 的）？

**建议**：V4 加一节明确规则：
- 幂等键命中（同 source_hash）→ 跳过（事件没变，记忆不用重生）。
- 幂等键不命中但同 `project_id + source_type + source_id + memory_type` 有 active memory → 说明同事件内容变了 → 新建 memory + 把旧的标 `superseded`（`superseded_by_memory_id` 指新）。
- 全新事件 → 直接新建。

### P1-3：`memory_backend` 枚举值不一致

**问题**：V4 AgentEvent 示例写 `"memory_backend": "sqlite_vec | fts5 | field_filter | none"`，但降级链里 mem0 也是可能值（Mem0 可选实现启用时）。枚举不完整。

**建议**：统一为 `sqlite_vec | mem0 | fts5 | field_filter | none`，V4 所有出现处对齐。

### P1-4：eval recall 目标不一致

**问题**：V4「评估」节 harness 断言写"recall = 100%"，「关键指标」写"recall >= 90%"。

**建议**：统一为 `>= 90%`。手造 10 条记忆 5 个 query，90% 更诚实（允许 1 条漏召回），100% 会让实现的人为了过测试硬调。

### P1-5：source_id 语义不一致（P0-1 选 (b) 后自动解决）

4 类事件的 source_id：V4 现写法是 `AgentProposal.id` / `AgentEvent.id` / `AssignmentProposal.id` 混用。若 P0-1 选 (b)，`proposal_rejected` 的 source_id 改为 `AgentProposal.id`，则 4 类统一为"产生该决策的 proposal 对象 id"（AgentProposal 或 AssignmentProposal，两类 typed source）。仍有两类 source model，但语义统一。V4 应明确写"source_id 指产生该正式决策的 proposal 对象"。

## 四、P2 次要

### P2-1：embedding 模型懒加载
V4 默认 `bge-small-zh`（~100MB）。若在 FastAPI 启动时同步加载，会阻塞启动。建议 lazy-load（首次检索时加载），V4 加一句。

### P2-2：`memory_service` 位置未定
V4 多处引用 `memory_service` 但没说放哪。建议 `backend/app/services/memory_service.py`（业务逻辑层），extractor 在 `backend/app/agent/memory/`（Agent 域）。V4 加一句。

### P2-3：100MB 模型下载与零配置承诺
bge-small-zh 首次下载 100MB，对"零配置演示"是摩擦。建议：首次启动检测模型不在则后台下载 + 提示，检索在模型就绪前走 FTS5 fallback。V4 加一句说明。

## 五、T41 对齐核查（以 T41 文档为准）

逐条核对 V4 vs T41 设计文档：

| T41 边界 | V4 是否遵守 | 备注 |
|---|---|---|
| DB 唯一事实源 | ✅ | ProjectMemory 在 SQLite，检索引擎不是事实源 |
| sidecar 不读写 DB | ✅ | 检索走 FastAPI，sidecar 只接收 project_memories 字段 |
| 4 层写入边界 | ✅ | ProjectMemory 是新的治理表，不属 Primary State；extractor 在 FastAPI service |
| Proposal-Confirm 唯一人类确认边界 | ✅ | 记忆抽取挂在 confirm/reject/finalize 之后，不改变确认边界 |
| read-only 纯读 | ✅ | 检索不改 Project/Stage/Task |
| Tool 走 FastAPI internal endpoint | ✅ | 记忆不是 LLM tool，走 context-builder |
| AgentRunState | ⚠️ | V4 没说记忆使用是否进 `AgentRunState.side_effects`。建议不进（记忆是 context 输入不是 tool side effect），只在 AgentEvent 记录。V4 明确一句。 |
| 不扩 AgentEventType | ✅ | V4 遵守（P0-1 选 (b) 后更彻底，连 AgentEvent 都不新增） |
| skill allowed-tools | ✅ | 记忆不是 tool，不进 allowed-tools |
| context-builder dynamic suffix | ✅ | project_memories 加进 dynamic suffix |

**一处建议补充**：T41 `AgentRunState.side_effects` 是 tool 副作用记录。记忆检索不是 tool call，不应进 side_effects。V4 应明确"记忆使用只记 AgentEvent.output_snapshot，不进 AgentRunState.side_effects"，避免实现的人误把记忆当 tool side effect。

## 六、代码引用核查

| V4 引用 | 代码实际 | 核查 |
|---|---|---|
| `Project.created_by` | `project.py:19` 存在 | ✅ |
| `Task.owner_user_id` | `task.py:17` 存在 | ✅ |
| `AssignmentProposal.finalize_assignment_proposal` | `assignment_service.py:218` 存在 | ✅ |
| `confirm_proposal(proposal_type=clarify)` → `_persist_clarification` | `agent_proposal_service.py:86` + `:181` | ✅ |
| `reject_proposal` 不写 AgentEvent | `agent_proposal_service.py:159` 确认 | ✅（V4 改造点属实） |
| `replan_service.confirm_replan` 不创建 AgentProposal | `replan_service.py:11` 确认 | ✅ |
| `replan_service.confirm_replan` 被 live API 调用 | `routes_replans.py:12` | ✅（P1-1 缺口属实） |
| `AgentEventType` 无 memory/direction | `enums.py:121` 确认 | ✅ |
| `AgentEventStatus` 无 rejected | `enums.py:135` 确认 | ✅（P0-1 问题属实） |
| 项目无 FTS5/jieba 用法 | grep 空 | ✅（P0-2 属实） |
| 项目无后台任务基础设施 | grep 空 | ✅（P0-3 属实） |

## 七、审核结论

V4 方向正确、边界合规、选型有据。**P0 三项是实现前的设计补全，不是方案缺陷**：

1. P0-1：`proposal_rejected` 不写 AgentEvent，source_id 直接指 `AgentProposal.id`（顺带统一 source_id 语义）。
2. P0-2：FTS5 + jieba 用 external content + Python 预分词路径，写进 V4 检索节。
3. P0-3：extractor 用同步 + try/except 吞异常，不引入后台任务基础设施。

P1 五项是文档清晰度问题，fold 进 V4 时补写即可。

**建议**：把 P0/P1 的决策 fold 进 V4 产出 v4.1（小版本），然后开始拆 vertical-slice issues。不需要再走一轮调研。
