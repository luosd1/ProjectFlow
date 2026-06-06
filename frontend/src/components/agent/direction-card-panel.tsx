"use client";

import React from "react";
import { CheckCircle2, HelpCircle, History, Info, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DirectionDecisionView } from "@/components/agent/direction-decision-view";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { AgentEvent, DirectionCard } from "@/lib/types";

type DirectionCardPanelProps = {
  directionCard?: DirectionCard | null;
  timeline: AgentEvent[];
  pending?: boolean;
  onRunClarification?: () => void;
};

function safeStringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function latestClarification(timeline: AgentEvent[]) {
  return [...timeline].reverse().find((event) => event.event_type === "clarify");
}

const STEPS = [
  { label: "项目录入", desc: "填写项目基本信息" },
  { label: "方向澄清", desc: "AI 分析项目方向" },
  { label: "确认方向", desc: "团队确认方向卡" },
  { label: "阶段规划", desc: "拆解阶段与任务" },
];

function StepGuide({ activeIndex }: { activeIndex: number }) {
  return (
    <div className="space-y-3">
      {STEPS.map((step, idx) => {
        const done = idx < activeIndex;
        const current = idx === activeIndex;
        return (
          <div key={step.label} className="flex items-start gap-3">
            <span
              className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                done
                  ? "bg-moss text-white"
                  : current
                    ? "bg-primary text-white"
                    : "bg-neutral-100 text-neutral-400"
              }`}
            >
              {done ? <CheckCircle2 className="h-3 w-3" /> : idx + 1}
            </span>
            <div>
              <p className={`text-sm font-medium ${current ? "text-primary" : done ? "text-ink" : "text-ink/45"}`}>
                {step.label}
              </p>
              <p className="text-xs text-ink/50">{step.desc}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DirectionHistory({ timeline }: { timeline: AgentEvent[] }) {
  const [showAll, setShowAll] = React.useState(false);
  const allClarifications = timeline.filter((e) => e.event_type === "clarify");
  const clarifications = showAll ? allClarifications : allClarifications.slice(0, 3);
  if (clarifications.length === 0) return null;
  return (
    <div className="space-y-3">
      {clarifications.map((event) => (
        <div key={event.id} className="rounded-md border border-ink/8 bg-paper/50 p-3">
          <p className="text-xs text-ink/45">{new Date(event.created_at).toLocaleDateString("zh-CN")}</p>
          <p className="mt-1 text-sm text-ink/75 line-clamp-2">{event.reasoning_summary}</p>
        </div>
      ))}
      {allClarifications.length > 3 && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="text-xs text-primary hover:underline"
        >
          {showAll ? "收起" : `展开全部（${allClarifications.length} 条）`}
        </button>
      )}
    </div>
  );
}

export function DirectionCardPanel({
  directionCard,
  timeline,
  pending,
  onRunClarification,
}: DirectionCardPanelProps) {
  const clarification = latestClarification(timeline);
  const questions = safeStringList(directionCard?.suggested_questions ?? clarification?.output_snapshot?.suggested_questions);
  const confirmed = Boolean(directionCard);

  const stepIndex = confirmed ? 2 : clarification ? 1 : 0;

  return (
    <section className="rounded-lg border border-ink/10 bg-white p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-ink">方向卡</h2>
            <TooltipProvider delay={200}>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="h-4 w-4 text-ink/40 cursor-help" />
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs text-xs">
                  方向卡是 AI 根据项目想法生成的核心方向建议，包含目标用户、价值主张、交付物等关键决策点
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <p className="mt-1 max-w-2xl text-sm text-ink/60">
            确认项目方向后再规划任务和分工，避免后续建议偏离目标
          </p>
        </div>
        <Badge className={confirmed ? "bg-moss/15 text-moss" : "bg-citron/35 text-ink"}>
          {confirmed ? "已确认" : "待确认"}
        </Badge>
      </div>

      <div className="mt-6 grid gap-5 min-[1900px]:grid-cols-[minmax(0,1fr)_340px]">
        {/* Left: direction card content */}
        <div className="rounded-lg border border-ink/10 bg-paper/70 p-5">
          {directionCard ? (
            <DirectionDecisionView content={directionCard} />
          ) : (
            <div className="flex min-h-40 flex-col items-start justify-center gap-3">
              <HelpCircle className="h-6 w-6 text-harbor" />
              <div>
                <p className="font-semibold text-ink">尚未生成方向卡</p>
                <p className="mt-1 text-sm text-ink/60">完成项目录入后运行澄清方向，生成项目方向建议</p>
              </div>
              <Button onClick={onRunClarification} disabled={pending} className="bg-ink text-white hover:bg-ink/85">
                <Sparkles className="h-4 w-4" />
                运行澄清方向
              </Button>
            </div>
          )}
        </div>

        {/* Right: contextual helper */}
        <div className="grid gap-4 md:grid-cols-2 min-[1900px]:block min-[1900px]:space-y-4">
          <div className="rounded-lg border border-ink/10 bg-white p-4 text-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink/45">项目进度</p>
            <div className="mt-3">
              <StepGuide activeIndex={stepIndex} />
            </div>
          </div>

          {confirmed && timeline.filter((e) => e.event_type === "clarify").length > 0 && (
            <div className="rounded-lg border border-ink/10 bg-white p-4 text-sm">
              <div className="flex items-center gap-2">
                <History className="h-4 w-4 text-ink/45" />
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink/45">方向澄清历史</p>
              </div>
              <div className="mt-3">
                <DirectionHistory timeline={timeline} />
              </div>
            </div>
          )}

          {!confirmed && questions.length > 0 && (
            <div className="rounded-lg border border-ink/10 bg-white p-4 text-sm">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-moss" />
                <p className="font-semibold text-ink">Agent 提问</p>
              </div>
              <ul className="mt-3 space-y-2">
                {questions.map((question) => (
                  <li key={question} className="rounded-md bg-paper px-3 py-2 text-sm text-ink/75 break-all">
                    {question}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
