# 15: Minimal re-draw: keep every assignment that still fits

**What to build:** When the organizer re-draws after adding or removing a participant, or changing a rule, every assignment that still fits the roster and the rules is kept. Only the assignments that have to change do. A giver whose receiver is unchanged keeps their opened state and sees no "this changed" banner. Re-draw becomes this keeping draw by default; "Re-draw everyone" stays available as a secondary action.

When something has to give, givers who have not opened their envelope are changed before givers who have. Among givers who have not opened, the one who changes is chosen at random.

**Blocked by:** None (can start immediately)

**Status:** resolved

**GitHub:** Kuebic/secretsanta#15

- [x] Re-draw keeps every previous assignment that is still valid: giver and receiver both in the roster, not a self-draw, no Must or Must Not broken
- [x] Roster without rules, one participant removed: exactly one giver changes (the removed person's giver now gives to the removed person's receiver), or two when those two gave to each other
- [x] Roster without rules, one participant added: exactly one existing giver changes, and they now give to the newcomer
- [x] Previous draw still fully valid: re-draw changes nothing
- [x] When kept assignments make the rest impossible, assignments are released unopened-first, opened-last, until a draw exists; infeasible rules still return the existing error
- [x] The re-draw confirmation names only opened givers whose receiver will actually change, and is skipped when there are none
- [x] "Re-draw everyone" re-draws from scratch, with the same confirmation counting the opened givers who will change
- [x] Unchanged givers get the same ciphertext back, so the Worker keeps their `assignedAt` and `openedAt`
- [x] Stale-draw notice and help copy say that re-drawing keeps assignments where possible; en and fr
- [x] Property tests cover the keep behaviour at the generator seam; the plan-the-re-draw helper has unit tests

## Comments

Review (2026-11-09): "Shuffle" is a glossary-avoided word, so the secondary action is "Re-draw everyone". Its confirmation counts the opened givers whose receiver actually changes rather than every opened giver, since an unchanged giver keeps their ciphertext and sees no banner. Releases consider only kept givers holding a receiver the stuck giver can reach, a refinement of the spec's "least protected end".
