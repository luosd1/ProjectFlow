"use client";

import { useCallback, useRef, useEffect, type FormEvent, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { Loader2, Send, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ChatComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (content: string) => void;
  onStop?: () => void;
  disabled?: boolean;
  isStreaming?: boolean;
  maxLength?: number;
}

export function ChatComposer({
  value,
  onChange,
  onSubmit,
  onStop,
  disabled,
  isStreaming,
  maxLength = 4000,
}: ChatComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const lineHeight = 20;
    const maxLines = 6;
    el.style.height = `${Math.min(el.scrollHeight, lineHeight * maxLines)}px`;
  }, [value]);

  const handleSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      const trimmed = value.trim();
      if (!trimmed || disabled) return;
      onSubmit(trimmed);
    },
    [value, disabled, onSubmit],
  );

  const handleKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        const trimmed = value.trim();
        if (!trimmed || disabled) return;
        onSubmit(trimmed);
      }
    },
    [value, disabled, onSubmit],
  );

  const nearLimit = value.length > maxLength * 0.9;

  return (
    <form onSubmit={handleSubmit}>
      <div className="rounded-lg border border-neutral-200 bg-white p-2 focus-within:border-moss/40">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={2}
          placeholder="告诉 Agent 你的具体要求..."
          className="min-h-10 w-full resize-none bg-transparent text-sm text-neutral-800 outline-none placeholder:text-neutral-400"
          disabled={disabled}
          maxLength={maxLength}
        />
        <div className="mt-1 flex items-center justify-between">
          <span className={cn("text-[10px]", nearLimit ? "text-coral" : "text-neutral-300")}>
            {nearLimit ? `${value.length}/${maxLength}` : ""}
          </span>
          <div className="flex gap-1.5">
            {isStreaming && onStop ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 gap-1 px-2.5 text-xs text-coral border-coral/30 hover:bg-coral/10"
                onClick={onStop}
              >
                <Square className="h-3 w-3" />
                停止
              </Button>
            ) : (
              <Button
                type="submit"
                size="sm"
                className="h-7 gap-1 bg-moss px-2.5 text-xs text-white hover:bg-moss/90"
                disabled={!value.trim() || disabled}
              >
                {disabled ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                发送
              </Button>
            )}
          </div>
        </div>
      </div>
    </form>
  );
}
