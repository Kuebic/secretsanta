# 06: Migrate legacy localStorage data into an event

**What to build:** Someone who used the old static version opens the new app and finds their participants, rules, hints, instructions and last draw already in place as a single event, with a one-time notice explaining the move.

**Blocked by:** 04

**Status:** ready-for-agent

**GitHub:** Kuebic/secretsanta#6

- [ ] On first load, if legacy keys exist and no events exist: create one event, encrypt and upload roster + details (instructions → notes), keep the last draw as the event's current assignments
- [ ] Hints carried over as organizer's notes
- [ ] Notice shown once; legacy keys removed after successful migration
- [ ] Migration failure (offline, API down) leaves legacy data untouched and retries next load
- [ ] Unit tests for the migration mapping
