/**
 * Tests for ProjectFlow read-only tools.
 * Verifies manifest completeness, read-only semantics, and registration.
 */

import { describe, it, expect } from "vitest";
import { createReadOnlyTools } from "../../src/tools/projectflow-tools.js";
import { registerDefaultTools } from "../../src/tools/register-defaults.js";
import { ToolRegistry } from "../../src/tools/registry.js";
import type { FastapiClient } from "../../src/tools/fastapi-client.js";
import type { ProjectFlowToolManifest } from "../../src/types/tool-manifest.js";

// Stub FastapiClient for tests
function createStubFastapiClient(): FastapiClient {
  return {
    getPublic: async () => ({}),
    startRun: async () => ({ run_id: "test", status: "created" }),
    getRunStatus: async () => ({ run_id: "test", status: "created", current_turn: 0, current_step: 0, last_event_seq: 0, created_at: "", updated_at: "" }),
    appendEvents: async () => ({ state_version: 1, events: [], tool_results: [] }),
    cancelRun: async () => ({ run_id: "test", status: "cancelled", cancelled: true }),
    callTool: async () => ({}),
  } as unknown as FastapiClient;
}

const TOOL_NAMES = [
  "get_workspace_state",
  "get_agent_conversation",
  "list_pending_proposals",
  "get_timeline_slice",
];

describe("projectflow-tools", () => {
  describe("createReadOnlyTools", () => {
    it("returns exactly 4 tools", () => {
      const tools = createReadOnlyTools(createStubFastapiClient());
      expect(tools.length).toBe(4);
    });

    it("each tool has a unique name", () => {
      const tools = createReadOnlyTools(createStubFastapiClient());
      const names = tools.map((t) => t.manifest.name);
      expect(names.sort()).toEqual([...TOOL_NAMES].sort());
    });

    it("each tool has an execute function", () => {
      const tools = createReadOnlyTools(createStubFastapiClient());
      for (const tool of tools) {
        expect(typeof tool.execute).toBe("function");
      }
    });
  });

  describe("manifest completeness", () => {
    const tools = createReadOnlyTools(createStubFastapiClient());

    for (const tool of tools) {
      const m = tool.manifest;

      describe(m.name, () => {
        it("has schemaVersion", () => {
          expect(m.schemaVersion).toBe(1);
        });

        it("has version", () => {
          expect(m.version).toBe(1);
        });

        it("has non-empty description", () => {
          expect(m.description.length).toBeGreaterThan(0);
        });

        it("has inputSchema", () => {
          expect(m.inputSchema).toBeDefined();
        });

        it("has outputSchema", () => {
          expect(m.outputSchema).toBeDefined();
        });

        it("has backend config", () => {
          expect(m.backend).toBeDefined();
          expect(m.backend.owner).toBe("fastapi");
          expect(m.backend.endpoint.length).toBeGreaterThan(0);
        });

        it("has execution config", () => {
          expect(m.execution).toBeDefined();
          expect(typeof m.execution.maxConcurrency).toBe("number");
        });

        it("has timeoutMs > 0", () => {
          expect(m.timeoutMs).toBeGreaterThan(0);
        });

        it("has retry config", () => {
          expect(m.retry).toBeDefined();
          expect(typeof m.retry.maxAttempts).toBe("number");
        });

        it("has resultLimit config", () => {
          expect(m.resultLimit).toBeDefined();
          expect(typeof m.resultLimit.maxBytes).toBe("number");
          expect(m.resultLimit.maxBytes).toBeGreaterThan(0);
        });

        it("has effects config", () => {
          expect(m.effects).toBeDefined();
        });

        it("has privacy config", () => {
          expect(m.privacy).toBeDefined();
          expect(m.privacy.dataClassification).toBeDefined();
        });

        it("has errors config", () => {
          expect(m.errors).toBeDefined();
          expect(m.errors.modelVisibleErrorPolicy).toBeDefined();
        });

        it("has resume config", () => {
          expect(m.resume).toBeDefined();
          expect(m.resume.manifestVersion).toBe(1);
        });

        it("has trace config", () => {
          expect(m.trace).toBeDefined();
          expect(Array.isArray(m.trace.emits)).toBe(true);
        });
      });
    }
  });

  describe("read-only semantics", () => {
    const tools = createReadOnlyTools(createStubFastapiClient());

    for (const tool of tools) {
      const m = tool.manifest;

      describe(m.name, () => {
        it("riskCategory is read_only", () => {
          expect(m.riskCategory).toBe("read_only");
        });

        it("annotations.readOnly is true", () => {
          expect(m.annotations.readOnly).toBe(true);
        });

        it("annotations.destructive is false", () => {
          expect(m.annotations.destructive).toBe(false);
        });

        it("annotations.openWorld is false", () => {
          expect(m.annotations.openWorld).toBe(false);
        });

        it("effects.effectType is none", () => {
          expect(m.effects.effectType).toBe("none");
        });

        it("effects.idempotencyKeyRequired is false", () => {
          expect(m.effects.idempotencyKeyRequired).toBe(false);
        });

        it("effects.replaySafe is true", () => {
          expect(m.effects.replaySafe).toBe(true);
        });

        it("execution.mode is parallel", () => {
          expect(m.execution.mode).toBe("parallel");
        });

        it("modelCallable is true", () => {
          expect(m.modelCallable).toBe(true);
        });

        it("sidecarOnly is false", () => {
          expect(m.sidecarOnly).toBe(false);
        });

        it("humanTriggeredOnly is false", () => {
          expect(m.humanTriggeredOnly).toBe(false);
        });
      });
    }
  });

  describe("no commit effect on LLM-callable tools", () => {
    const tools = createReadOnlyTools(createStubFastapiClient());

    for (const tool of tools) {
      it(`${tool.manifest.name} does not have commit_persisted effect`, () => {
        expect(tool.manifest.effects.effectType).not.toBe("commit_persisted");
      });
    }
  });

  describe("registerDefaultTools", () => {
    it("registers all 4 tools into the registry", () => {
      const registry = new ToolRegistry();
      const client = createStubFastapiClient();
      registerDefaultTools(registry, client);
      expect(registry.size).toBe(4);
      for (const name of TOOL_NAMES) {
        expect(registry.has(name)).toBe(true);
      }
    });

    it("all registered tools are model-callable", () => {
      const registry = new ToolRegistry();
      registerDefaultTools(registry, createStubFastapiClient());
      const manifests = registry.getModelCallableManifests();
      expect(manifests.length).toBe(4);
    });

    it("getManifests returns all 4 manifests", () => {
      const registry = new ToolRegistry();
      registerDefaultTools(registry, createStubFastapiClient());
      const manifests = registry.getManifests();
      expect(manifests.length).toBe(4);
      const names = manifests.map((m: ProjectFlowToolManifest) => m.name).sort();
      expect(names).toEqual([...TOOL_NAMES].sort());
    });
  });
});
