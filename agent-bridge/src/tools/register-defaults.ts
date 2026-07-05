/**
 * Register default ProjectFlow tools into the ToolRegistry.
 * Called during run initialization before executeRun().
 */

import type { FastapiClient } from "./fastapi-client.js";
import type { ToolRegistry } from "./registry.js";
import { createReadOnlyTools } from "./projectflow-tools.js";

/**
 * Register all default read-only tools into the registry.
 */
export function registerDefaultTools(registry: ToolRegistry, fastapiClient: FastapiClient): void {
  for (const tool of createReadOnlyTools(fastapiClient)) {
    registry.register(tool);
  }
}
