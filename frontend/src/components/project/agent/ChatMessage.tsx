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

/**
 * Extract display text from quick reply instructions.
 * Pattern: "用户点击了快捷回复「<display text>」"
 * Falls back to original content if pattern doesn't match (truncated if too long).
 */
function displayContent(message: AgentConversationMessage): string {
  if (message.role !== "user") return message.content;
  const match = message.content.match(/「(.+?)」/);
  if (match?.[1]) return match[1];
  // Fallback: truncate long instructions to avoid showing raw prompt text
  return message.content.length > 50 ? message.content.slice(0, 50) + "…" : message.content;
}

export function ChatMessage({ message, isLast, onRetry, onAction, index = 0 }: ChatMessageProps) {
  const isUser = message.role === "user";

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.15,
        delay: Math.min(index * 0.03, 0.2),
        ease: [0.25, 1, 0.5, 1],
      }}
      className={cn(
        "rounded-md border p-3",
        isUser
          ? "ml-6 border-neutral-200 bg-white text-neutral-700"
          : "mr-0 border-neutral-100 bg-neutral-50/80 text-neutral-700",
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
