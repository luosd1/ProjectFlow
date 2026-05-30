"use client";

import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { WorkspaceCreateForm } from "@/components/workspace/workspace-create-form";
import { InviteMemberPanel } from "@/components/workspace/invite-member-panel";
import { Separator } from "@/components/ui/separator";
import { useState } from "react";
import type { Workspace } from "@/lib/types";

function WorkspaceNewContent() {
  const searchParams = useSearchParams();
  const ownerId = searchParams.get("ownerId") ?? undefined;
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);

  return (
    <div className="mx-auto max-w-lg px-5 py-12">
      <header className="mb-8 text-center">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-moss">ProjectFlow</p>
        <h1 className="font-display mt-2 text-3xl font-black leading-tight">新建工作区</h1>
        <p className="mt-2 text-sm text-ink/60">
          创建团队工作区并邀请成员。
        </p>
      </header>

      <div className="space-y-6">
        <WorkspaceCreateForm
          ownerUserId={ownerId}
          onCreated={(ws: Workspace) => setWorkspaceId(ws.workspace_id)}
        />

        {workspaceId && (
          <>
            <Separator />
            <InviteMemberPanel workspaceId={workspaceId} />
          </>
        )}
      </div>
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

export default function NewWorkspacePage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <WorkspaceNewContent />
    </Suspense>
  );
}
