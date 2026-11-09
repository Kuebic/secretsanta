# 12: Organizer status table and nudge

**What to build:** The organizer sees a table of participants with whether each has filled in their wishlist (and when) and whether they have opened their assignment. A "not filled" filter narrows it. Each row has a Nudge action that copies or shares a reminder message with that person's link.

**Blocked by:** 11

**Status:** resolved

**GitHub:** Kuebic/secretsanta#12

- [x] API: one call returns per-participant `wishlistUpdatedAt` and `openedAt` for an event (organizer token)
- [x] Table columns: name, wishlist (✓ + relative time, or —), opened (✓ + relative time, or —)
- [x] Filter: all / not filled
- [x] Nudge: Copy message and Share (where supported) with a translated reminder + the participant's link
- [x] Table refreshes on open and on a manual refresh button

## Comments

Review (2026-11-09): the status comes from `GET /api/events/:id`, which the spec lists as unauthenticated and which already carries per-participant `wishlistUpdatedAt`, `assignedAt` and `openedAt` (plaintext timing only, ADR 0002); the organizer-token `/status` route was dropped as a duplicate. The Nudge message is worded as a nudge rather than a reminder (GLOSSARY).
