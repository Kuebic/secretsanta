# 11: Wishlist editor and giver view

**What to build:** On their page a participant keeps a wishlist: a list of items (text + optional link) and free-text notes (sizes, dislikes, allergies). Editable any time, before or after the draw. After the reveal the giver sees their receiver's current wishlist plus the organizer's note about them. The old organizer-entered "hint" is renamed "Organizer's note".

**Blocked by:** 08

**Status:** ready-for-agent

**GitHub:** Kuebic/secretsanta#11

- [ ] Wishlist editor: add/edit/remove/reorder items, optional URL per item, notes textarea; saves encrypted with the event key using the participant token
- [ ] Server records `wishlistUpdatedAt` (plaintext timestamp) alongside the ciphertext
- [ ] Giver sees receiver's wishlist and organizer's note under the revealed name; empty state when receiver has nothing yet
- [ ] Item links open in a new tab, rendered as plain links (no previews)
- [ ] Rules modal and text view label the field "Organizer's note"; i18n keys renamed, existing data preserved
- [ ] 16 KB limit enforced with a visible character budget
