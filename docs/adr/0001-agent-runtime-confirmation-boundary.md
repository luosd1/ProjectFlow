# Keep Tool Execution Approval Out Of Current Agent Runtime

Status: accepted

ProjectFlow will not implement `ToolExecutionApproval` as a first-class current runtime state. The current human confirmation boundary is `AgentProposal` confirmation: LLM-callable tools may read, analyze, and create pending proposals, but they may not directly perform open-world, destructive, or direct-commit actions.

Tool execution approval remains a future extension point for tools that immediately affect external systems or real users, such as notifications, invitations, public publishing, deletion, or third-party writes. Until that ADR is introduced, the policy gate can allow, deny, or block tool calls, but it does not pause a run to wait for human approval.
