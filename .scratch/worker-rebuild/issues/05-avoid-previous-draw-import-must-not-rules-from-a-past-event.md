# 05: Avoid previous draw: import Must Not rules from a past event

**What to build:** An organizer can tell the draw to avoid last year's assignments. They pick a past event from this browser's event list, or paste an old organizer link. Each giver gets a Must Not rule toward their previous receiver, matched by name. Names that don't match are listed so the organizer can fix them, without blocking the import.

**Blocked by:** 04

**Status:** ready-for-agent

**GitHub:** Kuebic/secretsanta#5

- [ ] "Avoid a previous draw" action in the rules area
- [ ] Source: select from local events, or paste an organizer link (decrypts roster + assignments with that event's key)
- [ ] Adds plain Must Not rules; existing rules preserved; duplicates not added twice
- [ ] Unmatched names shown in a non-blocking list
- [ ] Works when the previous event has participants the current one lacks and vice versa
