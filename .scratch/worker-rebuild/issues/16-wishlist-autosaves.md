# 16: Wishlist autosaves

**What to build:** A participant's wishlist saves itself as they edit it; the Save button goes away. Saves fire 2 s after the last keystroke, and right away when a field loses focus, when an item is added, removed or moved, and when the page is hidden. Saves never overlap. Only the sealed copy is cleaned (trimmed, blank items dropped), so the editor keeps the blank row a participant just added. A wishlist that is empty after cleaning is never written when nothing is stored, and is deleted when something was, so the participant is no longer "filled in" and can be nudged again.

**Blocked by:** None (can start immediately)

**Status:** resolved

**GitHub:** Kuebic/secretsanta#16

- [x] Autosave: 2 s idle, plus immediate flush on blur, add/remove/move and `visibilitychange` to hidden; one save in flight at a time, newer edits supersede older ones
- [x] Sealed copy is cleaned; the editor state is not
- [x] Empty after cleaning: no write when nothing is stored; `DELETE` of the stored wishlist when something was
- [x] Worker: `DELETE /api/events/:id/participants/:pid/wishlist` with the participant token; status listing drops `wishlistUpdatedAt` for that participant
- [x] Status line: "Saving…", "Saved", error with a Retry button; `beforeunload` warning while a save is pending or failed
- [x] Save button and "Unsaved changes" removed; i18n keys updated in en and fr
- [x] Worker fetch handler tests: delete with right, wrong and missing token; status after delete

## Comments

Review (2026-11-20): a failed save is retried on blur and on hide as well as by the Retry button; a save already queued for the same revision is not queued again, so a blur right after the timer fires costs no extra KV write. Participant authorization in the Worker is one helper shared by opened, wishlist save and wishlist delete. A shared autosave hook with the organizer page was considered and left for later.
