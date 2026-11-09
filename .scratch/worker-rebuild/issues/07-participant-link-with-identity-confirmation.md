# 07: Participant link with identity confirmation

**What to build:** Each participant has a stable link (`/p/<eventId>/<participantId>#<eventKey>.<participantToken>`). Opening it asks "Are you <Name>?". Yes shows the event details and, before a draw exists, a "no draw yet" message. No explains they got the wrong link and should ask the organizer; nothing else is revealed.

See ADR 0003.

**Blocked by:** 04

**Status:** ready-for-agent

**GitHub:** Kuebic/secretsanta#7

- [ ] Organizer view lists each participant's link (copy button) as soon as the event has a roster, before any draw
- [ ] Participant page decrypts roster + details with the fragment key; fragment never reaches the server (verified in Worker logs/tests)
- [ ] Identity confirmation step: Yes / "No, wrong link"
- [ ] Yes → details + "no draw yet" state; No → guidance, no names shown
- [ ] Invalid or deleted event shows a friendly error
- [ ] Link ~130 chars or fewer
