# ProjectFlow Demo Script

Status: current as of 2026-05-29.

## 5-Minute Path

1. Reset demo data from the dashboard Reset demo button, or run:

```bash
curl -X POST http://localhost:8000/api/demo/reset
```

2. Open the returned project:

```text
http://localhost:3000/projects/<project_id>
```

3. Show the dashboard header: current stage, next recommended action, P0 count, owner coverage, and active action-card count.

4. Run or show the agent flow buttons in order: clarification, plan, breakdown, assign, active push, check-in analysis, risk analysis, replan. The mock provider/fallback path is acceptable for the local demo because outputs are still schema-validated and persisted.

5. Open the Action cards tab. Show team next actions and a personal card with a reason.

6. Open Check-in & Status. Submit a short check-in with a blocker, then update a task status to blocked or in progress.

7. Open Risks & Replan. Show risk evidence, recommendation, and the replan before/after panel.

8. Open Timeline & Export. Show timeline events, generate the review summary, and copy the Markdown preview.

## Manual Acceptance

- The app should never require a real LLM key in the MVP path.
- Agent and export actions should persist timeline records.
- Assignment ownership changes should only happen after explicit confirmation/finalization.
- Risk cards must show evidence and a recommendation.
- Demo reset must return the app to a known project state.
