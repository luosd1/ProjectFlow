# Use Tiered Agent Write Boundaries

Status: accepted

ProjectFlow will classify Agent tool writes by effect instead of using a blanket "can write DB" rule. LLM-callable tools may request FastAPI-owned writes for runtime metadata, reviewable draft records, typed domain proposals, and advisory project records, but they may not directly commit Primary Project State such as Project direction/status/current stage, Stage plan/status, Task scope/status/owner/dates, or finalized assignment ownership.

This preserves useful low-friction Agent outputs such as Risk, ActionCard, and AssignmentProposal while keeping high-impact Project/Stage/Task changes behind Proposal Confirmation or an equivalent human-triggered domain confirmation. Current `TaskStatusUpdate` behavior is the main boundary risk because it mutates `Task.status` and can trigger stage/project progression, so Agent-generated status changes must move behind a replan proposal or an explicit human-originated command path.

Risk severity does not by itself make Risk creation a commit effect. A high-severity Risk may be created directly as an advisory record so users can see it immediately; the mitigation that changes task status, owners, dates, stages, or project state must create a proposal and wait for confirmation.

Agent-inferred task status changes use the replan proposal path, not a separate task-status proposal type. Human-originated status updates remain direct commands.
