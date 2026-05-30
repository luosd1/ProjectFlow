"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function ErrorBoundary({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <section className="mx-auto flex min-h-[60vh] max-w-3xl flex-col items-center justify-center px-6 py-16 text-center">
      <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-coral/10 text-coral">
        <AlertTriangle className="h-6 w-6" aria-hidden />
      </div>
      <h1 className="font-display text-3xl font-black text-ink">页面暂时不可用</h1>
      <p className="mt-3 max-w-xl text-sm leading-6 text-ink/65">
        当前视图加载失败，项目数据没有被更改。可以重试当前页面，或返回工作台继续查看其他内容。
      </p>
      <Button className="mt-6" onClick={reset}>
        <RotateCcw className="h-4 w-4" aria-hidden />
        重试
      </Button>
    </section>
  );
}
