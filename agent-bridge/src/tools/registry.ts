/**
 * Tool registry — registers and manages ProjectFlow tools.
 * Maps tool names to their manifests and execution backends.
 */

import type { ProjectFlowToolManifest } from "@/types/tool-manifest.js";
import type { FastapiClient } from "./fastapi-client.js";

export interface RegisteredTool {
  manifest: ProjectFlowToolManifest;
  /** Execute the tool via FastAPI internal endpoint. */
  execute: (args: Record<string, unknown>, context: ToolExecutionContext) => Promise<unknown>;
}

export interface ToolExecutionContext {
  runId: string;
  toolCallId: string;
  conversationId: string;
  workspaceId: string;
  projectId: string;
  idempotencyKey: string;
}

export class ToolRegistry {
  private readonly tools = new Map<string, RegisteredTool>();

  /** Register a tool with its manifest and execution function. */
  register(tool: RegisteredTool): void {
    this.tools.set(tool.manifest.name, tool);
  }

  /** Get a registered tool by name. */
  get(name: string): RegisteredTool | undefined {
    return this.tools.get(name);
  }

  /** Get all registered tool manifests. */
  getManifests(): ProjectFlowToolManifest[] {
    return Array.from(this.tools.values()).map((t) => t.manifest);
  }

  /** Get only model-callable tool manifests. */
  getModelCallableManifests(): ProjectFlowToolManifest[] {
    return this.getManifests().filter((m) => m.modelCallable);
  }

  /** Check if a tool is registered. */
  has(name: string): boolean {
    return this.tools.has(name);
  }

  /** Get the number of registered tools. */
  get size(): number {
    return this.tools.size;
  }
}

/**
 * Create a default tool execution function that calls FastAPI internal endpoints.
 */
export function createFastapiToolExecutor(fastapiClient: FastapiClient) {
  return async (args: Record<string, unknown>, context: ToolExecutionContext): Promise<unknown> => {
    return fastapiClient.callTool(context.runId, {
      run_id: context.runId,
      tool_call_id: context.toolCallId,
      conversation_id: context.conversationId,
      workspace_id: context.workspaceId,
      project_id: context.projectId,
      idempotency_key: context.idempotencyKey,
      ...args,
    });
  };
}
