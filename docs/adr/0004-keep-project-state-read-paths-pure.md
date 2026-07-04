# Keep Project State Read Paths Pure

Status: accepted

ProjectFlow will keep ProjectState, WorkspaceState, timeline, and Agent read-only tools free of hidden state repair. `GET /api/projects/{project_id}/state` and internal read-only tools may compute derived views, but they must not mutate ORM objects, call `flush()`/`commit()`, or call services that can advance Stage/Project state.

We chose this over read-time catch-up because stage/project advancement changes Primary Project State. Deterministic advancement may still happen inside explicit command paths such as a human task-status update, and stale data from seed/import/direct DB edits should be repaired through an explicit maintenance command or job.
