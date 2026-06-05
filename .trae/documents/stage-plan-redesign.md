# 阶段计划页面重设计 — 实现计划

## Summary
将 `frontend/src/components/stage/stage-plan-board.tsx` 从现有卡片网格布局改造为参考图中的时间轴列表布局：左侧图标连线、当前阶段蓝色高亮背景、交付物与任务数内联显示、顶部进度条保留。

## Current State Analysis
- **当前文件**: `frontend/src/components/stage/stage-plan-board.tsx`
- **当前布局**: 每个阶段一张独立卡片（`article`），内部上下分块（标题区 + 交付物/任务双栏网格）
- **样式问题**: 卡片嵌套感重、信息密度低、无时间轴视觉引导、当前阶段不够突出
- **已有数据**: `Stage[]`、`Task[]`、`currentStageId`，满足新布局所需全部信息
- **已有工具函数**: `statusClass`、`statusLabel` 可直接复用或扩展

## Proposed Changes

### 文件: `frontend/src/components/stage/stage-plan-board.tsx`

#### 1. 引入新图标
- 从 `lucide-react` 引入 `CheckCircle2`、`Circle`、`Clock`、`AlertTriangle`
- 已有 `CalendarDays`、`Flag`，保留

#### 2. 新增辅助组件与函数
- `StageIcon({ status, isCurrent })`: 根据状态返回对应图标
  - `completed` → `CheckCircle2`（绿色 `#2d6dc3` / moss）
  - `active` / `isCurrent` → `Clock`（蓝色 `#2d6dc3` / primary）
  - `at_risk` → `AlertTriangle`（红色 `#dc4f5f` / coral）
  - `pending` → `Circle`（灰色 `#c5cedb` / neutral-300）
- `daysUntil(dateStr)`: 计算距今天数
- `relativeTimeLabel(start, end, status)`: 生成相对时间文案（"还剩 X 天" / "已延期 X 天" / "今天截止" 等）

#### 3. 改造外层容器
- 保留 `<section className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">` 作为整体卡片
- 保留顶部标题区（"阶段计划" + 描述 + 进度条），与参考图一致

#### 4. 改造阶段列表为时间轴布局
- 在列表外侧添加相对定位容器
- **时间轴线**: 绝对定位 `div`，左侧 `left-[18px]`，竖线 `w-px bg-neutral-200`，贯穿整个列表
- 每个阶段项（`article`）改为 `pl-10` 留出左侧图标空间
- **时间轴节点**: 每个阶段左侧放置一个 `absolute left-2` 的圆形图标容器，背景白色以遮盖竖线

#### 5. 改造单条阶段项结构
- **当前阶段高亮**: `isCurrent ? "bg-primary/5" : "hover:bg-neutral-50/50"`，使用 primary（蓝色）轻量背景
- **标题行**: 阶段名 + 当前 Badge + 状态 Badge + 相对时间标签，横向排列
  - 当前 Badge: `bg-primary/15 text-primary border-0`
  - 时间标签: 根据是否延期使用 `text-coral` 或 `text-primary`
- **描述**: 阶段 goal，小号灰色文字
- **日期**: 右侧对齐，`CalendarDays` 图标 + `start_date → end_date`
- **交付物 & 任务数**: 从双栏卡片改为**内联行**，`mt-2 flex flex-wrap gap-4 text-sm`
  - `Flag` 图标 + deliverable
  - 任务数文案: "X 个任务" 或 "暂无任务"

#### 6. 空状态与加载状态
- 空状态保留现有实现（`stages.length === 0` 时的提示）
- 当前无独立 loading 状态，由调用方控制

#### 7. 视觉细节对齐
- 圆角: 外层 `rounded-xl`，内部项 `rounded-lg`
- 边框: 外层 `border-neutral-200`，内部项无边框（靠背景色区分）
- 间距: 列表项之间 `space-y-1`，项内 `py-3`
- 字体: 阶段名 `font-semibold text-ink`，当前阶段加 `text-primary`
- 不使用 uppercase tracking eyebrow（符合 product.md 禁令）

## Assumptions & Decisions
1. **完全复用现有数据类型** (`Stage`, `Task`)，不修改 schema。
2. **进度条保留现有 `Progress` 组件**，仅调整位置与样式细节。
3. **时间轴为纯视觉装饰**，不使用复杂 SVG，CSS 竖线 + 图标实现。
4. **颜色严格使用项目已有 token** (`primary`, `moss`, `coral`, `neutral-xxx`)，不引入新色值。
5. **响应式**: 默认在桌面端展示时间轴，移动端保持可读性（日期换行、标签折行）。
6. **动效**: 遵循 product.md 原则，不使用装饰性动画；保留现有 Framer Motion 页面级入场即可。

## Verification Steps
1. 启动前端 dev server (`npm run dev`)。
2. 进入任意项目 → "阶段计划" 视图。
3. 检查:
   - 时间轴竖线贯穿所有阶段
   - 每个阶段左侧有对应状态图标
   - 当前阶段背景为淡蓝色 (`bg-primary/5`)
   - 交付物和任务数在同一行内联显示
   - 日期格式正确，相对时间标签（如"还剩 2 天"）显示正确
   - 无样式报错、无 hydration mismatch
   - 空状态（无阶段）文案正常
