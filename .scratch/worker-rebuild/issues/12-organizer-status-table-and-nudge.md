# 12: Organizer status table and nudge

**What to build:** The organizer sees a table of participants with whether each has filled in their wishlist (and when) and whether they have opened their assignment. A "not filled" filter narrows it. Each row has a Nudge action that copies or shares a reminder message with that person's link.

**Blocked by:** 11

**Status:** ready-for-agent

**GitHub:** Kuebic/secretsanta#12

- [ ] API: one call returns per-participant `wishlistUpdatedAt` and `openedAt` for an event (organizer token)
- [ ] Table columns: name, wishlist (✓ + relative time, or —), opened (✓ + relative time, or —)
- [ ] Filter: all / not filled
- [ ] Nudge: Copy message and Share (where supported) with a translated reminder + the participant's link
- [ ] Table refreshes on open and on a manual refresh button
