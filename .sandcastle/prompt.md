# You are implementing one ticket, unattended

Repo: **secretsanta**. You are on branch `{{SOURCE_BRANCH}}`, a worktree of the integration branch. Nobody is watching; nobody can answer a question. Decide, write it down in the commit message, move on.

## Read first, in this order

1. The ticket: `{{TICKET_PATH}}`
2. The spec it came from: `{{SPEC_PATH}}`, especially **Implementation Decisions** and **Testing Decisions**
3. `GLOSSARY.md` and `CLAUDE.md`. Every noun in code, tests and copy comes from the glossary.
4. The ADRs in `docs/adr/`.

What is already on this branch (earlier tickets may have landed):

!`git log --oneline -15`

!`git status --short`

## Rules

- Use the Skill tool with `tdd`. The seams are already agreed: they are the spec's **Testing Decisions**. Do not ask to confirm them; treat them as confirmed.
- Only this ticket. Do not start, edit or resolve any other ticket file. Do not change the spec.
- The ticket's acceptance criteria are the definition of done. Each one must be true; tick it (`- [x]`) in the ticket file when it is. A criterion that needs a human (a real deploy, a dashboard) is ticked only if the ticket says it is yours.
- Run `npm test` and `npm run typecheck` before you finish. Both must pass.
- Commit as you go with conventional-commit messages (`feat:`, `test:`, `chore:`); the body says why when it is not obvious. Never amend or rebase. Never push.
- No new runtime dependencies unless the ticket or spec names them.
- Every user-visible string goes through i18n with an `en` and a `fr` entry.
- If a previous iteration already did part of this ticket (see the log above), continue from where it stopped; do not redo it.

## When done

Set the ticket's `**Status:**` line to `resolved`, commit that, then print exactly:

<promise>COMPLETE</promise>

If you cannot finish, because a criterion is impossible or a decision is genuinely not yours, leave a `## Comments` section at the bottom of the ticket saying what blocks you, set `**Status:** blocked`, commit, and print:

<promise>BLOCKED</promise>
