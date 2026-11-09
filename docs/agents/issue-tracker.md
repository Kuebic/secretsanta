# Issue tracker: GitHub, mirrored locally

Issues for this repo live in GitHub Issues on `Kuebic/secretsanta` (`gh issue ...`). Triage label for agent-ready work is `ready-for-agent`; work that needs a person (dashboard, secrets, a real deploy) carries `hitl`.

## Mirror for the autonomous loop

Sandcastle works from files, not from GitHub: each effort has `.scratch/<effort>/spec.md` and one file per ticket in `.scratch/<effort>/issues/NN-<slug>.md`, where `NN` is the GitHub issue number. Each file carries a `**Status:**` line (`ready-for-agent`, `resolved`, `blocked`, `human`) and a `**GitHub:**` line pointing at the issue. The loop reads status off the integration branch, so a re-run resumes.

## When a skill says "publish to the issue tracker"

Create the GitHub issue first, then the mirror file with the same number. Blocking edges are written as `Blocked by` lists in both places.

## When a skill says "fetch the relevant ticket"

Read the mirror file; `gh issue view <n>` has the same content plus comments.

## Closing

Issues are closed by the human when the integration branch merges (the PR body lists `Closes #n` for every resolved ticket). Agents never close issues.
