# Worker rebuild

Turn the static Secret Santa planner into a Worker-backed app with stable participant links, wishlists and an organizer status view, without the server ever seeing plaintext.

Vocabulary: `GLOSSARY.md`. Decisions: `docs/adr/0001` (one Worker), `0002` (zero-knowledge), `0003` (stable links). Tickets: `issues/` beside this file, mirrored as GitHub issues #1–#14 on Kuebic/secretsanta.

## Implementation Decisions

### Hosting

- One Cloudflare Worker. `worker/` holds a plain `fetch` handler, no framework. Static assets from the Vite build; SPA fallback for unknown paths; `/api/*` is the API.
- Vite `base` is `/`. The GitHub Pages workflow is removed. Deploys are `npm run deploy` from the organizer's machine (wrangler OAuth). Account id matches the sibling repos (`5e7c03d562a80de198b3edeb8212639c`).
- KV binding `EVENTS`. Namespace id is a placeholder until the human ticket fills it; tests and `wrangler dev` use local KV.
- No static-only mode for new events. Legacy `/pairing?from=&to=` links keep working through the existing decrypt path.

### Identifiers and keys

- Browser mints everything: event id 128-bit, event key 256-bit AES-GCM, organizer token 128-bit, one participant token 128-bit per participant. Base64url, no padding.
- Organizer link: `/o/<eventId>#<eventKey>.<organizerToken>`. Participant link: `/p/<eventId>/<participantId>#<eventKey>.<participantToken>`. Nothing after `#` is ever sent to the server.
- Assignment key per giver: HKDF-SHA256 over the event key with the giver's participant token as salt, info `"assignment"`. Only that giver's link decrypts their assignment.

### Server data (all values ciphertext unless noted)

- `event:<id>:meta` — plaintext: `organizerTokenHash`, `createdAt`, `updatedAt`.
- `event:<id>:details` — ciphertext: title, budget, date, location, notes.
- `event:<id>:roster` — ciphertext: `{ [participantId]: { name, note } }` plus participant token hashes in plaintext so the server can authorize participant writes.
- `event:<id>:p:<pid>:wishlist` — ciphertext; plaintext `wishlistUpdatedAt` in KV metadata.
- `event:<id>:p:<pid>:assignment` — ciphertext (receiver id); plaintext `openedAt` in KV metadata.
- Tokens are sent as `Authorization: Bearer <token>`; the server compares SHA-256 hashes with a constant-time compare.
- Limits: 16 KB per blob, 100 participants. TTL 13 months, refreshed on every organizer write. Organizer can delete the whole event.

### API

- `PUT /api/events/:id` creates or updates meta + details + roster (organizer token).
- `GET /api/events/:id` returns details, roster, and per-participant status (`wishlistUpdatedAt`, `openedAt`); no auth, the id is the capability.
- `PUT /api/events/:id/participants/:pid/wishlist` (participant token).
- `GET /api/events/:id/participants/:pid/wishlist` no auth.
- `PUT /api/events/:id/assignments` writes all assignments at once (organizer token).
- `GET /api/events/:id/participants/:pid/assignment` no auth.
- `POST /api/events/:id/participants/:pid/opened` (participant token).
- `DELETE /api/events/:id` (organizer token).
- JSON bodies; ciphertext as base64url strings carrying their IV.

### Client

- React + react-router as today. Organizer home lists events from localStorage `{ id, key, organizerToken, title, createdAt }`. Legacy localStorage data migrates into one event on first load.
- Participant page order: identity confirmation → details → wishlist editor → (if an assignment exists) envelope reveal → receiver name, receiver wishlist, organizer's note.
- Organizer page sections: participants (existing list + rules), details, links + share actions, status table, draw (pairings hidden behind a reveal toggle).
- Mutual exclusion is a UI toggle that writes two Must Not rules. No new rule type. Text syntax unchanged.
- Avoid previous draw adds plain Must Not rules by name match. Source is a local event or a pasted organizer link.
- Share actions: Copy link, Copy as message, Web Share when `navigator.share` exists. No email or phone fields.
- The old `hint` field is renamed Organizer's note everywhere a user sees it; the stored field name may stay.
- i18n: every new string in `en` and `fr`; `fr` drafts marked for review in the ticket for #13.

### Draw generator

- Backtracking search over candidate receivers, most-constrained giver first. `crypto.getRandomValues` for every random choice. Infeasible rules return `null` as today.
- Minimal re-draw (ticket 15): the generator accepts an ordered list of assignments to keep, most protected first. It drops any that no longer fit the roster or rules, fixes the rest, and matches the remaining givers. If no draw exists with everything kept, it releases kept assignments from the least protected end, one at a time, until one does. Greedy, not provably minimal; the acceptance cases pin the behaviour that matters. The organizer passes opened givers first, then the others, each tier shuffled.
- Re-draw keeps by default. "Shuffle everyone" is the secondary action and ignores the previous draw.

## Testing Decisions

Seams, agreed in advance. Tests live at these and nowhere else.

- **Draw generator** (`generatePairs`): property tests with fast-check. Every giver gives once, every receiver receives once, nobody draws themselves, every rule honoured, every feasible constraint set solves. With a keep list: valid kept assignments survive, a fully valid previous draw is returned unchanged, one removal or one addition on a rule-free roster changes exactly one existing giver, protection order is respected when something must be released.
- **Re-draw planning** (pure helpers in the draw utilities): the keep order puts opened givers first; the changed-giver set is computed from previous and next receivers.
- **Participant text format** (`parseParticipantsText` / `formatParticipantText`): round-trip property tests, extended for Organizer's note wording.
- **Crypto module**: encrypt/decrypt round trip, wrong key fails, assignment key derived from a different token fails to decrypt. Runs in Node with `globalThis.crypto`.
- **Link codec**: build and parse organizer and participant links, fragment carries key and token, legacy links still parse.
- **Worker fetch handler**: call `worker.fetch(request, env)` directly with an in-memory KV stub. Covers auth (right token, wrong token, missing), limits, TTL metadata, status listing, delete.
- **Legacy migration**: pure mapping function from old localStorage shapes to an event, unit tested.
- **Avoid previous draw**: pure function from (previous roster + assignments, current roster) to added rules and unmatched names.
- No browser end-to-end tests. React components are not unit tested; the human ticket covers the real walk-through.

Run `npm test` (vitest) and `npm run typecheck` before every commit.
