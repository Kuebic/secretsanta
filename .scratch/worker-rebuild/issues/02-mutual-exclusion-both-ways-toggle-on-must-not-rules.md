# 02: Mutual exclusion: both-ways toggle on Must Not rules

**What to build:** When an organizer adds a Must Not rule, a "both ways" switch (default on) makes it a mutual exclusion: the other participant also gets a Must Not rule back. Typical use is couples or housemates. Text view shows the resulting rules on both lines and round-trips unchanged.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

**GitHub:** Kuebic/secretsanta#2

- [ ] Rules modal: Must Not row has a both-ways toggle, on by default
- [ ] Saving with toggle on writes a Must Not on both participants; toggle off writes one direction only
- [ ] Removing one side of a mutual exclusion offers to remove the other side too
- [ ] Participant rows indicate rule counts including rules added from the other side
- [ ] Text view `!Name` syntax unchanged; both lines show their rule
- [ ] Glossary term "Mutual exclusion" used in UI copy and i18n keys
