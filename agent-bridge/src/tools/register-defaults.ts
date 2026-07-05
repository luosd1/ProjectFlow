/**
 * Register default ProjectFlow tools into the ToolRegistry.
 * Called during run initialization before executeRun().
 */

import type { FastapiClient } from "./fastapi-client.js";
import type { ToolRegistry } from "./registry.js";
import { createReadOnlyTools, createProposalTools } from "./projectflow-tools.js";

/**
 * Register all default tools (read-only + proposal) into the registry.
 */
export function registerDefaultTools(registry: ToolRegistry, fastapiClient: FastapiClient): void {
  for (const tool of createReadOnlyTools(fastapiClient)) {
    registry.register(tool);
  }
  for (const tool of createProposalTools(fastapiClient)) {
    registry.register(tool);
  }
}
