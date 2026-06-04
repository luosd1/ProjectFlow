---
target: workspace page
total_score: 25
p0_count: 1
p1_count: 2
timestamp: 2026-06-04T12-00-58Z
slug: ntend-src-components-project-workspace-content-tsx
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | 无独立 loading skeleton；refreshKey 变化后无视觉反馈 |
| 2 | Match Between System and Real World | 3 | 中文统一，角色区分清晰；createdBy placeholder 暴露技术术语 |
| 3 | User Control and Freedom | 3 | Dialog 可关闭/返回；项目点击直接跳转无二次确认 |
| 4 | Consistency and Standards | 3 | shadcn 使用一致；成员管理表单使用原生 `<select>` 破坏一致性 |
| 5 | Error Prevention | 2 | 提交按钮 disabled 逻辑只检查非空；成员表单错误提示位置不统一 |
| 6 | Recognition Rather Than Recall | 3 | localStorage draft 自动保存好；技能列表未分组，需扫读 19 项 |
| 7 | Flexibility and Efficiency of Use | 2 | 无批量操作；项目/成员列表无搜索筛选；技能标签最多显示 4 个 |
| 8 | Aesthetic and Minimalist Design | 3 | 无多余装饰；header 区域信息密度偏低，右侧按钮与标题间空白大 |
| 9 | Error Recovery | 2 | 错误提示视觉层级弱；API 错误只显示 message，无重试机制 |
| 10 | Help and Documentation | 2 | workspace 页面本身无上下文帮助；新建项目提示不够具体 |
| **Total** | | **25/40** | **Acceptable** |

## Anti-Patterns Verdict

**LLM assessment**: 整体不算典型 AI slop，但有以下 tell：
- `StatCard` 使用 `rounded-2xl border border-neutral-200 bg-white p-5` 的通用 shadcn 默认风味堆叠，缺乏品牌辨识度
- 大标题 + 灰副标题的对比是 AI 生成页面最常见套路
- 双栏卡片布局左右完全对称，没有根据内容重要性调整比例
- 项目卡片 hover 状态是 Tailwind 默认调色板直接调用，未体现蓝金视觉体系独特性

**Deterministic scan**: 未检测到违规（0 issues）。

## Overall Impression

页面功能完整、结构清晰，但缺乏品牌辨识度和动态信息。Stats 区域是静态计数，没有趋势或洞察。成员和项目列表在数据量增大后扫描成本会急剧上升。整体处于"可用但平庸"的状态，对于"主动推进型 AI Agent"的产品定位来说，视觉和信息层面都过于被动。

## What's Working

1. **空状态设计扎实**: `EmptyState` 统一了图标+标题+描述+行动的 pattern，在成员和项目两个列表中都提供了明确的下一步引导，避免了死胡同。
2. **身份切换器融入导航**: `AppShell` 顶部的 `DropdownMenu` 将用户身份切换放在导航栏，不占用内容区空间，当前选中状态清晰。
3. **Draft 自动保存降低流失**: `project-intake-form.tsx` 的 localStorage draft 机制在表单较长时能有效减少用户因意外关闭而重复输入的挫败感。

## Priority Issues

**[P0] 成员管理表单使用原生 `<select>`**
- `member-management-dialog.tsx:236` 使用了原生 `<select>` 而非 shadcn Select
- 破坏表单一致性，样式与其他输入框不统一，且无法使用 shadcn 的 focus-visible:ring 等无障碍特性
- **Fix**: 替换为 `@/components/ui/select`
- **Suggested command**: `$impeccable polish`

**[P1] 项目/成员列表无搜索和筛选**
- 当项目或成员超过 5-6 个时，扫描成本急剧上升，违反"识别优于回忆"
- **Fix**: 在 `CardHeader` 添加 `Input` 搜索框，按名称实时过滤
- **Suggested command**: `$impeccable harden`

**[P1] 成员列表项无点击交互**
- `workspace-content.tsx:196` 成员列表项只有 hover 背景变化，用户可能期望点击成员查看详情或编辑
- 操作入口隐藏在"成员管理"按钮中，不够直接
- **Fix**: 成员列表项点击后直接打开该成员的编辑 Dialog，或添加"查看"按钮
- **Suggested command**: `$impeccable layout`

**[P2] createdBy placeholder 暴露技术术语**
- `project-intake-form.tsx:304` 的 placeholder 是 "UUID of project creator"
- 对大学生用户不友好，且与中文 UI 语言不一致
- **Fix**: 改为 "选填，默认使用当前用户" 或直接隐藏该字段
- **Suggested command**: `$impeccable clarify`

**[P2] 删除确认 Dialog 过于生硬**
- `member-management-dialog.tsx:592-600` 只有警告图标和"此操作不可恢复"
- 没有提供替代方案或缓和语气
- **Fix**: 添加"取消"按钮的突出样式，文案改为更具体的说明
- **Suggested command**: `$impeccable clarify`

## Persona Red Flags

**Alex (Power User)**
- `refreshKey` 只能通过重新打开页面或触发成员/项目变更来刷新，没有手动刷新按钮
- 项目列表没有排序选项（按截止日期、按状态、按名称），无法快速找到优先级最高的项目
- 成员列表不显示技能完整列表（最多 4 个），无法快速评估团队能力缺口

**Jordan (First-Timer)**
- 默认描述 "团队项目、成员能力和 Agent 推进状态集中在这里" 过于抽象，不知道"Agent 推进"是什么意思
- 新建项目表单没有步骤指示器，8 个字段 + 资源面板让 Jordan 感到压力
- createdBy 字段的 placeholder 是 "UUID of project creator"，Jordan 会困惑

**Sam (Accessibility)**
- 项目卡片使用 `<button>` 但没有 `aria-label`，屏幕阅读器只会读出项目名称
- 原生 `<select>` 与 shadcn 的 focus ring 不一致，键盘导航体验断裂
- 移动端 `MobileNav` 中没有包含用户切换功能，Sam 在移动端无法切换身份

## Minor Observations

1. `activeProjects` 过滤逻辑中包含了 `draft` 和 `at_risk`，与标签"活跃项目"的语义略有偏差
2. 三个 `StatCard` 都设置了 `prominent`，导致视觉权重相同，没有主次之分
3. 技能 badge key 使用 `${skill.name}-${skill.level}-${i}`，同名同等级技能可能冲突
4. `MemberManagementDialog` 传入 `onMembersChanged` 但 `WorkspaceContent` 没有使用 `refreshKey` 触发重新获取数据，是死状态
5. `isProjectDashboard` 判断逻辑复杂且脆弱，依赖 pathname 的 segment 数量

## Questions to Consider

1. **Workspace 页面本身是否必要？** 当前 `/workspaces/[workspaceId]` 直接重定向到第一个项目或新建项目，`WorkspaceContent` 实际上只在极少数场景渲染。这个页面的存在是为了未来扩展，还是当前路由结构的遗留？
2. **Stats 区域的价值是否被高估？** 三个 stat cards 都是静态计数，没有趋势、没有变化指示、没有可操作的洞察。对于"主动推进型 AI Agent"的产品定位，这些数字是否太被动了？是否应该替换为"最近 Agent 行动"、"待处理风险数"等动态信息？
3. **成员管理和新建项目的 Dialog 尺寸差异巨大**（`sm:max-w-lg` vs `max-w-3xl`），但它们在用户心智中应该是同等重要的操作。这种尺寸差异是否暗示了产品对"创建项目"的过度强调，而对"管理团队"的轻视？
