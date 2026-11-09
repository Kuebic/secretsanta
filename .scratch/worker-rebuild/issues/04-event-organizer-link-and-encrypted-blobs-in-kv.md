# 04: Event: organizer link and encrypted blobs in KV

**What to build:** An organizer creates an Event. The browser mints the event ID, event key, organizer token and one participant token per participant. Details (title + notes) and the roster (participant IDs → names) are encrypted with the event key and stored on the Worker. The organizer link (`/o/<eventId>#<eventKey>.<organizerToken>`) reopens the event on any device. The home page lists events known to this browser.

Server never sees plaintext (ADR 0002). Current "Additional instructions" become the event's notes.

**Blocked by:** 03

**Status:** resolved

**GitHub:** Kuebic/secretsanta#4

- [x] New event mints 128-bit event ID, 256-bit AES-GCM key, 128-bit organizer token, 128-bit participant tokens; all base64url
- [x] API: PUT/GET event details blob, PUT/GET roster blob; writes require organizer token, server stores SHA-256 of tokens only
- [x] Blobs are ciphertext; server rejects bodies over 16 KB and rosters over 100 participants
- [x] KV entries carry a 13-month TTL refreshed on every organizer write
- [x] Organizer can delete the event (all keys removed)
- [x] Organizer link opens the event on a fresh browser with roster and details decrypted
- [x] Home page lists local events (title, date created), "Copy organizer link" per event, "New event"
- [x] Participant names never appear in any request body or URL in plaintext
- [x] Worker route logic covered by Vitest
