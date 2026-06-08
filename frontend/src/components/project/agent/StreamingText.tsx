"use client";

import { motion } from "framer-motion";
import { MarkdownContent } from "./MarkdownContent";

interface StreamingTextProps {
  buffer: string;
  className?: string;
}

export function StreamingText({ buffer, className }: StreamingTextProps) {
  if (!buffer) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.15 }}
      className={className}
    >
      <MarkdownContent content={buffer} />
      <motion.span
        className="ml-0.5 inline-block h-3.5 w-px bg-moss"
        animate={{ opacity: [1, 0] }}
        transition={{
          duration: 0.8,
          repeat: Infinity,
          repeatType: "reverse",
          ease: "easeInOut",
        }}
        aria-hidden="true"
      />
    </motion.div>
  );
}
