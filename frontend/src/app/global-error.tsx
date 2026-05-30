"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import "../styles/globals.css";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="zh-CN">
      <body>
        <main className="flex min-h-screen items-center justify-center bg-paper px-6 text-center text-ink">
          <section className="max-w-3xl">
            <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-coral/10 text-coral">
              <AlertTriangle className="h-6 w-6" aria-hidden />
            </div>
            <h1 className="font-display text-3xl font-black">应用暂时不可用</h1>
            <p className="mt-3 text-sm leading-6 text-ink/65">
              根布局加载失败，项目数据没有被更改。请重试当前页面。
            </p>
            <Button className="mt-6" onClick={reset}>
              <RotateCcw className="h-4 w-4" aria-hidden />
              重试
            </Button>
          </section>
        </main>
      </body>
    </html>
  );
}
