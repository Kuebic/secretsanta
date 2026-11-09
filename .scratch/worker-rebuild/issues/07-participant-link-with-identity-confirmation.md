# 07: Participant link with identity confirmation

**What to build:** Each participant has a stable link (`/p/<eventId>/<participantId>#<eventKey>.<participantToken>`). Opening it asks "Are you <Name>?". Yes shows the event details and, before a draw exists, a "no draw yet" message. No explains they got the wrong link and should ask the organizer; nothing else is revealed.

See ADR 0003.

**Blocked by:** 04

**Status:** resolved

**GitHub:** Kuebic/secretsanta#7

- [x] Organizer view lists each participant's link (copy button) as soon as the event has a roster, before any draw
- [x] Participant page decrypts roster + details with the fragment key; fragment never reaches the server (verified in Worker logs/tests)
- [x] Identity confirmation step: Yes / "No, wrong link"
- [x] Yes → details + "no draw yet" state; No → guidance, no names shown
- [x] Invalid or deleted event shows a friendly error
- [x] Link ~130 chars or fewer
