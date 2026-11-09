---
status: accepted
---
# The server never sees plaintext

Every piece of event content (details, roster, wishlists, assignments) is encrypted in the browser with AES-GCM before it reaches the Worker. The event key lives only in the URL fragment, which browsers never send to servers. Writes are authorized by random tokens; the server stores only their SHA-256 hashes. The server keeps plaintext for existence and timing only: whether a wishlist exists, when it changed, when an assignment was opened.

This keeps the project's "no accounts, nothing to leak" promise true even with a backend, at the cost of no server-side search, no email delivery, and unrecoverable data if a link is lost.

## Consequences

- Event IDs and participant IDs are random 128-bit capability handles; knowing one lets you read ciphertext, not content.
- Losing the organizer link loses organizer control. The home page keeps a local list of the organizer's events to soften this.
