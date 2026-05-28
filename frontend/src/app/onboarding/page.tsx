import { Suspense } from "react";
import { Loader2 } from "lucide-react";

import { AccountSetupForm } from "@/components/onboarding/account-setup-form";

function LoadingFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-paper">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-moss" />
        <p className="text-sm text-ink/60">Loading onboarding...</p>
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
            Account Setup
          </h1>
          <p className="mt-2 text-sm text-ink/60">
            Create or select a demo identity to get started.
          </p>
        </header>
        <Suspense fallback={<LoadingFallback />}>
          <AccountSetupForm />
        </Suspense>
      </div>
    </main>
  );
}
