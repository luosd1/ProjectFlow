# 删除 onboarding 第四步「新建项目」实现计划

> **Goal:** 将 onboarding 流程从 4 步缩减为 3 步（选择身份 → 创建工作区 → 完善资料），完成资料后直接进入工作台，由用户在工作台内创建项目。

**Architecture:** 前端页面和组件调整，不涉及后端变更。核心改动：移除 StepIndicator 中的第 4 步、调整当前步骤索引、修改完成后的跳转和按钮文案。

**Tech Stack:** Next.js (App Router), React, TypeScript, Tailwind CSS, shadcn/ui

***

## Current State Analysis

Onboarding 流程当前为 4 步，由以下页面/组件共同呈现：

1. **Step 1 选择身份** — `frontend/src/app/onboarding/page.tsx` (AccountSetupForm)
2. **Step 2 创建工作区** — `frontend/src/app/workspaces/new/page.tsx` (WorkspaceCreateForm)
3. **Step 3 完善资料** — `frontend/src/app/onboarding/profile/page.tsx` (MemberProfileWizard)
4. **Step 4 新建项目** — `frontend/src/app/projects/new/page.tsx` (ProjectIntakeForm)

StepIndicator 在 4 个页面中分别硬编码了相同的 4 步数组，并通过 `currentStep` (0-3) 控制高亮。

MemberProfileWizard 资料提交成功后，当前展示两个按钮：「进入工作台」和「新建项目」。需要改为只展示「进入工作台」。

Workspace 仪表盘页 (`frontend/src/app/workspaces/[workspaceId]/page.tsx`) 在无项目时会自动重定向到 `/projects/new`，需要改为重定向到工作台内容页（即保留在工作台页面，不自动跳转新建项目）。

***

## Proposed Changes

### Task 1: 修改 onboarding 首页 StepIndicator（Step 1 页面）

**Files:**

* Modify: `frontend/src/app/onboarding/page.tsx`

**What:** 将 StepIndicator 的 steps 从 4 步改为 3 步，移除「新建项目」步骤。

**How:**

```tsx
<StepIndicator
  steps={[
    { label: "选择身份", description: "创建新账号或选择现有用户" },
    { label: "创建工作区", description: "设置团队空间" },
    { label: "完善资料", description: "补充个人信息" },
  ]}
  currentStep={0}
  className="mb-8"
/>
```

***

### Task 2: 修改创建工作区页 StepIndicator（Step 2 页面）

**Files:**

* Modify: `frontend/src/app/workspaces/new/page.tsx`

**What:** 同上，改为 3 步数组，`currentStep={1}` 保持不变。

**How:**

```tsx
<StepIndicator
  steps={[
    { label: "选择身份", description: "创建新账号或选择现有用户" },
    { label: "创建工作区", description: "设置团队空间" },
    { label: "完善资料", description: "补充个人信息" },
  ]}
  currentStep={1}
  className="mb-8"
/>
```

***

### Task 3: 修改完善资料页 StepIndicator（Step 3 页面）

**Files:**

* Modify: `frontend/src/app/onboarding/profile/page.tsx`

**What:** 同上，改为 3 步数组，`currentStep` 从 2 改为 2（仍是最后一步，索引不变）。

**How:**

```tsx
<StepIndicator
  steps={[
    { label: "选择身份", description: "创建新账号或选择现有用户" },
    { label: "创建工作区", description: "设置团队空间" },
    { label: "完善资料", description: "补充个人信息" },
  ]}
  currentStep={2}
  className="mb-8"
/>
```

***

### Task 4: 修改 MemberProfileWizard 成功状态按钮

**Files:**

* Modify: `frontend/src/components/onboarding/member-profile-wizard.tsx`

**What:** 资料提交成功后的 UI，移除「新建项目」按钮，只保留「进入工作台」。

**How:** 找到 `submitState === "success"` 的返回 JSX，将按钮区域从两个 Link 改为一个：

```tsx
<div className="flex flex-col gap-2 sm:flex-row">
  <Link
    href={`/workspaces/${workspaceId}`}
    className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-5 py-3 text-sm font-bold text-primary-foreground transition hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring"
  >
    进入工作台
    <ArrowRight className="h-4 w-4" />
  </Link>
</div>
```

***

### Task 5: 修改 workspace 仪表盘无项目时的重定向逻辑

**Files:**

* Modify: `frontend/src/app/workspaces/[workspaceId]/page.tsx`

**What:** 当前无项目时自动跳转到 `/projects/new`，改为不再自动跳转，让用户留在工作台页面自行创建。

**How:** 将 `useEffect` 中的逻辑改为：

```tsx
useEffect(() => {
  setLastWorkspaceId(workspaceId);

  getWorkspaceState(workspaceId)
    .then((data) => {
      if (data.projects.length > 0) {
        router.replace(`/projects/${data.projects[0].id}`);
      }
      // 无项目时不再自动跳转，留在工作台页面
    })
    .catch(() => {
      router.replace("/");
    });
}, [workspaceId, router]);
```

同时需要确保该页面在无项目时能正确渲染工作台内容，而不是只显示 loading。需要引入 `WorkspaceContent` 组件并传入 `ProjectState`。

**具体实现：**

* 将页面从纯跳转页改为数据获取 + 条件渲染：

  * 有项目 → 跳转到第一个项目（保持现有行为）

  * 无项目 → 渲染 `WorkspaceContent` 组件，展示工作台（图2 所示的界面）

需要添加 state 管理 `ProjectState` 和加载状态。

***

### Task 6: 删除或禁用 `/projects/new` 的 onboarding 入口

**Files:**

* Modify: `frontend/src/app/projects/new/page.tsx`

**What:** 该页面当前作为 onboarding 第 4 步使用。用户确认后，此页面不再属于 onboarding 流程，但作为独立功能页（从工作台点击「新建项目」时）仍需保留。

**How:** 仅移除页面内的 StepIndicator（因为不再作为 onboarding 步骤），保留 `ProjectIntakeForm` 功能。页面变为纯功能页，不再有步骤指示器。

```tsx
export default function NewProjectPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <ProjectNewContent />
    </Suspense>
  );
}

function ProjectNewContent() {
  const searchParams = useSearchParams();
  const workspaceId = searchParams.get("workspaceId") ?? "";
  const createdBy = searchParams.get("createdBy") ?? "";

  return (
    <div className="mx-auto max-w-lg px-5 py-12">
      <ProjectIntakeForm workspaceId={workspaceId} defaultCreatedBy={createdBy} />
    </div>
  );
}
```

***

## Assumptions & Decisions

1. **StepIndicator 数组在每个页面中独立定义** — 当前代码如此，不抽象为共享常量，保持最小改动。
2. **`/projects/new`** **页面保留** — 用户仍可从工作台通过「新建项目」按钮进入，只是不再作为 onboarding 步骤。
3. **Workspace 无项目时展示工作台** — 这是图2 所示的界面，用户可在其中点击「新建项目」按钮创建项目。
4. **MemberProfileWizard 成功页只保留「进入工作台」** — 已和用户确认。
5. **不涉及后端改动** — 所有变更均为前端路由和 UI 调整。

***

## Verification Steps

1. 访问 `/onboarding`，确认 StepIndicator 只显示 3 步。
2. 完成账号创建 → 创建工作区 → 完善资料，确认每一步的 StepIndicator 都显示 3 步且高亮正确。
3. 资料提交成功后，确认只显示「进入工作台」按钮，点击后进入 `/workspaces/{id}`。
4. 在工作台页面（无项目状态），确认能看到「新建项目」按钮，点击后弹出新建项目对话框或跳转到 `/projects/new`。
5. 确认从 app-shell 导航栏点击「新建项目」仍能正常打开项目创建页。
6. 运行 `cd frontend && npm run lint` 确认无 lint 错误。
7. 运行 `cd frontend && npm run build` 确认构建通过。

