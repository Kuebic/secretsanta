# Secret Santa

Blind gift-exchange planner. Fork of arcanis/secretsanta being rebuilt as a Worker-backed app; see `docs/adr/`.

## Commands

- `npm install`, `npm run dev` (Vite), `npm test` (Vitest), `npm run typecheck`
- `npm run sandcastle` runs the autonomous ticket loop; `DRY_RUN=1` prints the plan

## Conventions

- TypeScript, React 18, react-router, Tailwind, framer-motion, i18next. No new runtime dependencies unless a ticket names them.
- Every user-visible string goes through i18n with an `en` and a `fr` entry in `src/i18n/`.
- Names in code, tests and copy come from `GLOSSARY.md`. Use Giver/Receiver, Draw/Assignment, Organizer's note, never the avoided words.
- Nothing a participant typed may reach the server or a log in plaintext (ADR 0002). URL fragments carry keys and tokens; never move them to the query string or a request body.
- Tests at the seams listed in the active spec's Testing Decisions only. Property tests use fast-check.
- Conventional commits. Never amend, rebase or push from an agent.

## Agent skills

### Issue tracker

GitHub Issues on Kuebic/secretsanta, mirrored as files under `.scratch/<effort>/issues/` for the Sandcastle loop. See `docs/agents/issue-tracker.md`.

### Domain docs

Single-context: `GLOSSARY.md` at the root, ADRs in `docs/adr/`. See `docs/agents/domain.md`.
