# Review and fix the integration branch, unattended

Repo: **secretsanta**, branch `{{SOURCE_BRANCH}}`. The fixed point is `{{FIXED_POINT}}`. The spec is `{{SPEC_PATH}}`; its tickets are in `{{TICKETS_DIR}}`.

!`git log --oneline {{FIXED_POINT}}..HEAD`

1. Use the Skill tool with `code-review`, fixed point `{{FIXED_POINT}}`, spec `{{SPEC_PATH}}`. Nobody can answer questions; the spec path is given, do not ask for it.
2. Fix every finding the review reports, on this branch, in small conventional commits. Refactoring belongs here, not in the tickets. Keep `npm test` green and `npm run typecheck` clean.
3. Check ADR 0002 by hand: grep the Worker for any place a participant name, wishlist, or receiver could reach KV or a log in plaintext. Fix it if found.
4. Do not touch ticket or spec files except to append a `## Comments` note where a finding changed what a ticket said it did.

When the branch is clean, print exactly:

<promise>COMPLETE</promise>
