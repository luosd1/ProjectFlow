import { describe, expect, it } from "vitest";
import type { FastapiClient } from "../../src/tools/fastapi-client.js";
import { createFastapiToolExecutor } from "../../src/tools/registry.js";

describe("tool registry", () => {
  it("wraps tool arguments in the ProjectFlow tool envelope", async () => {
    let captured: Record<string, unknown> | undefined;
    const fastapiClient = {
      callTool: async (_toolName: string, payload: Record<string, unknown>) => {
        captured = payload;
        return {};
      },
    } as unknown as FastapiClient;

    const execute = createFastapiToolExecutor(fastapiClient, "get_workspace_state");
    await execute({ limit: 10 }, {
      runId: "run_1",
      toolCallId: "tc_1",
      conversationId: "conv_1",
      workspaceId: "ws_1",
      projectId: "proj_1",
      toolName: "get_workspace_state",
      toolVersion: 1,
      manifestVersion: 1,
      idempotencyKey: "key_1",
    });

    expect(captured).toMatchObject({
      run_id: "run_1",
      tool_call_id: "tc_1",
      tool_name: "get_workspace_state",
      tool_version: 1,
      manifest_version: 1,
      arguments: { limit: 10 },
    });
    expect(captured).not.toHaveProperty("limit");
  });
});
