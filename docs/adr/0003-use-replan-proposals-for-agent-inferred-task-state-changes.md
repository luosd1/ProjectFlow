# Use Replan Proposals For Agent-Inferred Task State Changes

Status: accepted

ProjectFlow will route Agent-inferred task status, date, owner-sensitive, stage, and mitigation changes through the existing replan proposal path instead of introducing a separate `TaskStatusChangeProposal`. Human-submitted task status updates may still use the public status-update command path directly.

This keeps execution-time plan changes in one confirmation model: the Agent may record Risk and ActionCard advisory records immediately, but any inferred change to Primary Project State is bundled into a `replan` AgentProposal and committed only after Proposal Confirmation. A separate task-status proposal would add another confirmation UI, commit handler, and test matrix while duplicating the semantics already covered by `ReplanOutput` and `confirm_replan()`.
