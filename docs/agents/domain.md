# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

## Before exploring, read these

- **`CONTEXT.md`** at the repo root — project domain vocabulary and T41 Agent Runtime glossary.
- **`CLAUDE.md`** at the repo root — project overview, architecture, coding rules, and agent workflow.
- **`docs/adr/`** — read ADRs that touch the area you're about to work in.
- **`docs/T41/`** — read T41 design docs for the Agent Runtime architecture context.

If any of these files don't exist, proceed silently.

## File structure

Single-context repo:

```
/
├── CONTEXT.md
├── CLAUDE.md
├── docs/adr/
└── docs/T41/
```

## Use the glossary's vocabulary

When your output names a domain concept, use the term as defined in `CONTEXT.md`. Don't drift to synonyms.

## Flag ADR conflicts

If your output contradicts an existing ADR, surface it explicitly rather than silently overriding.
