import { describe, it, expect, vi, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { generatePairs } from './generatePairs';
import { expectValidDraw, Roster } from './generatePairs.testHelpers';

// Independent feasibility oracle: try every permutation.
function isFeasible(participants: Roster): boolean {
  const ids = Object.keys(participants);
  const allowed = (g: string, r: string) => {
    const rules = participants[g].rules;
    const must = rules.find(x => x.type === 'must');
    if (must) return must.targetParticipantId === r;
    return g !== r && !rules.some(x => x.type === 'mustNot' && x.targetParticipantId === r);
  };
  const used = new Set<string>();
  const search = (i: number): boolean => {
    if (i === ids.length) return true;
    for (const r of ids) {
      if (used.has(r) || !allowed(ids[i], r)) continue;
      used.add(r);
      if (search(i + 1)) return true;
      used.delete(r);
    }
    return false;
  };
  return search(0);
}

// A roster with a hidden valid draw: each giver is allowed their planted
// receiver plus a few decoys; every other participant is a Must Not.
const plantedRosterArb = fc
  .integer({ min: 2, max: 30 })
  .chain(n =>
    fc.tuple(
      fc.constant(n),
      fc.shuffledSubarray([...Array(n).keys()], { minLength: n, maxLength: n }),
      fc.array(fc.array(fc.nat({ max: n - 1 }), { maxLength: 2 }), { minLength: n, maxLength: n }),
      fc.array(fc.boolean(), { minLength: n, maxLength: n }),
    ),
  )
  .filter(([, order]) => order.length >= 2)
  .map(([n, order, decoys, useMust]) => {
    // A single cycle through `order` is a derangement with no self-draws.
    const planted = new Map<number, number>();
    order.forEach((g, i) => planted.set(g, order[(i + 1) % order.length]));
    const participants: Roster = {};
    for (let g = 0; g < n; g++) {
      const id = `p${g}`;
      const receiver = planted.get(g)!;
      if (useMust[g]) {
        participants[id] = { id, name: `Participant ${g}`, rules: [{ type: 'must', targetParticipantId: `p${receiver}` }] };
        continue;
      }
      const allowed = new Set([receiver, ...decoys[g]]);
      const rules = [...Array(n).keys()]
        .filter(r => r !== g && !allowed.has(r))
        .map(r => ({ type: 'mustNot' as const, targetParticipantId: `p${r}` }));
      participants[id] = { id, name: `Participant ${g}`, rules };
    }
    return participants;
  });

const smallRosterArb = fc
  .integer({ min: 2, max: 6 })
  .chain(n =>
    fc.tuple(
      fc.constant(n),
      fc.array(fc.array(fc.nat({ max: n - 1 }), { maxLength: n }), { minLength: n, maxLength: n }),
      fc.array(fc.option(fc.nat({ max: n - 1 }), { freq: 4 }), { minLength: n, maxLength: n }),
    ),
  )
  .map(([n, mustNots, musts]) => {
    const participants: Roster = {};
    for (let g = 0; g < n; g++) {
      const id = `p${g}`;
      const must = musts[g];
      const rules =
        must !== null && must !== g
          ? [{ type: 'must' as const, targetParticipantId: `p${must}` }]
          : [...new Set(mustNots[g])].map(r => ({ type: 'mustNot' as const, targetParticipantId: `p${r}` }));
      participants[id] = { id, name: `Participant ${g}`, rules };
    }
    return participants;
  });

describe('generatePairs draw', () => {
  afterEach(() => vi.restoreAllMocks());

  it('always solves a feasible-but-tight roster', () => {
    fc.assert(
      fc.property(plantedRosterArb, participants => {
        const draw = generatePairs(participants);
        expect(draw).not.toBeNull();
        expectValidDraw(participants, draw!);
      }),
      { numRuns: 300 },
    );
  });

  it('always solves a chain of Must Not rules where only one draw is valid', () => {
    // Everyone may only give to the next person in the chain.
    for (let n = 2; n <= 40; n++) {
      const participants: Roster = {};
      for (let g = 0; g < n; g++) {
        const next = (g + 1) % n;
        participants[`p${g}`] = {
          id: `p${g}`,
          name: `Participant ${g}`,
          rules: [...Array(n).keys()]
            .filter(r => r !== g && r !== next)
            .map(r => ({ type: 'mustNot' as const, targetParticipantId: `p${r}` })),
        };
      }
      const draw = generatePairs(participants);
      expect(draw).not.toBeNull();
      expectValidDraw(participants, draw!);
    }
  });

  it('solves rosters where most greedy receiver choices lead to a dead end', () => {
    // Groups of three (a, b, c), each giving into the next group (a', b', c'):
    // a and b may only give to a' or b', c may give to b' or c'. Choosing b'
    // for c strands a and b, so every group is a coin-flip trap for a greedy
    // pass. Listing every c first makes it pick them while still tied.
    const groups = 10;
    const ids = (k: number) => ({ a: `a${k}`, b: `b${k}`, c: `c${k}` });
    const allowed: Record<string, string[]> = {};
    for (let k = 0; k < groups; k++) {
      const here = ids(k);
      const next = ids((k + 1) % groups);
      allowed[here.a] = [next.a, next.b];
      allowed[here.b] = [next.a, next.b];
      allowed[here.c] = [next.b, next.c];
    }
    const order = [
      ...[...Array(groups).keys()].map(k => ids(k).c),
      ...[...Array(groups).keys()].flatMap(k => [ids(k).a, ids(k).b]),
    ];
    const participants: Roster = {};
    for (const id of order) {
      participants[id] = {
        id,
        name: id,
        rules: order
          .filter(r => r !== id && !allowed[id].includes(r))
          .map(r => ({ type: 'mustNot' as const, targetParticipantId: r })),
      };
    }
    for (let t = 0; t < 20; t++) {
      const draw = generatePairs(participants);
      expect(draw).not.toBeNull();
      expectValidDraw(participants, draw!);
    }
  });

  it('produces a draw exactly when the rules allow one', () => {
    fc.assert(
      fc.property(smallRosterArb, participants => {
        const draw = generatePairs(participants);
        if (isFeasible(participants)) {
          expect(draw).not.toBeNull();
          expectValidDraw(participants, draw!);
        } else {
          expect(draw).toBeNull();
        }
      }),
      { numRuns: 500 },
    );
  });

  it('chooses receivers with crypto.getRandomValues, never Math.random', () => {
    const mathRandom = vi.spyOn(Math, 'random');
    const getRandomValues = vi.spyOn(globalThis.crypto, 'getRandomValues');
    const participants: Roster = {};
    for (let g = 0; g < 8; g++) {
      participants[`p${g}`] = { id: `p${g}`, name: `Participant ${g}`, rules: [] };
    }
    const draw = generatePairs(participants);
    expect(draw).not.toBeNull();
    expect(getRandomValues).toHaveBeenCalled();
    expect(mathRandom).not.toHaveBeenCalled();
  });
});
