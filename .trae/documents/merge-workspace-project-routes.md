# Plan: 合并 Workspace 与 Project 路由为单一三栏布局

## Summary
将 `/workspaces/{id}` 和 `/projects/{id}` 合并为单一入口 `/workspaces/{id}`。进入工作台直接显示三栏布局（左侧导航、中间内容、右侧 Agent），不再有单独的 workspace 单栏页面。所有项目切换在左侧边栏完成，中间内容区动态切换 WorkspaceContent 或 ProjectContent。

## Current State Analysis
- `/workspaces/[workspaceId]/page.tsx`: 已改为加载 `WorkspaceLayout`，但 `WorkspaceLayout` 内部通过 `showWorkspace` 状态切换 WorkspaceContent 和 ProjectContent，本质上还是"两个视图"。
- `/projects/[projectId]/page.tsx`: 独立的页面，使用 `ProjectLayout` 三栏布局。大量内部跳转硬编码 `/projects/{id}`。
- `ProjectSidebar`: 项目点击使用 `router.push(`/projects/${p.id}`)`，导航菜单使用 `router.push(`/projects/${projectId}?view=...`)`。
- `WorkspaceContent`: 项目卡片点击使用 `router.push(`/projects/${p.id}`)`，新建项目成功后也跳转 `/projects/{id}`。
- `AgentSidebar`: 依赖 `ProjectState`，在 workspace 视图下没有项目数据时会出问题。
- AppShell 顶部导航有"工作台"和"新建项目"链接。
- 重复"新建项目"按钮问题：`WorkspaceContent` 的 header 有一个，EmptyState 里还有一个（但 EmptyState 的 action 已被移除，只剩 header 一个）。

## Proposed Changes

### 1. 废弃 `/projects/[projectId]` 路由，改为重定向
- **文件**: `frontend/src/app/projects/[projectId]/page.tsx`
- **修改**: 将该页面改为 Client Component，读取 projectId 后调用 API 获取项目所属 workspaceId，然后 `router.replace(`/workspaces/${workspaceId}?project=${projectId}`)`。
- **原因**: 保留旧链接可用性，但统一到新路由。

### 2. 统一 `/workspaces/[workspaceId]` 为唯一入口
- **文件**: `frontend/src/app/workspaces/[workspaceId]/page.tsx`
- **修改**: 
  - 读取 URL query param `?project=xxx`，如果有则优先加载该项目。
  - 保留现有加载逻辑：无 project 参数时默认加载第一个项目，无项目则显示 workspace 视图。
  - 将 `ProjectLayout` 的所有 agent 操作逻辑（runAgent, handleAssignmentResponse 等）从 `/projects/[projectId]/page.tsx` 迁移到这里，通过 props 传给 `WorkspaceLayout`。
  - 或者更好的方式：让 `WorkspaceLayout` 接收 `projectState` 以及所有操作回调，内部渲染 `ProjectContent` 时透传。

### 3. 改造 `WorkspaceLayout` 支持完整 Project 操作
- **文件**: `frontend/src/components/project/workspace-layout.tsx`
- **修改**:
  - 扩展 props，接收所有 ProjectLayout 需要的回调（onRunAgent, onRespondToAssignment, pendingAction, actionError, actionSuccess 等）。
  - 当 `projectState` 存在时，中间渲染 `ProjectContent` 并传入所有回调；当 `showWorkspace` 时渲染 `WorkspaceContent`。
  - 右侧 `AgentSidebar` 只在有 `projectState` 时渲染完整版本，无项目时渲染简化版（或空状态）。

### 4. 修改 `ProjectSidebar` 内部跳转逻辑
- **文件**: `frontend/src/components/project/project-sidebar.tsx`
- **修改**:
  - 项目列表点击：不再 `router.push(`/projects/${p.id}`)`，而是调用外部传入的 `onSelectProject(projectId)`。
  - 导航菜单点击：不再 `router.push(`/projects/${projectId}?view=...`)`，而是调用外部传入的 `onNavigate(view)`，由父组件通过 `router.replace` 更新 URL query param（如 `?view=my-tasks`），不切换页面。
  - 新增 props: `onSelectProject`, `onNavigateView`。
  - "新建项目"按钮：保持打开 dialog，不跳转路由。

### 5. 修改 `WorkspaceContent` 项目点击和新建项目回调
- **文件**: `frontend/src/components/project/workspace-content.tsx`
- **修改**:
  - 项目卡片点击：调用 `onNavigateToProject(projectId)`（外部传入），不再 `router.push`。
  - `NewProjectDialog` 的 `onCreated`：调用 `onNavigateToProject(project.id)`，不再 `router.push`。
  - 移除内部 `useRouter` 依赖（或保留用于 dialog 内的新建项目页面跳转，但新建项目页也需要调整）。

### 6. 修改 `ProjectIntakeForm` 成功跳转
- **文件**: `frontend/src/components/project/project-intake-form.tsx`
- **修改**: 创建项目成功后，不再 `router.push(`/projects/${project.id}`)`，而是调用 `onCreated(project)` 回调，由调用方（`NewProjectDialog` → `WorkspaceContent` → `WorkspaceLayout`）处理项目选择。

### 7. 修改 AppShell 导航链接
- **文件**: `frontend/src/components/app-shell.tsx`
- **修改**:
  - "工作台"链接保持 `/workspaces/${workspaceId}`。
  - "新建项目"链接改为打开 dialog 或跳转到 `/workspaces/${workspaceId}?action=new-project`（由页面解析并打开 dialog），而不是 `/projects/new?workspaceId=...`。
  - MobileNav 同样处理。

### 8. 调整 `/projects/new` 页面
- **文件**: `frontend/src/app/projects/new/page.tsx`
- **修改**: 该页面用于 onboarding 最后一步创建项目。修改成功后跳转到 `/workspaces/${workspaceId}?project=${project.id}`。

### 9. 修复重复"新建项目"按钮
- **文件**: `frontend/src/components/project/workspace-content.tsx`
- **修改**: 确认 EmptyState 中不再显示"新建项目"按钮（已移除），只保留 header 的按钮。项目列表底部的"新建项目"按钮保留（这是合理的，在列表底部添加）。

### 10. `AgentSidebar` 适配无项目状态
- **文件**: `frontend/src/components/project/agent-sidebar.tsx`
- **修改**:
  - 当 `state` 不包含 `project` 字段（即 WorkspaceState）时，显示简化空状态："选择一个项目以查看 Agent 建议"。
  - 或者让 `WorkspaceLayout` 在无项目时不渲染 `AgentSidebar`。

## Assumptions & Decisions
1. **URL 设计**: `/workspaces/{id}` 为基础，项目选择通过 query param `?project=xxx` 表示，视图通过 `?view=xxx` 表示。这样刷新页面后能恢复状态。
2. **路由废弃策略**: `/projects/{id}` 不做永久删除，内部重定向到 `/workspaces/{workspaceId}?project={id}`，避免破坏外部链接。
3. **状态提升**: 所有项目操作状态（pendingAction, actionError 等）提升到 `/workspaces/[workspaceId]/page.tsx`，因为该页面是唯一的数据持有者。
4. **ProjectSidebar 导航**: 视图切换不再走路由，只更新 query param，页面不重新加载。

## Verification Steps
1. 访问 `/workspaces/xxx` → 显示三栏布局，有项目则默认选中第一个并显示 ProjectContent，无项目则显示 WorkspaceContent。
2. 点击左侧边栏项目 → 中间内容切换为对应项目，URL 更新为 `?project=yyy`，页面不刷新。
3. 点击左侧边栏导航（如"阶段计划"）→ URL 更新为 `?view=stages`，内容切换，页面不刷新。
4. 访问旧链接 `/projects/yyy` → 自动重定向到 `/workspaces/xxx?project=yyy`。
5. 新建项目成功后 → 自动选中新项目，URL 更新。
6. 顶部导航"新建项目" → 在当前页面打开 dialog，不跳转。
7. 运行 `npm run lint` 和 `npm run build` 无错误。
