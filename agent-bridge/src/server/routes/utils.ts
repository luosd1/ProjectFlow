/**
 * Shared utilities for route handlers.
 */

import type { ServerResponse } from "node:http";

export function sendJson(res: ServerResponse, status: number, data: unknown): void {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

export function readJsonBody<T>(
  res: ServerResponse,
  bodyText: string,
  parser: (data: unknown) => T | null,
): T | null {
  try {
    const data = JSON.parse(bodyText);
    const result = parser(data);
    if (result === null) {
      sendJson(res, 400, { error: "validation_error", message: "Invalid request body" });
      return null;
    }
    return result;
  } catch {
    sendJson(res, 400, { error: "parse_error", message: "Invalid JSON body" });
    return null;
  }
}
