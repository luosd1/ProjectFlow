import { describe, it, expect, beforeEach } from "vitest";
import { SkillIndex } from "../../src/skills/skill-index.js";
import { SkillLoader } from "../../src/skills/skill-loader.js";
import { selectSkill } from "../../src/skills/skill-selector.js";
import type { SkillMetadata } from "../../src/skills/skill-index.js";

function makeSkill(overrides: Partial<SkillMetadata> = {}): SkillMetadata {
  return {
    name: "test-skill",
    description: "Test skill for unit tests",
    location: "/skills/test-skill/SKILL.md",
    allowedTools: ["get_workspace_state"],
    references: [],
    ...overrides,
  };
}

describe("skill-system", () => {
  describe("SkillIndex", () => {
    it("stores and retrieves skills", async () => {
      const index = new SkillIndex({ skillsDir: "/nonexistent" });
      // Manually add skills for testing
      const skill = makeSkill();
      (index as any).skills.set(skill.name, skill);

      expect(index.get("test-skill")).toEqual(skill);
      expect(index.size).toBe(1);
    });

    it("returns undefined for unknown skills", async () => {
      const index = new SkillIndex({ skillsDir: "/nonexistent" });
      expect(index.get("unknown")).toBeUndefined();
    });
  });

  describe("SkillLoader", () => {
    it("tracks loaded state", () => {
      const loader = new SkillLoader();
      expect(loader.isLoaded("test")).toBe(false);
    });
  });

  describe("skill-selector", () => {
    const skills: SkillMetadata[] = [
      makeSkill({ name: "project-intake", description: "当项目目标模糊、缺少方向卡时触发" }),
      makeSkill({ name: "project-planning", description: "当需要阶段计划时触发" }),
      makeSkill({ name: "task-breakdown", description: "当需要拆分任务时触发" }),
      makeSkill({ name: "assignment-planning", description: "当需要分工时触发" }),
      makeSkill({ name: "risk-replan", description: "当有阻塞任务、风险或需要重新规划时触发" }),
      makeSkill({ name: "project-status", description: "当用户询问项目进展时触发" }),
    ];

    it("selects project-status for status queries", () => {
      const result = selectSkill(skills, { userMessage: "项目进展如何？" });
      expect(result).not.toBeNull();
      expect(result!.skill.name).toBe("project-status");
      expect(result!.confidence).toBeGreaterThan(0);
    });

    it("selects project-planning for planning requests", () => {
      const result = selectSkill(skills, { userMessage: "帮我制定一个阶段计划" });
      expect(result).not.toBeNull();
      expect(result!.skill.name).toBe("project-planning");
    });

    it("selects task-breakdown for task decomposition", () => {
      const result = selectSkill(skills, { userMessage: "帮我拆分一下任务" });
      expect(result).not.toBeNull();
      expect(result!.skill.name).toBe("task-breakdown");
    });

    it("selects assignment-planning for assignment requests", () => {
      const result = selectSkill(skills, { userMessage: "帮我分工，谁适合做这个？" });
      expect(result).not.toBeNull();
      expect(result!.skill.name).toBe("assignment-planning");
    });

    it("selects risk-replan for blocked tasks", () => {
      const result = selectSkill(skills, {
        userMessage: "项目遇到风险了",
        hasBlockedTasks: true,
      });
      expect(result).not.toBeNull();
      expect(result!.skill.name).toBe("risk-replan");
    });

    it("selects project-intake when no direction card", () => {
      const result = selectSkill(skills, {
        userMessage: "我有一个想法",
        hasDirectionCard: false,
      });
      expect(result).not.toBeNull();
      expect(result!.skill.name).toBe("project-intake");
    });

    it("returns null or low confidence for unmatched messages", () => {
      const result = selectSkill(skills, { userMessage: "今天天气不错" });
      // May find something with low confidence
      if (result) {
        expect(result.confidence).toBeLessThanOrEqual(0.6);
      }
    });
  });
});
