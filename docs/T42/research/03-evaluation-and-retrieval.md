# 调研任务 3/4：记忆评估基准 + 检索与注入设计最佳实践

你是一位熟悉 RAG、记忆系统评测和 LLM 上下文工程的资深工程师。请对"AI Agent 长期记忆的评估方法、检索 reranker、上下文注入预算"做深度调研，结论用于优化 ProjectFlow 记忆系统 V1 的检索流程和验收标准。每条结论附 **文献/项目/官方链接**；区分"V1 就该做"和"V1.1+ 再考虑"。

---

## 一、项目背景（必读）

### ProjectFlow 是什么
面向大学生项目小队的**主动推进型 AI Agent**。核心价值不是记录任务，而是持续回答：项目该往哪走？下一步做什么？谁适合做什么？哪些有风险？计划是否调整？当前 MVP 已闭环，但 Agent 只依赖当前状态和最近一轮对话，存在"不知道当初为什么这么做"的致命问题。

### 技术栈
- 前端：Next.js + React + TypeScript + Tailwind + shadcn/ui
- 后端：FastAPI + Python 3.11 + SQLModel + SQLite
- Agent：legacy `CoordinatorAgent` → T41 Agent Runtime（TypeScript sidecar + Pi runtime）

### T41 Agent Runtime 目标架构（记忆系统必须基于此底座）
- FastAPI/DB 是唯一事实源；sidecar 不读写 DB；4 层写入边界；Proposal-Confirm 唯一人类确认边界；Tool 走 FastAPI internal endpoint。
- 记忆系统是 T42 功能增强。

### V3 Project Memory V1 设计方案
- ProjectFlow 自建 `ProjectMemory` 治理表 + Mem0 OSS 检索。
- **检索流程**：Mem0 search `top_k=12` → 回查 SQLite → 过滤 status/visibility/valid_until/project_id → 按场景重排 → 最多注入 6 条。
- **按场景重排**（V3 已定义）：
  - clarification/direction：direction > boundary > tradeoff > rejection
  - replanning：direction > boundary > plan > tradeoff > rejection
  - assignment/negotiation：member_constraint > assignment > plan > tradeoff
  - proposal_rejection：rejection > tradeoff > boundary > direction
- **同分优先级**：直接关联对象 > 最近更新 > 来源更正式 > memory_type 更匹配 event_type。
- **降级**：Mem0 不可用走 SQLite 字段过滤 fallback，最多注入 4–6 条。
- **注入**：XML 标签 `<project_memories>` 包裹，最多 6 条，不注入 superseded/archived/过期/不可见。
- **AgentEvent 记录**：`memory_used` / `memory_backend` / `used_memory_ids`。
- **V1 不做**：reranker、时间衰减、自动冲突裁决、记忆重建。
- **memory_type**：direction / boundary / plan / assignment / tradeoff / rejection / member_constraint。
- **scope**：project / stage / task / member / risk。

### 调研结果用途
结论喂给另一个 AI Agent（基于 Claude）优化 V3 检索流程和验收标准。要具体、带链接、可执行。

---

## 二、调研问题

### 2.1 评估基准

1. **LoCoMo**：测什么（长对话一致性？）、数据集规模、指标定义、论文来源。能否适配 ProjectFlow 这种"项目决策记忆"（非长对话）场景？怎么适配？
2. **LongMemEval**：同上。它评的是"多会话长期记忆"，ProjectFlow 是"多轮项目推进决策"，差异在哪？
3. **BEAM**：Mem0 的评测框架，实际测什么、能不能直接拿来用、依赖什么。
4. **ProjectFlow 自建评测**：怎么搭一个最小评测 harness（mock LLM + 固定项目场景 + 断言记忆被正确召回/未污染）？给具体结构和指标定义。
5. **关键指标**：记忆检索准确率、覆盖率、延迟、增长率、一致性失效率、降级率——这些怎么定义、怎么埋点、目标值定多少合理。

### 2.2 检索与 reranker

6. **top_k=12 → inject 6 这个 funnel 合理吗**：业界典型 memory/RAG 的召回-注入比是多少？12 召回会不会太少（漏召回）或太多（噪声）？
7. **reranker**：cross-encoder / LLM reranker / MMR / Cohen's d 何时用。ProjectFlow V1 明确不做 reranker，这个决定对召回质量影响多大？V1.1 加 reranker 的最小实现是什么？
8. **Mem0 自带的 BM25 + embedding + entity matching 已经算多路召回**：还需要额外 reranker 吗？还是 Mem0 返回的 score 直接用就够？
9. **场景重排的 scoring 函数**：V3 用的是"类型优先级 + 同分 4 规则"。这种硬编码优先级 vs 学习排序 vs LLM rerank，业界怎么做？给 ProjectFlow 的具体建议。

### 2.3 上下文注入预算

10. **token 预算分配**：6 条记忆 + WorkspaceState + pending proposals + recent messages + timeline slice 一起塞 prompt，怎么分配 token？记忆占多少合理？
11. **记忆条数 vs 内容长度**：6 条是按条数限，还是按 token 限更合理？每条 ProjectMemory 的 content + rationale 典型多长？
12. **记忆污染防护**：无关记忆干扰 LLM 推理怎么防。需要相关性阈值吗？阈值怎么定？
13. **去重**：同一决策产生 direction + boundary 两条记忆，检索时怎么去重或合并展示？业界 pattern。

### 2.4 时间与生命周期

14. **时间衰减**：旧记忆应否降权？什么衰减函数（exponential / recency-bias / linear）？V3 的 `valid_until` + `superseded` 是否够，还是需要显式衰减？给 V1 建议。
15. **"为什么当初这么做"的检索时机**：每次 run 开始检索 vs 每个 tool call 前 vs 只在特定 skill 触发？agentic retrieval（让 LLM 主动调检索工具）vs 固定注入，哪个更适合 ProjectFlow？

### 2.5 V1 验收

16. **V3 的 12 条验收标准**（见背景）是否可测试、可交付？补哪些关键验收项（如检索延迟上限、召回率下限、降级切换成功率）？

---

## 三、输出格式

按问题编号逐条回答：

```
### N. <问题>
**结论**：<具体建议>
**依据**：<文献/项目链接>
**V1/V1.1 归属**：<V1 就该做 / V1.1+ 再考虑>
**对 V3 的具体改动**：<如改 top_k、加字段、改流程——可空>
```

最后给：
- **V1 必做项清单**（基于本次调研，V1 检索/评估必须补的东西）
- **V1.1+ 候选清单**
- **最小评测 harness 设计**（一段具体方案，含指标和断言）

不要泛论"记忆很重要"。每条要有文献或项目链接。
