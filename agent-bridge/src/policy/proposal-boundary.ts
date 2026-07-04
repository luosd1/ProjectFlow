/**
 * Proposal boundary — enforces that tools can create proposals but never confirm/commit them.
 *
 * Proposal Confirmation is the ONLY human confirmation boundary in the current runtime.
 * ToolExecutionApproval is NOT part of the current runtime (ADR-0001).
 */

import type { ProjectFlowToolManifest } from "@/types/tool-manifest.js";

export interface ProposalBoundaryCheck {
  allowed: boolean;
  reason: string;
}

/**
 * Check if a tool is allowed to create a proposal.
 * Draft-only tools can create proposals; confirming/committing is user-only via FastAPI.
 */
export function checkProposalCreation(manifest: ProjectFlowToolManifest): ProposalBoundaryCheck {
  if (manifest.riskCategory !== "draft_only") {
    return {
      allowed: false,
      reason: `工具 ${manifest.name} 不是 draft_only，不能创建提案`,
    };
  }

  if (manifest.effects.effectType !== "proposal_create") {
    return {
      allowed: false,
      reason: `工具 ${manifest.name} 的效果类型不是 proposal_create`,
    };
  }

  return { allowed: true, reason: "允许创建提案" };
}

/**
 * Check if an action is a human-only confirmation action.
 * These actions (confirm, reject, commit) can ONLY be triggered by humans via FastAPI public API.
 */
export function isHumanOnlyConfirmation(actionType: string): boolean {
  return ["confirm_proposal", "reject_proposal", "commit_proposal"].includes(actionType);
}
