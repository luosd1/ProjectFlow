# Issue tracker: GitHub

Issues and PRDs for this repo live as GitHub issues on the upstream repo (`wubq511/ProjectFlow`). Skills operate on the upstream issue tracker.

## Conventions

- **Read an issue**: `curl -skL "https://api.github.com/repos/wubq511/ProjectFlow/issues/<number>"` via GitHub API with token auth.
- **List issues**: `curl -skL "https://api.github.com/repos/wubq511/ProjectFlow/issues?state=open&labels=<label>"` via GitHub API.
- **Comment on an issue**: `curl -skL -X POST -H "Authorization: token <token>" "https://api.github.com/repos/wubq511/ProjectFlow/issues/<number>/comments" -d '{"body":"..."}'`.
- **Create an issue**: `curl -skL -X POST -H "Authorization: token <token>" "https://api.github.com/repos/wubq511/ProjectFlow/issues" -d '{"title":"...","body":"...","labels":[...]}'`.

Auth token is stored in `.git/credentials` for the `luosd1` account.

## Pull requests as a triage surface

**PRs as a request surface: no.** External PRs are not treated as feature requests.

## When a skill says "publish to the issue tracker"

Create a GitHub issue on upstream via API. Label with appropriate triage labels.

## When a skill says "fetch the relevant ticket"

Fetch the issue via GitHub API using `curl -skL` with token auth.
