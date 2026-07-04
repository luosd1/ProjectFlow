/**
 * Advisory boundary — ensures advisory writes (Risk, ActionCard) do not touch primary state.
 *
 * Advisory Project Records (Risk at any severity, ActionCard) can be created directly.
 * Only mitigation that touches primary state (Task/Stage/Project) must go through replan proposal.
 */

import type { ProjectFlowToolManifest } from "@/types/tool-manifest.js";

export interface AdvisoryBoundaryCheck {
  allowed: boolean;
  reason: string;
}

/**
 * Check if a tool is allowed to create an advisory record.
 * Advisory-write tools can create Risk/ActionCard at any severity.
 */
export function checkAdvisoryCreation(manifest: ProjectFlowToolManifest): AdvisoryBoundaryCheck {
  if (manifest.riskCategory !== "advisory_write") {
    return {
      allowed: false,
      reason: `工具 ${manifest.name} 不是 advisory_write，不能创建咨询记录`,
    };
  }

  if (manifest.effects.effectType !== "advisory_record_create") {
    return {
      allowed: false,
      reason: `工具 ${manifest.name} 的效果类型不是 advisory_record_create`,
    };
  }

  return { allowed: true, reason: "允许创建咨询记录" };
}

/**
 * Check if a risk mitigation action requires a replan proposal.
 * If mitigation touches primary state (Task/Stage/Project), it must go through proposal.
 */
export function requiresReplanProposal(mitigation: {
  touchesTaskStatus?: boolean;
  touchesStageStatus?: boolean;
  touchesProjectDirection?: boolean;
  touchesOwnership?: boolean;
}): boolean {
  return (
    mitigation.touchesTaskStatus === true ||
    mitigation.touchesStageStatus === true ||
    mitigation.touchesProjectDirection === true ||
    mitigation.touchesOwnership === true
  );
}
