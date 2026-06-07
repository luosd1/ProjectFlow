"use client";

import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface StarterPromptsProps {
  focus: string;
  onSelect: (instruction: string) => void;
  disabled?: boolean;
}

const FOCUS_PROMPTS: Record<string, { label: string; instruction: string }[]> = {
  方向澄清: [
    { label: "帮我澄清项目方向", instruction: "请执行 clarify 模块：澄清项目方向。" },
    { label: "根据已有资料生成方向卡", instruction: "请执行 clarify 模块：根据已有资料生成方向卡。" },
    { label: "这个项目的核心价值是什么？", instruction: "这个项目的核心价值是什么？帮我和团队理清楚。" },
  ],
  阶段计划: [
    { label: "按三周节奏生成阶段计划", instruction: "请执行 plan 模块：按三周节奏生成阶段计划。" },
    { label: "按截止日期倒排阶段", instruction: "请执行 plan 模块：按截止日期倒排阶段。" },
    { label: "解释阶段划分的依据", instruction: "解释阶段划分的依据，帮我和团队理解规划逻辑。" },
  ],
  任务拆解: [
    { label: "把当前阶段拆成任务", instruction: "请执行 breakdown 模块：把当前阶段拆成可执行任务。" },
    { label: "任务拆得更细一点", instruction: "请执行 breakdown 模块：把当前阶段拆成更细的任务。" },
    { label: "优先保留 MVP 任务", instruction: "请执行 breakdown 模块：优先保留 MVP 核心任务。" },
  ],
  分工确认: [
    { label: "根据成员情况推荐分工", instruction: "请执行 assign 模块：根据成员情况推荐分工。" },
    { label: "解释分工依据", instruction: "解释当前分工推荐的依据，帮我和团队理解。" },
    { label: "查看未确认分工", instruction: "查看当前还有哪些分工没有确认。" },
  ],
  执行推进: [
    { label: "生成下一步行动卡", instruction: "请执行 push 模块：生成下一步行动卡。" },
    { label: "分析当前风险", instruction: "请执行 risk 模块：分析当前风险。" },
    { label: "查看项目整体进度", instruction: "帮我看一下项目整体进度，哪些任务完成了，哪些有风险。" },
  ],
};

export function StarterPrompts({ focus, onSelect, disabled }: StarterPromptsProps) {
  const prompts = FOCUS_PROMPTS[focus] ?? FOCUS_PROMPTS["执行推进"];

  return (
    <div className="mb-4">
      <div className="mb-2 flex items-center gap-1.5 text-xs text-neutral-400">
        <Sparkles className="h-3 w-3" />
        快速开始
      </div>
      <div className="space-y-1.5">
        {prompts.map((prompt) => (
          <button
            key={prompt.label}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(prompt.instruction)}
            className={cn(
              "w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-left text-xs text-neutral-600 transition",
              "hover:border-moss/30 hover:bg-moss/5 hover:text-moss",
              "disabled:cursor-not-allowed disabled:opacity-50",
            )}
          >
            {prompt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
