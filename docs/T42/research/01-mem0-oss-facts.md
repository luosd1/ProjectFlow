# 调研任务 1/4：Mem0 OSS 2026 技术事实深查

你是一位熟悉 Mem0、向量检索和 Python 后端集成的资深工程师。请对 **Mem0 OSS** 截至 2026 年 7 月的实际技术事实做深度核查，结论会直接决定 ProjectFlow 记忆系统 V1 是否采用 Mem0 作为检索引擎。每条结论必须附 **Mem0 官方文档链接或 GitHub commit/issue/release 链接 + 版本号**；禁止只引用第三方博客；无法确认的条目明确写"未确认"，不要编造。

---

## 一、项目背景（必读）

### ProjectFlow 是什么
面向大学生项目小队的**主动推进型 AI Agent**。核心价值不是记录任务，而是持续回答：项目该往哪走？下一步做什么？谁适合做什么？哪些有风险？计划是否调整？当前 MVP 已闭环，能围绕方向卡、阶段计划、任务拆解、分工建议、风险、巡检输出判断，但这些判断只依赖当前状态和最近一轮对话，存在"Agent 不知道当初为什么这么做"的致命问题。

### 技术栈
- 前端：Next.js + React + TypeScript + Tailwind + shadcn/ui
- 后端：FastAPI + Python 3.11 + SQLModel + SQLite（本地演示优先，零配置）
- Agent：legacy `CoordinatorAgent` → 正在重构为 T41 Agent Runtime（TypeScript sidecar + Pi runtime）

### T41 Agent Runtime 目标架构（记忆系统必须基于此底座）
- **FastAPI/DB 是唯一事实源**：Project/Stage/Task/AgentProposal/AgentEvent/AgentRunState 都在 SQLite。
- **TypeScript sidecar 是 runtime**：管 Pi session、tool registry、model routing、policy gate、event bridge、trace。**sidecar 不直接读写 DB，不保存业务事实**。
- **4 层写入边界**：Runtime Metadata / Reviewable Draft Record(AgentProposal) / Advisory Project Record(Risk,ActionCard) / Primary Project State(Project,Stage,Task,owner,date)。LLM-callable tool 只能创建 draft 或 advisory，不能 commit 主事实。
- **Proposal-Confirm 是唯一人类确认边界**：Agent 生成 proposal → 用户 confirm/reject → FastAPI deterministic commit。
- **Read-only state view 必须纯读**。
- **Tool 通过 FastAPI internal endpoint 执行**（`/internal/agent-tools/*`），sidecar 不直连 DB。
- T41 重构进行中（S3/S5/S14/S16 完成，193 tests pass），记忆系统是 T42 在 T41 完成后的功能增强。

### V3 Project Memory V1 设计方案（本次调研对象）
- **设计结论**：ProjectFlow 自建 `ProjectMemory` 治理表（SQLite/SQLModel）+ Mem0 OSS 作为检索引擎。事实源是 ProjectFlow 自己，Mem0 不是事实源。
- **链路**：Formal Project Event → MemoryExtractor → ProjectMemory 表 → Mem0 index/search → MemoryRetriever 二次过滤 → Agent Context
- **只从 4 类正式事件写入**：方向卡确认、proposal 拒绝、分工最终确认、replan 确认/拒绝。
- **检索**：Mem0 search top_k=12 → 回查 SQLite → 过滤 status/visibility/valid_until/project_id → 按场景重排 → 最多注入 6 条。
- **降级**：Mem0 不可用时走 SQLite 字段过滤 fallback。
- **外部依赖策略**：抽象 `MemoryIndexBackend`，首个实现 `mem0`；Mem0 失败不阻塞正式事件；Mem0 metadata 只作召回提示不作权限判断。
- **Mem0 接入边界**：只用 `add`/`search` + metadata filtering + embedding/keyword/entity 召回；**不用** Mem0 自动聊天捕获、不用 Pi plugin auto-capture、不用 Mem0 侧 delete/update 作为生命周期事实、不用 Mem0 Cloud 作默认、不让 Mem0 返回结果直接注入 Agent prompt。

### 调研结果用途
结论会喂给另一个 AI Agent（基于 Claude）做 V3 方案优化。要**具体、可执行、带链接/版本号**。

---

## 二、调研问题（逐条作答，每条附链接 + 版本号）

1. **版本与稳定性**：截至 2026-07，Mem0 OSS 最新稳定版本号、Python SDK 版本、release cadence、最近 12 个月 breaking change 历史。v2→v3 迁移具体改了什么（API、配置、存储格式）？现在 v3 是默认吗？

2. **`add()` 实际行为**：签名、参数、返回值。`add()` 默认会不会对输入文本做 **LLM 抽取**（消耗 token、可能改变或拆分内容）？如何**显式关闭抽取、只存原文**？这是 ProjectFlow "正式事件驱动写入、不让 Mem0 自动改写记忆内容" 的硬需求——如果 `add()` 默认会 LLM 抽取，那存进 Mem0 的就不是 ProjectFlow 治理表里的 content，回查会对不上。

3. **`search()` 实际行为**：签名、参数、返回值。`filters` 参数支持哪些操作符（eq / in / range / and / or）？按 `workspace_id` + `project_id` + `status` + `visibility` **多字段同时过滤**是否可靠？有没有已知 bug 或限制？`top_k` 怎么传？

4. **自动捕获默认值**：Mem0 是否有任何 auto-capture / auto-ingest 默认开启（监听对话、自动写记忆）？ProjectFlow 要的是"只由正式事件驱动写入"，必须确认所有自动捕获能完全关闭。

5. **检索算法**：BM25 + embedding + entity matching 的实际配置项和默认值。embedding provider 怎么配（OpenAI / OpenAI-compatible / sentence-transformers / 本地）？entity matching 依赖什么（LLM 抽实体？spacy？）？能不能只用 embedding + BM25 关掉 entity？

6. **向量存储对比**：Qdrant / Chroma / Weaviate / PGVector / Milvus 在 Mem0 OSS 下的实际支持度、metadata filter 完整性、自托管复杂度、license。重点：**Chroma 的 metadata filter 已知限制**（听说只支持等于，不支持 range/in，确认是否属实、2026 是否仍如此）。Qdrant 自托管最小部署是什么。

7. **self-hosted 部署形态**：最小依赖是什么（向量库 + embedding provider + Mem0 server？还是可以纯进程内无独立 server）？REST server 和 Python SDK 的差异、何时用哪个。ProjectFlow 后端是 Python，倾向 Python SDK 进程内调用，可行吗？

8. **隐藏 cloud 依赖 / 遥测**：Mem0 OSS 默认配置下是否有任何 cloud 调用、telemetry、数据上报？是否完全离线可用？是否需要任何 API key 才能启动（即使不用 OpenAI embedding）？

9. **幂等与重复写入**：重复 `add()` 同一条记忆（相同 content + metadata）会怎样？有 dedup 吗？`update()` / `delete()` 的语义是什么？ProjectFlow 不想用 Mem0 的 update/delete 作为记忆生命周期事实（用 SQLite 自己的 superseded 状态管理），只想 add + search，可行吗？

10. **性能**：典型 `add` / `search` 延迟（Qdrant 本地、1k–100k 条记忆规模）。metadata filter 对性能影响。embedding 调用是同步阻塞还是异步？批量 add 支持吗？

11. **Mem0 Platform（cloud）vs OSS**：功能差异、价格模型、数据出境考量。ProjectFlow V1 明确不把 Cloud 作默认依赖，但要知道如果未来切 Cloud 需要改什么。

12. **与 ProjectFlow "正式事件驱动" 模式的契合度**：综合判断 Mem0 OSS 能不能真的"只做索引层，不接管记忆生命周期"。有没有实际用 Mem0 做过类似"治理层在外、Mem0 只做检索"的集成案例（GitHub issue / blog / 项目）？

---

## 三、输出格式

按问题编号逐条回答，每条结构：

```
### N. <问题标题>
**结论**：<具体事实，含版本号>
**依据**：<官方文档/GitHub 链接，可多条>
**对 ProjectFlow 的影响**：<这条对 V1 采用 Mem0 的影响，如"阻塞"/"需配置 X"/"无影响">
**未确认项**：<如有>
```

最后给一段 **总评**：基于以上 12 条，Mem0 OSS 是否适合作为 ProjectFlow V1 的 `MemoryIndexBackend`？有哪些必须在接入前解决的配置项或风险？

不要写"记忆很重要"之类的泛论。不要引用 IBM/AWS/HPE 营销博客。只要 Mem0 的一手事实。
