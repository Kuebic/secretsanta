# 15: Minimal re-draw: keep every assignment that still fits

**What to build:** When the organizer re-draws after adding or removing a participant, or changing a rule, every assignment that still fits the roster and the rules is kept. Only the assignments that have to change do. A giver whose receiver is unchanged keeps their opened state and sees no "this changed" banner. Re-draw becomes this keeping draw by default; "Shuffle everyone" stays available as a secondary action.

When something has to give, givers who have not opened their envelope are changed before givers who have. Among givers who have not opened, the one who changes is chosen at random.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

**GitHub:** Kuebic/secretsanta#15

- [ ] Re-draw keeps every previous assignment that is still valid: giver and receiver both in the roster, not a self-draw, no Must or Must Not broken
- [ ] Roster without rules, one participant removed: exactly one giver changes (the removed person's giver now gives to the removed person's receiver), or two when those two gave to each other
- [ ] Roster without rules, one participant added: exactly one existing giver changes, and they now give to the newcomer
- [ ] Previous draw still fully valid: re-draw changes nothing
- [ ] When kept assignments make the rest impossible, assignments are released unopened-first, opened-last, until a draw exists; infeasible rules still return the existing error
- [ ] The re-draw confirmation names only opened givers whose receiver will actually change, and is skipped when there are none
- [ ] "Shuffle everyone" re-draws from scratch with the existing confirmation
- [ ] Unchanged givers get the same ciphertext back, so the Worker keeps their `assignedAt` and `openedAt`
- [ ] Stale-draw notice and help copy say that re-drawing keeps assignments where possible; en and fr
- [ ] Property tests cover the keep behaviour at the generator seam; the plan-the-re-draw helper has unit tests
