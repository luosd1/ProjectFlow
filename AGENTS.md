# ProjectFlow Agent Instructions

Read and follow [CLAUDE.md](./CLAUDE.md) first. This file exists so Codex/OpenAI agents do not miss the project guidance when they do not automatically load Claude-style instructions.

Current code still contains the legacy `CoordinatorAgent` implementation. For new Agent Runtime planning and implementation, the source of truth is the T41 architecture set:

- [docs/T41/ProjectFlow_Agent_Runtime_Team_TDD.md](./docs/T41/ProjectFlow_Agent_Runtime_Team_TDD.md)
- [docs/T41/ProjectFlow_Agent_Runtime_Foundation_Design.md](./docs/T41/ProjectFlow_Agent_Runtime_Foundation_Design.md)
- [docs/T41/ProjectFlow_Agent_Tools_Skills_Design.md](./docs/T41/ProjectFlow_Agent_Tools_Skills_Design.md)
- [CONTEXT.md](./CONTEXT.md)
- [docs/adr/](./docs/adr/)

Do not treat older MVP docs that say "Single Coordinator Agent" as the target runtime architecture. That phrase describes the shipped MVP/legacy implementation only.
