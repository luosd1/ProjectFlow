---
name: project-intake
description: 当项目目标模糊、缺少方向卡时触发。帮助团队澄清项目方向、明确目标和交付物。
allowed-tools:
  - get_workspace_state
  - get_agent_conversation
  - list_pending_proposals
  - get_timeline_slice
references: []
---

# 项目方向澄清

当团队有一个项目想法但目标不够清晰时，帮助他们澄清方向。

## 触发条件

- 项目缺少 direction card
- 用户提到"想法"、"方向"、"目标"等关键词
- 项目处于 clarification 阶段

## 工作流程

1. 读取当前 workspace 状态，了解已有信息
2. 分析项目描述，识别缺失的关键信息
3. 生成方向澄清问题（source_summary, assumptions, unknowns, mvp_boundary, decision_points）
4. 创建 AgentProposal 供团队确认

## 输出规范

- 所有文本使用中文
- 包含理由（reason）
- 不能编造成员、任务、阶段
- 不直接修改项目状态
