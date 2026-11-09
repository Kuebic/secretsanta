import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { generatePairs, GeneratedPairs, KeptAssignment } from './generatePairs';
import { Participant } from '../types';

type Roster = Record<string, Participant>;

function roster(n: number): Roster {
  const participants: Roster = {};
  for (let g = 0; g < n; g++) {
    participants[`p${g}`] = { id: `p${g}`, name: `Participant ${g}`, rules: [] };
  }
  return participants;
}

function receiversOf(draw: GeneratedPairs): Record<string, string> {
  return Object.fromEntries(draw.pairings.map(({ giver, receiver }) => [giver.id, receiver.id]));
}

function keepList(receivers: Record<string, string>): KeptAssignment[] {
  return Object.entries(receivers).map(([giverId, receiverId]) => ({ giverId, receiverId }));
}

function changedGivers(previous: Record<string, string>, next: Record<string, string>): string[] {
  return Object.keys(previous).filter(giverId => giverId in next && previous[giverId] !== next[giverId]);
}

function expectValidDraw(participants: Roster, draw: GeneratedPairs) {
  const ids = Object.keys(participants);
  expect(draw.pairings).toHaveLength(ids.length);
  expect(new Set(draw.pairings.map(a => a.giver.id))).toEqual(new Set(ids));
  expect(new Set(draw.pairings.map(a => a.receiver.id))).toEqual(new Set(ids));
  for (const { giver, receiver } of draw.pairings) {
    const rules = participants[giver.id].rules;
    const must = rules.find(r => r.type === 'must');
    if (must) expect(receiver.id).toBe(must.targetParticipantId);
    else expect(receiver.id).not.toBe(giver.id);
    for (const rule of rules.filter(r => r.type === 'mustNot')) expect(receiver.id).not.toBe(rule.targetParticipantId);
  }
}

const sizeArb = fc.integer({ min: 3, max: 25 });

describe('generatePairs with assignments to keep', () => {
  it('returns a still-valid previous draw unchanged', () => {
    fc.assert(
      fc.property(sizeArb, n => {
        const participants = roster(n);
        const previous = receiversOf(generatePairs(participants)!);
        const next = generatePairs(participants, { keep: keepList(previous) })!;
        expectValidDraw(participants, next);
        expect(receiversOf(next)).toEqual(previous);
      }),
    );
  });

  it('changes exactly one giver when a participant is removed from a rule-free roster', () => {
    fc.assert(
      fc.property(sizeArb, fc.nat(), (n, pick) => {
        const participants = roster(n);
        const previous = receiversOf(generatePairs(participants)!);
        const removed = `p${pick % n}`;
        const giverOfRemoved = Object.keys(previous).find(g => previous[g] === removed)!;
        const receiverOfRemoved = previous[removed];

        const smaller = { ...participants };
        delete smaller[removed];
        const next = generatePairs(smaller, { keep: keepList(previous) })!;

        expectValidDraw(smaller, next);
        const changed = changedGivers(previous, receiversOf(next));
        if (receiverOfRemoved === giverOfRemoved) {
          // The two gave to each other: the giver cannot draw themselves, so one more giver moves.
          expect(changed).toHaveLength(2);
          expect(changed).toContain(giverOfRemoved);
        } else {
          expect(changed).toEqual([giverOfRemoved]);
          expect(receiversOf(next)[giverOfRemoved]).toBe(receiverOfRemoved);
        }
      }),
    );
  });

  it('changes exactly one existing giver when a participant is added to a rule-free roster', () => {
    fc.assert(
      fc.property(sizeArb, n => {
        const participants = roster(n);
        const previous = receiversOf(generatePairs(participants)!);
        const larger = { ...participants, newcomer: { id: 'newcomer', name: 'Newcomer', rules: [] } };
        const next = generatePairs(larger, { keep: keepList(previous) })!;

        expectValidDraw(larger, next);
        const changed = changedGivers(previous, receiversOf(next));
        expect(changed).toHaveLength(1);
        expect(receiversOf(next)[changed[0]]).toBe('newcomer');
        expect(receiversOf(next).newcomer).toBe(previous[changed[0]]);
      }),
    );
  });

  it('keeps every kept assignment that still fits the rules and drops the ones that do not', () => {
    fc.assert(
      fc.property(sizeArb, fc.nat(), (n, pick) => {
        const participants = roster(n);
        const previous = receiversOf(generatePairs(participants)!);
        const giver = `p${pick % n}`;
        // A new Must Not against the giver's current receiver invalidates exactly that assignment.
        participants[giver] = { ...participants[giver], rules: [{ type: 'mustNot', targetParticipantId: previous[giver] }] };

        const next = generatePairs(participants, { keep: keepList(previous) })!;
        expectValidDraw(participants, next);
        const changed = changedGivers(previous, receiversOf(next));
        expect(changed).toContain(giver);
        // Only a short chain moves: the giver, whoever held the receiver they take, and at most
        // one more when that holder was the freed receiver and cannot draw themselves.
        expect(changed.length).toBeLessThanOrEqual(3);
      }),
    );
  });

  it('releases the least protected assignments first when something must give', () => {
    // Three people in a cycle a→b→c→a; add a newcomer. The last entry in the keep list is
    // the one that gives way, so the protected (earlier) givers keep their receivers.
    const participants = { ...roster(3), newcomer: { id: 'newcomer', name: 'Newcomer', rules: [] } };
    const previous = { p0: 'p1', p1: 'p2', p2: 'p0' };
    for (const sacrificed of ['p0', 'p1', 'p2']) {
      const keep = keepList(previous).sort((a, b) => (a.giverId === sacrificed ? 1 : b.giverId === sacrificed ? -1 : 0));
      const next = generatePairs(participants, { keep })!;
      expectValidDraw(participants, next);
      expect(changedGivers(previous, receiversOf(next))).toEqual([sacrificed]);
    }
  });

  it('ignores kept assignments whose giver or receiver left the roster', () => {
    const participants = roster(4);
    const keep: KeptAssignment[] = [
      { giverId: 'ghost', receiverId: 'p0' },
      { giverId: 'p1', receiverId: 'ghost' },
      { giverId: 'p2', receiverId: 'p3' },
    ];
    const next = generatePairs(participants, { keep })!;
    expectValidDraw(participants, next);
    expect(receiversOf(next).p2).toBe('p3');
  });

  it('still returns null when the rules allow no draw, whatever is kept', () => {
    const participants = roster(2);
    participants.p0.rules = [{ type: 'mustNot', targetParticipantId: 'p1' }];
    expect(generatePairs(participants, { keep: [{ giverId: 'p1', receiverId: 'p0' }] })).toBeNull();
  });
});
