"use client";

import { motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  Clock,
  Loader2,
  Pencil,
  Sparkles,
  XCircle,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { AgentArtifact, AgentSuggestion } from "@/lib/types";

// ---------------------------------------------------------------------------
// Focus reason helper
// ---------------------------------------------------------------------------

const FOCUS_REASONS: Record<string, string> = {
  方向澄清: "先把目标、边界和取舍确认下来，后续计划才不会建立在模糊假设上。",
  阶段计划: "方向已经具备基础，可以按截止时间和交付物倒排阶段。",
  任务拆解: "阶段计划确认后，需要把阶段目标拆成可分配、可检查的任务。",
  分工确认: "任务明确后，需要结合成员技能、时间和偏好生成并确认分工。",
  执行推进: "分工确认后，Agent 可以持续生成行动卡、分析风险并建议重排。",
};

export function focusReason(focus: string): string {
  return FOCUS_REASONS[focus] ?? "Agent 会根据当前项目状态判断下一步。";
}

// ---------------------------------------------------------------------------
// AgentContextCard
// ---------------------------------------------------------------------------

interface AgentContextCardProps {
  focus: string;
  pendingCount?: number;
}

export function AgentContextCard({ focus, pendingCount = 0 }: AgentContextCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.25, 1, 0.5, 1] }}
      className="mb-4 rounded-lg border border-neutral-200 bg-white p-3"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-neutral-500">
          <Sparkles className="h-3.5 w-3.5 text-moss" />
          当前阶段
        </div>
        {pendingCount > 0 && (
          <Badge className="bg-moss/15 px-2 py-0 text-[10px] text-moss">
            {pendingCount} 待确认
          </Badge>
        )}
      </div>
      <p className="mt-1.5 text-sm font-semibold text-neutral-900">{focus}</p>
      <p className="mt-1 text-xs leading-5 text-neutral-500">{focusReason(focus)}</p>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// AgentRunStatusCard
// ---------------------------------------------------------------------------

const RUN_STEPS = ["读取项目状态", "判断下一步影响", "整理可确认结果"] as const;

export function AgentRunStatusCard() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: [0.25, 1, 0.5, 1] }}
      className="mb-3 rounded-lg border border-neutral-200 bg-white p-3"
    >
      <div className="flex items-center gap-1.5 text-xs font-semibold text-neutral-600">
        <Loader2 className="h-3.5 w-3.5 animate-spin text-moss" />
        Agent 正在处理
      </div>
      <ul className="mt-2 space-y-1">
        {RUN_STEPS.map((step, index) => (
          <motion.li
            key={step}
            initial={{ opacity: 0, x: -4 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1, duration: 0.2 }}
            className="flex items-center gap-1.5 text-xs text-neutral-500"
          >
            <Clock className="h-3 w-3 shrink-0 text-neutral-400" />
            {step}
          </motion.li>
        ))}
      </ul>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// AgentErrorCard
// ---------------------------------------------------------------------------

interface AgentErrorCardProps {
  message: string;
  onRetry?: () => void | Promise<void>;
  disabled?: boolean;
}

export function AgentErrorCard({ message, onRetry, disabled }: AgentErrorCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: [0.25, 1, 0.5, 1] }}
      className="mb-3 rounded-lg border border-coral/30 bg-white p-3"
    >
      <div className="flex items-start gap-2 text-xs">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-coral" />
        <div>
          <p className="font-semibold text-coral">Agent 暂时没有完成这次处理</p>
          <p className="mt-1 text-neutral-600">{message}</p>
        </div>
      </div>
      {onRetry && (
        <Button
          variant="ghost"
          size="sm"
          className="mt-2 h-7 gap-1 text-xs text-coral hover:bg-coral/10 hover:text-coral"
          disabled={disabled}
          onClick={() => void onRetry()}
        >
          重新发送
        </Button>
      )}
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// AgentArtifactCard
// ---------------------------------------------------------------------------

const ARTIFACT_STATUS_LABELS: Record<AgentArtifact["status"], string> = {
  draft: "草稿",
  pending_confirmation: "待确认",
  confirmed: "已确认",
  dismissed: "已忽略",
  expired: "已过期",
};

interface AgentArtifactCardProps {
  artifact: AgentArtifact;
  onConfirm?: (artifact: AgentArtifact) => void | Promise<void>;
  onRevise?: (artifact: AgentArtifact) => void | Promise<void>;
  onInspect?: (artifact: AgentArtifact) => void | Promise<void>;
  onDismiss?: (artifact: AgentArtifact) => void | Promise<void>;
  disabled?: boolean;
}

export function AgentArtifactCard({
  artifact,
  onConfirm,
  onRevise,
  onInspect,
  onDismiss,
  disabled,
}: AgentArtifactCardProps) {
  const isPending = artifact.status === "pending_confirmation";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.15 } }}
      transition={{ duration: 0.25, ease: [0.25, 1, 0.5, 1] }}
      className={cn(
        "mb-3 rounded-lg border p-3 transition-shadow",
        isPending
          ? "border-moss/40 bg-white shadow-sm shadow-moss/10"
          : "border-neutral-200 bg-white",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-semibold text-neutral-900">{artifact.title}</h4>
        <Badge
          className={
            artifact.status === "confirmed"
              ? "bg-moss/25 px-2 py-0 text-[10px] text-moss/70"
              : artifact.status === "dismissed"
                ? "bg-neutral-200 px-2 py-0 text-[10px] text-neutral-500"
                : isPending
                  ? "bg-moss/15 px-2 py-0 text-[10px] text-moss"
                  : "bg-neutral-100 px-2 py-0 text-[10px] text-neutral-500"
          }
        >
          {ARTIFACT_STATUS_LABELS[artifact.status]}
        </Badge>
      </div>
      <p className="mt-1.5 text-xs leading-5 text-neutral-600">{artifact.summary}</p>
      {artifact.rationale && (
        <p className="mt-1.5 text-xs leading-5 text-neutral-500">{artifact.rationale}</p>
      )}
      {artifact.impact.length > 0 && (
        <ul className="mt-2 space-y-0.5">
          {artifact.impact.map((item) => (
            <li key={item} className="flex items-center gap-1 text-xs text-neutral-500">
              <ArrowRight className="h-3 w-3 shrink-0 text-neutral-400" />
              {item}
            </li>
          ))}
        </ul>
      )}
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        {artifact.type === "proposal" && isPending && onConfirm && (
          <Button
            size="sm"
            className="h-7 gap-1 bg-moss px-2.5 text-xs text-white shadow-sm shadow-moss/20 hover:bg-moss/90 active:shadow-none"
            disabled={disabled}
            onClick={() => void onConfirm(artifact)}
          >
            <BadgeCheck className="h-3.5 w-3.5" />
            确认应用
          </Button>
        )}
        {(artifact.status === "draft" || isPending) && onRevise && (
          <Button
            variant="outline"
            size="sm"
            className="h-7 gap-1 border-neutral-200 px-2 text-xs text-neutral-600 hover:bg-neutral-50 hover:text-neutral-800"
            disabled={disabled}
            onClick={() => void onRevise(artifact)}
          >
            <Pencil className="h-3 w-3" />
            继续修改
          </Button>
        )}
        {(artifact.status === "draft" || isPending) && onInspect && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 px-2 text-xs text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700"
            disabled={disabled}
            onClick={() => void onInspect(artifact)}
          >
            <ArrowRight className="h-3 w-3" />
            查看影响
          </Button>
        )}
        {artifact.type !== "proposal" && artifact.status === "draft" && onDismiss && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 px-2 text-xs text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700"
            disabled={disabled}
            onClick={() => void onDismiss(artifact)}
          >
            <XCircle className="h-3 w-3" />
            知道了
          </Button>
        )}
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// AgentSuggestionRow
// ---------------------------------------------------------------------------

interface AgentSuggestionRowProps {
  suggestions: AgentSuggestion[];
  disabled?: boolean;
  onPick: (instruction: string) => void;
}

export function AgentSuggestionRow({ suggestions, disabled = false, onPick }: AgentSuggestionRowProps) {
  const visible = suggestions.slice(0, 3);
  if (visible.length === 0) return null;

  return (
    <motion.div
      className="mt-3 flex flex-wrap gap-1.5"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
    >
      {visible.map((suggestion, index) => (
        <motion.button
          key={suggestion.id}
          type="button"
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: 0.2,
            delay: index * 0.06,
            ease: [0.25, 1, 0.5, 1],
          }}
          onClick={() => onPick(suggestion.user_instruction)}
          disabled={disabled}
          className={cn(
            "rounded-full border px-2.5 py-1 text-[11px] transition-all disabled:cursor-not-allowed disabled:opacity-50",
            suggestion.priority === "primary"
              ? "border-moss/30 bg-white text-moss hover:border-moss/40 hover:bg-moss/5"
              : "border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300 hover:text-neutral-800"
          )}
        >
          {suggestion.label}
        </motion.button>
      ))}
    </motion.div>
  );
}
