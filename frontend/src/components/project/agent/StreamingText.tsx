"use client";

import React, { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { MarkdownContent } from "./MarkdownContent";

interface StreamingTextProps {
  buffer: string;
  className?: string;
  isStreaming?: boolean;
}

export const StreamingText = React.memo(function StreamingText({ buffer, className, isStreaming = true }: StreamingTextProps) {
  const [displayBuffer, setDisplayBuffer] = useState("");
  const lastRenderRef = useRef(Date.now());

  useEffect(() => {
    const now = Date.now();
    const elapsed = now - lastRenderRef.current;
    if (elapsed >= 100 || !isStreaming) {
      setDisplayBuffer(buffer);
      lastRenderRef.current = now;
    } else {
      const timer = setTimeout(() => {
        setDisplayBuffer(buffer);
        lastRenderRef.current = Date.now();
      }, 100 - elapsed);
      return () => clearTimeout(timer);
    }
  }, [buffer, isStreaming]);

  if (!displayBuffer) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.15 }}
      className={className}
    >
      <MarkdownContent content={displayBuffer} />
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
});
