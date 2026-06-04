"use client";

import * as React from "react";
import { useEffect, useRef, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowRight, BookOpen, Compass, HelpCircle, Loader2, MessageCircle, Shield, Sparkles, Users, Zap } from "lucide-react";

import { Button } from "@/components/ui/button";

const WORKSPACE_STORAGE_KEY = "projectflow:last-workspace-id";
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api";

function subscribeToStorage(cb: () => void) {
  window.addEventListener("storage", cb);
  return () => window.removeEventListener("storage", cb);
}

function getStorageSnapshot() {
  return localStorage.getItem(WORKSPACE_STORAGE_KEY);
}

function getServerSnapshot() {
  return null;
}

async function checkWorkspaceExists(workspaceId: string, signal?: AbortSignal): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/workspaces/${workspaceId}`, { signal });
    return response.ok;
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") return false;
    return false;
  }
}

export function ProjectFlowHome() {
  const router = useRouter();
  const storedId = useSyncExternalStore(subscribeToStorage, getStorageSnapshot, getServerSnapshot);
  const [isLoadingDemo, setIsLoadingDemo] = React.useState(false);
  const [isValidating, setIsValidating] = React.useState(false);
  const [demoError, setDemoError] = React.useState<string | null>(null);
  const validatedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!storedId || isLoadingDemo) return;
    if (validatedRef.current === storedId) return;

    validatedRef.current = storedId;
    setIsValidating(true);
    const controller = new AbortController();
    checkWorkspaceExists(storedId, controller.signal)
      .then((exists) => {
        if (controller.signal.aborted) return;
        if (exists) {
          router.replace(`/workspaces/${storedId}`);
        } else {
          localStorage.removeItem(WORKSPACE_STORAGE_KEY);
          window.dispatchEvent(new StorageEvent("storage", { key: WORKSPACE_STORAGE_KEY }));
        }
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        localStorage.removeItem(WORKSPACE_STORAGE_KEY);
        window.dispatchEvent(new StorageEvent("storage", { key: WORKSPACE_STORAGE_KEY }));
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsValidating(false);
        }
      });

    return () => {
      controller.abort();
    };
  }, [storedId, router, isLoadingDemo]);

  if (storedId && !isLoadingDemo && isValidating) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-moss" />
      </div>
    );
  }

  return (
    <main className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-96 bg-[radial-gradient(ellipse_at_top_right,_rgba(45,109,195,0.10),transparent_60%)]" />
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="site-container relative flex min-h-[60dvh] flex-col items-center justify-center py-12 text-center"
      >
        <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-moss/10 px-4 py-1.5 text-sm font-medium text-moss">
          <Sparkles className="h-4 w-4" />
          主动推进型项目 Agent
        </div>

        <h1 className="font-display text-balance text-5xl font-normal leading-[1.08] text-neutral-900 md:text-6xl">
          让项目自己告诉你
          <br />
          <span className="text-moss">下一步做什么</span>
        </h1>

        <p className="mx-auto mt-6 max-w-lg text-pretty text-base leading-7 text-neutral-600 md:text-lg">
          ProjectFlow 帮大学生项目小队持续回答：项目该往哪走？谁适合做什么？哪些有风险？计划是否需要调整？
        </p>

        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Button
            onClick={() => router.push("/onboarding")}
            className="bg-moss px-8 text-white hover:bg-primary-strong"
            size="lg"
          >
            开始使用
            <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
          <button
            type="button"
            disabled={isLoadingDemo}
            aria-busy={isLoadingDemo}
            onClick={async () => {
              setIsLoadingDemo(true);
              setDemoError(null);
              try {
                const { apiGet, loadDemoSeed } = await import("@/lib/api");
                await loadDemoSeed();
                const workspaces = await apiGet<{ id: string }[]>(`/workspaces`);
                if (workspaces.length > 0) {
                  const wsId = workspaces[0].id;
                  localStorage.setItem(WORKSPACE_STORAGE_KEY, wsId);
                  window.dispatchEvent(new StorageEvent("storage", { key: WORKSPACE_STORAGE_KEY }));
                  router.push(`/workspaces/${wsId}`);
                  return;
                }
              } catch (err) {
                setDemoError(`加载演示数据失败: ${err instanceof Error ? err.message : "未知错误"}`);
              } finally {
                setIsLoadingDemo(false);
              }
            }}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-md px-4 text-sm font-medium text-neutral-600 transition hover:text-moss disabled:opacity-50"
          >
            {isLoadingDemo ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                正在加载...
              </>
            ) : (
              "加载演示数据"
            )}
          </button>
        </div>
        {demoError && (
          <div className="mt-4 max-w-md rounded-lg border border-coral/20 bg-coral/10 px-4 py-3 text-sm text-coral">
            <p className="font-medium">演示数据加载失败</p>
            <p className="mt-1 text-coral/90">请检查网络连接，或稍后再试。</p>
            <div className="mt-2 flex items-center gap-3">
              <button
                type="button"
                onClick={() => setDemoError(null)}
                className="text-xs font-medium underline underline-offset-2 hover:text-coral/80"
              >
                清除提示
              </button>
              <a
                href="https://github.com/Robert-Flow/ProjectFlow/issues"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs font-medium underline underline-offset-2 hover:text-coral/80"
              >
                <MessageCircle className="h-3 w-3" />
                反馈问题
              </a>
            </div>
          </div>
        )}
      </motion.div>

      <section className="site-container grid gap-6 pb-20 pt-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { icon: Compass, title: "规划", text: "澄清方向、拆解阶段、分解任务", tone: "text-moss bg-moss/10" },
          { icon: Users, title: "分工", text: "按技能、时间和意向推荐 owner", tone: "text-yellow-700 bg-citron/25" },
          { icon: Zap, title: "执行", text: "行动卡、签到反馈和状态更新", tone: "text-emerald-600 bg-emerald-100" },
          { icon: Shield, title: "监控", text: "识别风险，并给出重排建议", tone: "text-coral bg-coral/10" },
        ].map((item) => (
          <article
            key={item.title}
            className="rounded-xl border border-neutral-100 bg-white/80 p-6 shadow-sm transition duration-200 ease-out hover:-translate-y-0.5 hover:border-moss/30 hover:shadow-panel"
          >
            <span className={`mb-5 flex h-12 w-12 items-center justify-center rounded-xl ${item.tone}`}>
              <item.icon className="h-6 w-6" aria-hidden />
            </span>
            <h2 className="text-base font-semibold text-neutral-900">{item.title}</h2>
            <p className="mt-2 text-pretty text-sm leading-6 text-neutral-600">{item.text}</p>
          </article>
        ))}
      </section>

      <footer className="site-container pb-12">
        <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-neutral-500">
          <a
            href="https://github.com/Robert-Flow/ProjectFlow/blob/main/README.md"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 transition hover:text-moss"
          >
            <BookOpen className="h-4 w-4" />
            使用文档
          </a>
          <span className="hidden text-neutral-300 sm:inline">|</span>
          <a
            href="https://github.com/Robert-Flow/ProjectFlow/issues"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 transition hover:text-moss"
          >
            <HelpCircle className="h-4 w-4" />
            常见问题与反馈
          </a>
        </div>
      </footer>
    </main>
  );
}
