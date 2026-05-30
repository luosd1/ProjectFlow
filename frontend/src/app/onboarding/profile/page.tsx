"use client";

import { Suspense, use } from "react";
import { Loader2, AlertTriangle } from "lucide-react";

import { MemberProfileWizard } from "@/components/onboarding/member-profile-wizard";

interface ProfilePageProps {
  searchParams: Promise<{ userId?: string; workspaceId?: string }>;
}

function ProfileContent({ searchParams }: ProfilePageProps) {
  const params = use(searchParams);
  const userId = params.userId;
  const workspaceId = params.workspaceId;

  if (!userId || !workspaceId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper text-ink">
        <div className="flex flex-col items-center gap-3 rounded-xl border border-coral/30 bg-coral/5 px-8 py-6">
          <AlertTriangle className="h-8 w-8 text-coral" />
          <h2 className="font-display text-xl font-black text-coral">信息缺失</h2>
          <p className="text-center text-sm text-ink/70">
            {!userId
              ? "请先完成账号设置。"
              : "请先创建工作区，再填写成员资料。"}
          </p>
          <a
            href={!userId ? "/onboarding" : "/workspaces/new"}
            className="mt-2 inline-flex items-center gap-1 rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white transition hover:bg-moss"
          >
            {!userId ? "去设置账号" : "创建工作区"}
          </a>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-paper text-ink">
      <div className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-5 py-12">
        <header className="mb-8 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-moss">
            ProjectFlow
          </p>
          <h1 className="font-display mt-2 text-3xl font-black leading-tight">
            成员资料
          </h1>
          <p className="mt-2 text-sm text-ink/60">
            补充技能、时间和限制，帮助 Agent 给出更可靠的分工建议。
          </p>
        </header>
        <MemberProfileWizard userId={userId} workspaceId={workspaceId} />
      </div>
    </main>
  );
}

function LoadingFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-paper">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-moss" />
        <p className="text-sm text-ink/60">正在加载成员资料...</p>
      </div>
    </div>
  );
}

export default function ProfilePage({ searchParams }: ProfilePageProps) {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <ProfileContent searchParams={searchParams} />
    </Suspense>
  );
}
