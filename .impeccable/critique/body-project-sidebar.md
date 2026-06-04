## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | 当前视图高亮清晰，但 badge 数字在 collapsed 状态不可见 |
| 2 | Match System / Real World | 4 | 中文标签自然，图标与语义匹配良好 |
| 3 | User Control and Freedom | 3 | Ctrl+B 快捷键支持，但无撤销/返回上一视图机制 |
| 4 | Consistency and Standards | 3 | 分组 divider 一致，但 workspace 展开项与其他菜单项样式不统一 |
| 5 | Error Prevention | 3 | disabled 状态有 title 提示，但无视觉区分 |
| 6 | Recognition Rather Than Recall | 4 | 图标+文字标签，collapsed 状态有 title 提示 |
| 7 | Flexibility and Efficiency | 3 | 支持 collapsed 模式，但无键盘导航到具体菜单项 |
| 8 | Aesthetic and Minimalist Design | 3 | 整体简洁，但 workspace 展开区域增加视觉噪音 |
| 9 | Error Recovery | 3 | 页面刷新后保留视图状态（URL query），但无显式恢复提示 |
| 10 | Help and Documentation | 2 | 无帮助入口，新用户可能不理解"方向卡"等术语 |
| **Total** | | **31/40** | **Good** |

## Anti-Patterns Verdict

**LLM assessment**: 整体美学可信，不落 AI 模板陷阱。蓝金配色克制，圆角 12px 合理，无渐变文字/编号标记。但存在 4 处 uppercase eyebrow（agent-sidebar ×2、workspace-content ×1、new/page ×1），属于典型的 SaaS 模板残留。

**Deterministic scan**: detector 返回 `[]`（零发现）。手动检查发现：
- 3 处 ghost-card（workspace-content.tsx: StatCard prominent + shadow-sm；Card ×2 带 shadow-sm）
- 4 处 uppercase eyebrow（agent-sidebar L231/L330、workspace-content L110、new/page L16）
- 无其他严重反模式

**Visual overlays**: 未执行浏览器注入（无运行中的 dev server）。

## Overall Impression

三栏布局结构清晰，导航分组逻辑合理（规划/执行/复盘），蓝金视觉体系专业。最大机会：修复 uppercase eyebrow 残留和 ghost-card 样式，统一 workspace 区域与菜单的视觉层级。

## What's Working

1. **导航分组逻辑清晰**：OVERVIEW_GROUP（项目总览/方向卡/阶段计划）和 EXECUTION_GROUP（我的任务/团队任务/签到/风险）的信息架构符合用户心智模型，divider 分隔明确。
2. **Collapsed 状态可用**：hover 展开、toggle 按钮、快捷键（Ctrl+B）三重机制，兼顾效率和空间节省。
3. **Badge 数字实用**：团队任务和风险预警的实时计数让用户一眼看到需要关注的内容。

## Priority Issues

**[P1] Uppercase eyebrow 残留（AI slop 标记）**
- What: agent-sidebar.tsx L231/L330、workspace-content.tsx L110、new/page.tsx L16 使用 `uppercase tracking-wider` 作为 section header
- Why it matters: 这是 2023-era SaaS 模板最典型的 AI 痕迹，impeccable 明确列为 absolute ban
- Fix: 改为正常大小写 + 适当字重（如 `text-xs font-semibold text-neutral-400`）
- Suggested command: `$impeccable quieter sidebar-headers`

**[P1] Ghost-card 样式（border + shadow 叠加）**
- What: workspace-content.tsx L52 StatCard prominent 时 `border + shadow-sm`；L157/L237 Card 组件 `border-neutral-200 bg-white shadow-sm`
- Why it matters: impeccable 明确禁止同一元素同时出现 border 和 ≥16px blur 的 shadow（此处 shadow-sm 为 8px，但 border+shadow 仍属 ghost-card 模式）
- Fix: 去掉 Card 的 `shadow-sm`，或去掉 border 改用纯 shadow；StatCard 去掉 prominent 的 shadow
- Suggested command: `$impeccable quieter workspace-cards`

**[P2] Workspace 展开区域视觉噪音**
- What: project-sidebar.tsx L267-348 workspace 展开后，内部按钮样式（text-xs、px-2 py-1.5）与外部菜单项（text-sm、px-2 py-2）不统一，且"暂无其他工作区"灰色文字增加噪音
- Why it matters: 同一 sidebar 内出现两种不同密度的列表项，破坏一致性
- Fix: 统一 workspace 列表项与菜单项的 padding/字号；空状态改为更克制的提示或完全隐藏
- Suggested command: `$impeccable layout sidebar-workspace`

**[P2] 菜单项 disabled 状态无视觉区分**
- What: project-sidebar.tsx L496-498 disabled 状态仅改变 cursor 和颜色为 `text-neutral-300`，但 hover 状态仍显示
- Why it matters: 用户可能尝试点击 disabled 项，仅依赖 title tooltip 不够直观
- Fix: disabled 项去掉 hover 背景变化，或添加更明显的禁用视觉（如 opacity-50）
- Suggested command: `$impeccable polish sidebar-interactions`

**[P2] "方向卡"等术语缺乏解释**
- What: 方向卡、阶段计划、签到与状态等术语对首次用户不够直观
- Why it matters: Jordan（First-Timer）可能不理解这些术语的含义，无帮助入口
- Fix: 在首次进入时显示简短 tooltip 或 inline hint，或在 empty state 中解释概念
- Suggested command: `$impeccable onboard project-views`

## Persona Red Flags

**Alex (Power User)**:
- 无键盘导航到具体菜单项（只能鼠标点击或用 Tab 逐个遍历）
- 无批量操作（如批量确认分工、批量更新任务状态）
- 无自定义快捷键（仅 Ctrl+B 和 Ctrl+J）

**Jordan (First-Timer)**:
- "方向卡"术语无解释，首次看到可能困惑
- 无帮助入口或引导提示
- Workspace 展开区域的"暂无其他工作区"提示对新手无意义

**Sam (Accessibility)**:
- 整体 ARIA 标签完整（aria-label、aria-current），但 collapsed 状态的 badge 数字不可访问
- Focus ring 使用 `focus:ring-moss/30`，对比度可能不足

**Casey (Mobile)**:
- 三栏布局在移动端未适配（无响应式断点处理）
- Sidebar collapsed 为 48px，但触摸目标在移动端可能过小

## Minor Observations

1. project-sidebar.tsx L352-355 divider 在 expanded/collapsed 状态使用不同样式（border-t border-dashed vs h-px bg-neutral-100），虽无功能问题但增加维护成本
2. agent-sidebar.tsx L159 toggle 按钮使用 `shadow-sm` + `border` + `rounded-full`，作为悬浮按钮合理，但属于 ghost-card 边缘情况
3. project-content.tsx L271 内层 `rounded-lg border border-neutral-100 bg-neutral-50/50` 嵌套在已有 border 的 card 内，层级略复杂
4. new/page.tsx L16 `tracking-[0.18em]` 过宽，uppercase + 宽 tracking 是典型 AI slop

## Questions to Consider

1. "方向卡"是否可以改为更直观的名称（如"项目目标"）？
2. Workspace 展开区域在 MVP 单 workspace 场景下是否必要？
3. 移动端三栏布局的优先级：先折叠哪一侧边栏？
