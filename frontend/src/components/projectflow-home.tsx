"use client";

import { motion } from "framer-motion";
import React from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  Loader2,
  Radio,
  Route,
  UsersRound,
} from "lucide-react";

import { agentStates, actionCards, stageRows, teamMembers } from "@/lib/constants";
import { cn } from "@/lib/utils";

const statusTone = {
  Loading: "border-harbor/40 bg-harbor/10 text-harbor",
  Empty: "border-ink/15 bg-white text-ink/70",
  Error: "border-coral/40 bg-coral/10 text-coral",
  Success: "border-moss/40 bg-moss/10 text-moss",
};

export function ProjectFlowHome() {
  return (
    <main>
      <section className="mx-auto grid min-h-screen w-full max-w-7xl grid-cols-1 gap-6 px-5 py-5 lg:grid-cols-[1.05fr_0.95fr] lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="flex min-h-[calc(100vh-2.5rem)] flex-col justify-between rounded-[8px] border border-ink/10 bg-white p-6 shadow-panel lg:p-8"
        >
          <div>
            <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-moss">
                  Active project agent
                </p>
                <h1 className="font-display mt-2 text-5xl font-black leading-none md:text-7xl">
                  ProjectFlow
                </h1>
              </div>
              <div className="rounded-[8px] border border-ink/10 px-4 py-3 text-right">
                <p className="text-xs font-semibold text-ink/55">当前阶段</p>
                <p className="text-lg font-bold">MVP 闭环搭建</p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-[1.2fr_0.8fr]">
              <section className="rounded-[8px] border border-ink/10 bg-paper p-5">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <ClipboardList className="h-5 w-5 text-moss" aria-hidden="true" />
                    <h2 className="text-2xl font-black">下一步行动</h2>
                  </div>
                  <span className="rounded-full bg-citron px-3 py-1 text-xs font-black text-ink">
                    P0
                  </span>
                </div>
                <p className="max-w-2xl text-base leading-7 text-ink/72">
                  确认阶段计划后，Agent 会把当前阶段拆成可执行任务，并根据成员技能、时间和意向给出第一轮分工建议。
                </p>
                <button className="mt-6 inline-flex items-center gap-2 rounded-[8px] bg-ink px-4 py-3 text-sm font-bold text-white transition hover:bg-moss focus:outline-none focus:ring-2 focus:ring-citron">
                  启动阶段拆解
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </button>
              </section>

              <section className="rounded-[8px] border border-ink/10 bg-white p-5">
                <div className="mb-4 flex items-center gap-2">
                  <Radio className="h-5 w-5 text-coral" aria-hidden="true" />
                  <h2 className="text-xl font-black">Agent 状态</h2>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {agentStates.map((state) => (
                    <div
                      key={state.label}
                      className={cn(
                        "rounded-[8px] border px-3 py-3 text-sm font-bold",
                        statusTone[state.label],
                      )}
                    >
                      {state.label}
                      <p className="mt-1 text-xs font-semibold opacity-70">{state.detail}</p>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {actionCards.map((card) => (
              <article key={card.title} className="rounded-[8px] border border-ink/10 bg-white p-4">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-harbor">
                  {card.owner}
                </p>
                <h3 className="mt-2 text-lg font-black">{card.title}</h3>
                <p className="mt-2 text-sm leading-6 text-ink/68">{card.reason}</p>
              </article>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.08 }}
          className="grid content-start gap-6"
        >
          <section className="rounded-[8px] border border-ink/10 bg-white p-5 shadow-panel">
            <div className="mb-5 flex items-center gap-2">
              <Route className="h-5 w-5 text-harbor" aria-hidden="true" />
              <h2 className="text-2xl font-black">阶段推进</h2>
            </div>
            <div className="space-y-3">
              {stageRows.map((stage) => (
                <div
                  key={stage.name}
                  className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-[8px] border border-ink/10 p-3"
                >
                  <span
                    className={cn(
                      "h-3 w-3 rounded-full",
                      stage.active ? "bg-coral" : "bg-moss/35",
                    )}
                  />
                  <div>
                    <p className="font-bold">{stage.name}</p>
                    <p className="text-sm text-ink/60">{stage.output}</p>
                  </div>
                  <p className="text-sm font-black text-ink/60">{stage.status}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-[8px] border border-ink/10 bg-white p-5 shadow-panel">
            <div className="mb-5 flex items-center gap-2">
              <UsersRound className="h-5 w-5 text-moss" aria-hidden="true" />
              <h2 className="text-2xl font-black">成员负载</h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {teamMembers.map((member) => (
                <div key={member.name} className="rounded-[8px] border border-ink/10 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-black">{member.name}</p>
                      <p className="text-sm text-ink/60">{member.role}</p>
                    </div>
                    {member.risk ? (
                      <AlertTriangle className="h-5 w-5 text-coral" aria-label="risk" />
                    ) : (
                      <CheckCircle2 className="h-5 w-5 text-moss" aria-label="ok" />
                    )}
                  </div>
                  <div className="mt-4 h-2 rounded-full bg-ink/10">
                    <div
                      className={cn("h-2 rounded-full", member.risk ? "bg-coral" : "bg-moss")}
                      style={{ width: `${member.capacity}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-[8px] border border-ink/10 bg-ink p-5 text-white shadow-panel">
            <div className="flex items-center gap-3">
              <Loader2 className="h-5 w-5 animate-spin text-citron" aria-hidden="true" />
              <div>
                <h2 className="text-xl font-black">正在读取 WorkspaceState</h2>
                <p className="mt-1 text-sm leading-6 text-white/70">
                  成员信息、任务依赖、check-in 和风险证据会进入同一条 Agent Timeline。
                </p>
              </div>
            </div>
          </section>
        </motion.div>
      </section>
    </main>
  );
}
