import { Suspense } from "react";
import { Loader2 } from "lucide-react";

import { AccountSetupForm } from "@/components/onboarding/account-setup-form";

function LoadingFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-paper">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-moss" />
        <p className="text-sm text-ink/60">正在加载引导流程...</p>
      </div>
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <main className="min-h-screen bg-paper text-ink">
      <div className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-5 py-12">
        <header className="mb-8 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-moss">
            ProjectFlow
          </p>
          <h1 className="font-display mt-2 text-3xl font-black leading-tight">
            账号设置
          </h1>
          <p className="mt-2 text-sm text-ink/60">
            创建或选择一个演示身份开始使用。
          </p>
        </header>
        <Suspense fallback={<LoadingFallback />}>
          <AccountSetupForm />
        </Suspense>
      </div>
    </main>
  );
}
