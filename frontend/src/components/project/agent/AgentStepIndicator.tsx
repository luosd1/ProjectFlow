"use client";

import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, Loader2, Circle } from "lucide-react";
import type { AgentStreamPhase } from "@/lib/types";

export type AgentStreamStatus = {
  phase: AgentStreamPhase;
  module?: string;
  message: string;
};

interface AgentStepIndicatorProps {
  status: AgentStreamStatus | null;
}

const PHASE_LABELS: Record<string, string> = {
  planning: "理解你的需求",
  executing: "执行任务模块",
  generating: "整理执行结果",
  streaming: "生成回复",
  answering: "整理回复",
};

const ALL_PHASES = ["planning", "executing", "generating", "streaming"] as const;

function getSteps(status: AgentStreamStatus | null) {
  const currentIdx = status ? ALL_PHASES.indexOf(status.phase as (typeof ALL_PHASES)[number]) : -1;

  return ALL_PHASES.map((phase, idx) => {
    let state: "done" | "active" | "pending" = "pending";
    if (idx < currentIdx) state = "done";
    else if (idx === currentIdx) state = "active";

    const label = PHASE_LABELS[phase] ?? phase;
    return { phase, label, state };
  });
}

export function AgentStepIndicator({ status }: AgentStepIndicatorProps) {
  if (!status) return null;

  const steps = getSteps(status);
  const statusMessage = status.message;

  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      className="mb-3 rounded-md border border-neutral-200 bg-neutral-50 p-3"
    >
      <div className="flex items-center gap-1.5 text-xs font-semibold text-neutral-600">
        <Loader2 className="h-3.5 w-3.5 animate-spin text-neutral-500" />
        Agent 正在处理
        {status.module && (
          <span className="font-normal text-neutral-400">· {status.module}</span>
        )}
      </div>
      <ul className="mt-2 space-y-1">
        <AnimatePresence>
          {steps.map((step) => (
            <motion.li
              key={step.phase}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-1.5 text-xs"
            >
              {step.state === "done" ? (
                <CheckCircle2 className="h-3 w-3 shrink-0 text-neutral-500" />
              ) : step.state === "active" ? (
                <Loader2 className="h-3 w-3 shrink-0 animate-spin text-neutral-600" />
              ) : (
                <Circle className="h-3 w-3 shrink-0 text-neutral-300" />
              )}
              <span className={step.state === "active" ? "text-neutral-700 font-medium" : "text-neutral-400"}>
                {step.label}
              </span>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
      {statusMessage && (
        <p className="mt-1.5 text-[11px] text-neutral-500">{statusMessage}</p>
      )}
    </motion.div>
  );
}
