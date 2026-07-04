/**
 * Shared hash utility — used by result-normalizer and trace-envelope.
 */

import { createHash } from "node:crypto";

/**
 * Hash a value to a short hex string (SHA-256, first 16 chars).
 * Used for trace input/output hashes — never includes raw data.
 */
export function hashValue(value: unknown): string {
  const str = typeof value === "string" ? value : JSON.stringify(value ?? "");
  return createHash("sha256").update(str).digest("hex").slice(0, 16);
}
