import { describe, it, expect } from "vitest";
import {
  toSnakeCase,
  toCamelCase,
  camelizeKeys,
  snakifyKeys,
  parseRunStartRequest,
} from "../../src/types/wire.js";

describe("wire format", () => {
  describe("toSnakeCase", () => {
    it("converts camelCase to snake_case", () => {
      expect(toSnakeCase("camelCase")).toBe("camel_case");
      expect(toSnakeCase("runId")).toBe("run_id");
      expect(toSnakeCase("toolCallId")).toBe("tool_call_id");
      expect(toSnakeCase("already")).toBe("already");
    });
  });

  describe("toCamelCase", () => {
    it("converts snake_case to camelCase", () => {
      expect(toCamelCase("snake_case")).toBe("snakeCase");
      expect(toCamelCase("run_id")).toBe("runId");
      expect(toCamelCase("tool_call_id")).toBe("toolCallId");
      expect(toCamelCase("already")).toBe("already");
    });
  });

  describe("camelizeKeys", () => {
    it("converts object keys to camelCase", () => {
      const input = { run_id: "123", tool_name: "test", nested_obj: { inner_val: 42 } };
      const result = camelizeKeys(input) as any;
      expect(result.runId).toBe("123");
      expect(result.toolName).toBe("test");
      expect(result.nestedObj.innerVal).toBe(42);
    });

    it("handles arrays", () => {
      const input = [{ item_id: 1 }, { item_id: 2 }];
      const result = camelizeKeys(input) as any[];
      expect(result[0].itemId).toBe(1);
      expect(result[1].itemId).toBe(2);
    });

    it("handles null and primitives", () => {
      expect(camelizeKeys(null)).toBe(null);
      expect(camelizeKeys("hello")).toBe("hello");
      expect(camelizeKeys(42)).toBe(42);
    });
  });

  describe("snakifyKeys", () => {
    it("converts object keys to snake_case", () => {
      const input = { runId: "123", toolName: "test", nestedObj: { innerVal: 42 } };
      const result = snakifyKeys(input) as any;
      expect(result.run_id).toBe("123");
      expect(result.tool_name).toBe("test");
      expect(result.nested_obj.inner_val).toBe(42);
    });
  });

  describe("parseRunStartRequest", () => {
    it("parses valid request", () => {
      const input = {
        conversation_id: "conv_123",
        workspace_id: "ws_456",
        project_id: "proj_789",
      };
      const result = parseRunStartRequest(input);
      expect(result).not.toBeNull();
      expect(result!.conversation_id).toBe("conv_123");
      expect(result!.workspace_id).toBe("ws_456");
      expect(result!.project_id).toBe("proj_789");
    });

    it("rejects invalid request (missing required fields)", () => {
      expect(parseRunStartRequest({})).toBeNull();
      expect(parseRunStartRequest({ conversation_id: "c" })).toBeNull();
      expect(parseRunStartRequest(null)).toBeNull();
      expect(parseRunStartRequest("string")).toBeNull();
    });
  });
});
