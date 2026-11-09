# 08: Assignments on the server, envelope reveal, opened tracking

**What to build:** When the organizer draws, each assignment is encrypted so only that giver can read it and stored on the server. A participant who confirms identity sees an envelope animation and their receiver's name. The server records when they opened it. The organizer sees how many have opened, gets a warning before re-drawing once anyone has, and sees the full pairings only behind a "Reveal pairings" toggle (CSV export lives behind it too).

Key derivation per ADR 0003: assignment key = HKDF(eventKey, participantToken).

**Blocked by:** 07

**Status:** resolved

**GitHub:** Kuebic/secretsanta#8

- [x] Draw writes one encrypted assignment per giver under the organizer token; participant with their link decrypts theirs; another participant's link cannot
- [x] Participant page after Yes: envelope opens, receiver name shown; `openedAt` set via participant token
- [x] If the assignment changed since last opened, a "this changed" banner shows
- [x] Organizer: opened count visible; re-draw shows a warning naming how many have opened
- [x] Pairings table hidden by default; "Reveal pairings" toggle shows table + CSV export
- [x] Adding a participant after a draw mints their link immediately and flags the draw as stale (existing warning)
- [x] Tests: wrong token cannot decrypt, server stores only ciphertext and timestamps

## Comments

Review (2026-11-09): besides `openedAt`, the Worker keeps a plaintext `assignedAt` in the assignment's KV metadata (moved only when the giver's ciphertext changes) so the "this changed" banner can be computed; both are timing only (ADR 0002). A giver counts as opened, in the opened count, the re-draw warning and the status table, only when nothing was re-drawn for them since they opened.
