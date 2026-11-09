---
status: accepted
---
# Participant links are stable; assignments live on the server

Upstream encoded the receiver's name inside each link, so every re-draw invalidated every link. We instead mint one link per participant at event creation and store each assignment on the server, encrypted with a key derived from the event key and that participant's token. Only that participant can decrypt their assignment; the server and other participants (who share the event key) cannot.

This lets organizers send links before the draw so people can fill in wishlists early, re-draw or add late joiners without resending anything, and let the server report who has opened their assignment.

## Considered Options

- Encrypt assignments with the event key alone. Rejected: anyone with any participant link could read every assignment.
- Keep assignments in links. Rejected: links change on every draw and cannot be sent before it.
