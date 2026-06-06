"use client";

import {
  AlertTriangle,
  BadgeCheck,
  Clock,
  Eye,
  Loader2,
  Pencil,
  Sparkles,
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
    <div className="mb-4 rounded-lg border border-moss/20 bg-moss/5 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-moss">
          <Sparkles className="h-3.5 w-3.5" />
          当前最值得推进
        </div>
        {pendingCount > 0 && (
          <Badge className="bg-moss/15 px-2 py-0 text-[10px] text-moss">
            {pendingCount} 待确认
          </Badge>
        )}
      </div>
      <p className="mt-2 text-sm font-semibold text-neutral-900">{focus}</p>
      <p className="mt-1 text-xs leading-5 text-neutral-600">{focusReason(focus)}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// AgentRunStatusCard
// ---------------------------------------------------------------------------

const RUN_STEPS = ["读取项目状态", "判断下一步影响", "整理可确认结果"] as const;

export function AgentRunStatusCard() {
  return (
    <div className="mb-3 rounded-lg border border-moss/20 bg-moss/5 p-3">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-moss">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Agent 正在处理
      </div>
      <ul className="mt-2 space-y-1">
        {RUN_STEPS.map((step) => (
          <li key={step} className="flex items-center gap-1.5 text-xs text-neutral-500">
            <Clock className="h-3 w-3 shrink-0 text-neutral-400" />
            {step}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------------------
// AgentErrorCard
// ---------------------------------------------------------------------------

interface AgentErrorCardProps {
  message: string;
  onRetry?: () => void | Promise<void>;
}

export function AgentErrorCard({ message, onRetry }: AgentErrorCardProps) {
  return (
    <div className="mb-3 rounded-lg border border-coral/20 bg-coral/10 p-3">
      <div className="flex items-start gap-2 text-xs text-coral">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <div>
          <p className="font-semibold">Agent 暂时没有完成这次处理</p>
          <p className="mt-1 text-neutral-600">{message}</p>
        </div>
      </div>
      {onRetry && (
        <Button
          variant="ghost"
          size="sm"
          className="mt-2 h-7 gap-1 text-xs text-coral hover:bg-coral/10 hover:text-coral"
          onClick={() => void onRetry()}
        >
          重新发送
        </Button>
      )}
    </div>
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
}

export function AgentArtifactCard({
  artifact,
  onConfirm,
  onRevise,
  onInspect,
}: AgentArtifactCardProps) {
  return (
    <div className="mb-3 rounded-lg border border-neutral-200 bg-white p-3">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-semibold text-neutral-900">{artifact.title}</h4>
        <Badge className="bg-moss/15 px-2 py-0 text-[10px] text-moss">
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
              <Eye className="h-3 w-3 shrink-0" />
              {item}
            </li>
          ))}
        </ul>
      )}
      <div className="mt-2.5 flex items-center gap-1.5">
        {artifact.status === "pending_confirmation" && onConfirm && (
          <Button
            size="sm"
            className="h-7 gap-1 bg-moss px-2.5 text-xs text-white hover:bg-moss/90"
            onClick={() => void onConfirm(artifact)}
          >
            <BadgeCheck className="h-3.5 w-3.5" />
            确认应用
          </Button>
        )}
        {onRevise && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 px-2 text-xs text-neutral-600"
            onClick={() => void onRevise(artifact)}
          >
            <Pencil className="h-3 w-3" />
            继续修改
          </Button>
        )}
        {onInspect && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 px-2 text-xs text-neutral-600"
            onClick={() => void onInspect(artifact)}
          >
            <Eye className="h-3 w-3" />
            查看影响
          </Button>
        )}
      </div>
    </div>
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
    <div className="mt-3 flex flex-wrap gap-1.5">
      {visible.map((suggestion) => (
        <button
          key={suggestion.id}
          type="button"
          onClick={() => onPick(suggestion.user_instruction)}
          disabled={disabled}
          className={cn(
            "rounded-full border px-2.5 py-1 text-[11px] transition disabled:cursor-not-allowed disabled:opacity-50",
            suggestion.priority === "primary"
              ? "border-moss/30 bg-moss/10 text-moss hover:bg-moss/20"
              : "border-neutral-200 bg-white text-neutral-600 hover:border-moss/30 hover:text-moss"
          )}
        >
          {suggestion.label}
        </button>
      ))}
    </div>
  );
}
