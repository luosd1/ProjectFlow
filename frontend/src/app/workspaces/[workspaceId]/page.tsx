"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { getWorkspaceState } from "@/lib/api";
import { setLastWorkspaceId } from "@/components/app-shell";

export default function WorkspaceDashboardPage() {
  const params = useParams();
  const router = useRouter();
  const workspaceId = params.workspaceId as string;

  useEffect(() => {
    setLastWorkspaceId(workspaceId);

    getWorkspaceState(workspaceId)
      .then((data) => {
        if (data.projects.length > 0) {
          router.replace(`/projects/${data.projects[0].id}`);
        } else {
          // No projects in workspace — redirect to new project page
          router.replace(
            `/projects/new?workspaceId=${workspaceId}&createdBy=${data.workspace.owner_user_id}`
          );
        }
      })
      .catch(() => {
        // On error, redirect to home
        router.replace("/");
      });
  }, [workspaceId, router]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}
