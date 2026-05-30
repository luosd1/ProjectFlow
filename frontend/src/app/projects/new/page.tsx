"use client";

import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { ProjectIntakeForm } from "@/components/project/project-intake-form";

function ProjectNewContent() {
  const searchParams = useSearchParams();
  const workspaceId = searchParams.get("workspaceId") ?? "";
  const createdBy = searchParams.get("createdBy") ?? "";

  return (
    <div className="mx-auto max-w-lg px-5 py-12">
      <header className="mb-8 text-center">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-moss">ProjectFlow</p>
        <h1 className="font-display mt-2 text-3xl font-black leading-tight">新建项目</h1>
        <p className="mt-2 text-sm text-ink/60">
          填写项目想法、截止日期和预期交付物。
        </p>
      </header>
      <ProjectIntakeForm workspaceId={workspaceId} defaultCreatedBy={createdBy} />
    </div>
  );
}

function LoadingFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-paper">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-moss" />
        <p className="text-sm text-ink/60">正在加载...</p>
      </div>
    </div>
  );
}

export default function NewProjectPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <ProjectNewContent />
    </Suspense>
  );
}
