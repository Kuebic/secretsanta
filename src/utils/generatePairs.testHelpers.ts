import { expect } from 'vitest';
import { GeneratedPairs } from './generatePairs';
import { Participant } from '../types';

export type Roster = Record<string, Participant>;

export function expectValidDraw(participants: Roster, draw: GeneratedPairs) {
  const ids = Object.keys(participants);
  expect(draw.pairings).toHaveLength(ids.length);
  expect(new Set(draw.pairings.map(a => a.giver.id))).toEqual(new Set(ids));
  expect(new Set(draw.pairings.map(a => a.receiver.id))).toEqual(new Set(ids));
  for (const { giver, receiver } of draw.pairings) {
    const rules = participants[giver.id].rules;
    const must = rules.find(r => r.type === 'must');
    if (must) {
      expect(receiver.id).toBe(must.targetParticipantId);
    } else {
      expect(receiver.id).not.toBe(giver.id);
    }
    for (const rule of rules.filter(r => r.type === 'mustNot')) {
      expect(receiver.id).not.toBe(rule.targetParticipantId);
    }
  }
}
