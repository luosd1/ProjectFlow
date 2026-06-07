"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { AgentConversationMessage } from "@/lib/types";
import { MarkdownContent } from "./MarkdownContent";
import { MessageActions } from "./MessageActions";

interface ChatMessageProps {
  message: AgentConversationMessage;
  isLast?: boolean;
  onRetry?: () => void;
  onAction?: (instruction: string) => void;
  index?: number;
}

const QUICK_REPLY_DISPLAY_MAP: Record<string, string> = {
  "请执行 push 模块：生成下一步行动卡。用户点击了快捷回复「生成下一步行动卡」，请直接运行 push 模块生成行动卡。": "生成下一步行动卡",
  "请执行 risk 模块：分析当前风险。用户点击了快捷回复「分析当前风险」，请直接运行 risk 模块进行风险分析。": "分析当前风险",
  "请执行 replan 模块：根据签到结果调整项目计划。用户点击了快捷回复「根据签到调整计划」，请直接运行 replan 模块生成计划调整草案。": "根据签到调整计划",
  "请执行 assign 模块：根据成员情况推荐分工。用户点击了快捷回复「根据成员情况推荐分工」，请直接运行 assign 模块。": "根据成员情况推荐分工",
  "请执行 breakdown 模块：把当前阶段拆成可执行任务。用户点击了快捷回复「把当前阶段拆成任务」，请直接运行 breakdown 模块。": "把当前阶段拆成任务",
  "请执行 plan 模块：按三周节奏生成阶段计划。用户点击了快捷回复「按三周节奏生成阶段计划」，请直接运行 plan 模块。": "按三周节奏生成阶段计划",
  "请执行 clarify 模块：澄清项目方向。用户点击了快捷回复「先帮我澄清方向」，请直接运行 clarify 模块。": "先帮我澄清方向",
};

function displayContent(message: AgentConversationMessage): string {
  if (message.role === "user") {
    return QUICK_REPLY_DISPLAY_MAP[message.content] ?? message.content;
  }
  return message.content;
}

export function ChatMessage({ message, isLast, onRetry, onAction, index = 0 }: ChatMessageProps) {
  const isUser = message.role === "user";

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.2,
        delay: Math.min(index * 0.04, 0.3),
        ease: [0.25, 1, 0.5, 1],
      }}
      className={cn(
        "rounded-lg border p-3",
        isUser
          ? "ml-8 border-neutral-200 bg-white text-neutral-700"
          : "mr-0 border-moss/20 bg-moss/5 text-neutral-700",
      )}
    >
      <div className="mb-1 text-[10px] font-semibold text-neutral-400">
        {isUser ? "你" : "Agent"}
      </div>
      {isUser ? (
        <p className="text-xs leading-5">{displayContent(message)}</p>
      ) : (
        <MarkdownContent content={message.content} />
      )}
      {!isUser && isLast && (
        <MessageActions
          message={message}
          onCopy={() => navigator.clipboard.writeText(message.content)}
          onRetry={onRetry}
          onAction={onAction}
        />
      )}
    </motion.div>
  );
}
