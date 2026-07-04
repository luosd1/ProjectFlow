## 概述

基于 PRD/TECH-DESIGN/MVP-Usable-Ready 三份文档对四个板块（项目总览、方向卡、阶段任务、项目复盘）的审查，完成以下修复。

## 改动清单

### 文本可读性（4 个文件）
- direction-decision-view.tsx — 7 处 break-all → break-words
- direction-card-panel.tsx — 移除 uppercase tracking，步骤描述优化
- risk-card.tsx — 证据标签移除 uppercase tracking
- timeline.tsx — 3 处 uppercase tracking 移除

### 交互安全 — Inline 二次确认（6 个文件）
- 新增 use-inline-confirm.ts hook
- 5 个 HIGH 级别按钮加上确认：行动卡完成、提案拒绝、风险忽略、风险解决、任务卡完成

### 卡片样式统一（10 个文件）
- 建立 Surface / Sub-card / Empty-state / Accent 四种卡片变体
- 统一 rounded-xl border-neutral-200 bg-white shadow-sm

### PRD 字段补全（4 个文件）
- 方向卡补充 6 个字段
- normalize_direction_card() 保留新增字段
- 10 个任务补充 backup_owner + assignment_reason
- StagePlanBoard 增加 done_criteria 渲染

### 导出中文（1 个文件）
- routes_export.py 状态值/严重度/类型翻译

### 复盘 Agent 总结（7 个文件）
- 新增 AgentEventType.retrospective
- 新增 RetrospectiveOutput schema
- 新增 modules/retrospective.py
- 新增 POST /api/agent/retrospective
- 复盘页新增 AI 复盘面板

### 方向卡视觉重构（1 个文件）
- 5 个色块分区 + 图标标题 + 子标题对比度提升

### 文档同步（7 个文件）
- CLAUDE.md、handoff.md、api-contract.md、TECH-DESIGN.md、code-wiki.md、runbook.md、setup-guide.md

## 统计

- 38 files changed
- +1067 insertions
- -324 deletions
