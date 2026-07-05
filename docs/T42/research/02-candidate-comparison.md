# 调研任务 2/4：记忆系统候选项目 2026 状态对比

你是一位熟悉 AI Agent 记忆生态的资深架构师。请对以下记忆/持久化候选项目做 2026 年 7 月的现状核查与对比，结论决定 ProjectFlow 记忆系统 V1 的选型确认和 V2 升级路径。每个结论附 **GitHub/官方链接 + 版本号或最近 commit 日期**；无法确认写"未确认"。

---

## 一、项目背景（必读）

### ProjectFlow 是什么
面向大学生项目小队的**主动推进型 AI Agent**。核心价值不是记录任务，而是持续回答：项目该往哪走？下一步做什么？谁适合做什么？哪些有风险？计划是否调整？当前 MVP 已闭环，但 Agent 只依赖当前状态和最近一轮对话，存在"不知道当初为什么这么做"的致命问题。

### 技术栈
- 前端：Next.js + React + TypeScript + Tailwind + shadcn/ui
- 后端：FastAPI + Python 3.11 + SQLModel + SQLite（本地演示优先，零配置）
- Agent：legacy `CoordinatorAgent` → 正在重构为 T41 Agent Runtime（TypeScript sidecar + Pi runtime）

### T41 Agent Runtime 目标架构（记忆系统必须基于此底座）
- **FastAPI/DB 是唯一事实源**。
- **TypeScript sidecar 是 runtime**，**不直接读写 DB，不保存业务事实**。
- **4 层写入边界**：Runtime Metadata / Reviewable Draft Record / Advisory Project Record / Primary Project State。LLM-callable tool 只能创建 draft 或 advisory，不能 commit 主事实。
- **Proposal-Confirm 是唯一人类确认边界**。
- **Tool 通过 FastAPI internal endpoint 执行**，sidecar 不直连 DB。
- 记忆系统是 T42 在 T41 完成后的功能增强。

### V3 Project Memory V1 设计方案
- **设计结论**：ProjectFlow 自建 `ProjectMemory` 治理表 + Mem0 OSS 检索引擎。事实源是 ProjectFlow 自己。
- **硬约束**：记忆系统只是**可替换检索层**，不能是"另一个 Agent 平台"、不能接管 runtime、不能自动改写 agent 行为、不能需要把 ProjectFlow 会话全部交给外部 harness。
- **V1 已选 Mem0 OSS**；本次调研要独立验证这个选择，并评估 V2 候选。
- **V1 候选对比表（V3 方案里给出的，请独立核实并纠错）**：
  - Mem0 OSS：V1 采用
  - Graphiti / Zep：V2 候选（temporal context graph，需 Neo4j/FalkorDB/Neptune）
  - Cognee：V2 知识库候选（document ingestion pipeline）
  - Letta：不采用（stateful agent harness，和 T41 sidecar 重叠）
  - LangGraph / LangMem：借鉴，不采用为主实现

### 调研结果用途
结论喂给另一个 AI Agent（基于 Claude）做 V3 方案优化。要具体、带链接。

---

## 二、调研问题

### 2.1 逐个候选核查（每个都查：活跃度 / 定位 / 依赖 / license / 是否接管 runtime / 与 T41 契合度 / V2 迁移可行性）

对以下每个项目，给出结构化评估：

1. **Mem0 OSS**（已选，重点核实 V3 对比表里的描述是否准确）
2. **Graphiti**（getzep/graphiti）
3. **Zep**（getzep/zep，社区版）和 **Zep Cloud**
4. **Cognee**（topoteretes/cognee）
5. **Letta**（letta-ai/letta，原 MemGPT）
6. **LangMem + LangGraph**（langchain-ai 的长期记忆 + runtime）

### 2.2 补充候选（V3 没列的，请补充评估）

7. **Mem0 Platform（cloud）**：和 OSS 的差异、价格、数据出境。
8. **sqlite-vss / sqlite-vec**：SQLite 原生向量扩展，能否让 ProjectFlow 不引入独立向量库就做语义检索？
9. **pgvector**：如果未来 ProjectFlow 从 SQLite 迁到 Postgres，pgvector 作检索层的可行性。
10. **Chroma-only**（不用 Mem0，直接用 Chroma SDK）：Mem0 之外的最小替代。
11. **自研检索层**：纯 SQLite FTS5 + sentence-transformers embedding + 手写 rerank，不用任何记忆框架。开发成本、召回质量、运维成本。
12. **其他你发现的相关候选**（如 Zilliz/Milvus、Weaviate、Marqo、A-MEM 等，如有遗漏请补）。

### 2.3 关键判断题

13. **"纯 SQLite FTS5 + embedding" 不用 Mem0 的 tradeoff**：对 ProjectFlow 这种"4 类正式事件、记忆条目不多（单项目估计百到千条）、召回质量要求中等"的场景，自研够不够？省下 Mem0 的依赖和运维是否值得？给出明确推荐。

14. **V2 升级路径**：如果 V1 用 Mem0 OSS，V2 想引入 Graphiti 做时序图谱，`ProjectMemory` 表能否平滑迁移？需要哪些前置设计（如事件流结构）？

15. **"接管 runtime" 红线**：Letta、Cognee、LangGraph 这些里，哪些会要求把 agent loop 交给它们？哪些能严格只当库用？这是 ProjectFlow 硬约束。

16. **依赖雪球**：每个候选的传递依赖（图数据库、向量库、LLM provider、特定框架版本）。ProjectFlow 后端是 Python 3.11 + FastAPI + SQLModel，哪些候选会强制改技术栈。

---

## 三、输出格式

### Part A：每个候选一张评估卡

```
### <项目名>
**活跃度**：最近 commit / 最新 release / star 数 / 是否维护中
**核心定位**：<memory layer / agent platform / knowledge graph / persistence / ...>
**必需依赖**：<图库？向量库？LLM？框架？>
**License**：<license + 是否商用友好>
**是否接管 runtime**：<是 / 否 / 可选>
**与 T41 契合度**：<高/中/低 + 理由>
**V2 迁移可行性**：<从 ProjectMemory 表迁过去的成本>
**依据**：<GitHub/官方链接>
**结论**：<采用 / V2 候选 / 不采用 + 一句理由>
```

### Part B：对比表

| 候选 | 定位 | 依赖雪球 | 接管 runtime | T41 契合 | V1 适用 | V2 适用 |

### Part C：关键判断题 13–16 的逐条回答

### Part D：最终推荐

给 ProjectFlow 的明确建议：
- V1 检索层用什么（Mem0 OSS / 自研 / 其他）
- V2 升级路径候选排序
- 如果选 Mem0 OSS，有哪些前置条件必须满足

不要写泛论。不要引用营销博客。每个结论要有 GitHub 或官方文档链接。
