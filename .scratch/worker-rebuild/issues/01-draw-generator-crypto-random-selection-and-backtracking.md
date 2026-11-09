# 01: Draw generator: crypto-random selection and backtracking

**What to build:** The draw finds a valid set of assignments whenever the rules allow one, instead of giving up after a fixed number of greedy retries. Receiver selection uses cryptographically secure randomness. Behaviour for organizers is unchanged except that rule sets which used to fail intermittently now succeed reliably.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

**GitHub:** Kuebic/secretsanta#1

- [ ] Any feasible combination of Must / Must Not rules produces a draw (backtracking, no retry cap that can fail on a solvable input)
- [ ] Infeasible rule sets still report failure with the existing error
- [ ] Random choice uses `crypto.getRandomValues`, not `Math.random`
- [ ] Property-based tests cover: every participant gives once and receives once, nobody receives from themselves, all rules honoured, feasible-but-tight constraints (e.g. chain of Must Not rules) always solve
- [ ] Existing generator tests still pass
