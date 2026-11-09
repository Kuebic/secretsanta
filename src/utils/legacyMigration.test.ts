import { describe, expect, it } from 'vitest';
import { mapLegacyData } from './legacyMigration';

// Deterministic stand-in for mintParticipantId.
function counter() {
  let n = 0;
  return () => `new-${++n}`;
}

const byName = (participants: Record<string, { id: string; name: string }>, name: string) =>
  Object.values(participants).find(p => p.name === name)!.id;

describe('legacy migration mapping', () => {
  it('carries participants over with fresh IDs, rules re-pointed and hints as organizer\'s notes', () => {
    const event = mapLegacyData({
      participants: {
        'uuid-a': { id: 'uuid-a', name: 'Alice', hint: 'Likes tea', rules: [{ type: 'mustNot', targetParticipantId: 'uuid-b' }] },
        'uuid-b': { id: 'uuid-b', name: 'Bob', rules: [{ type: 'must', targetParticipantId: 'uuid-c' }] },
        'uuid-c': { id: 'uuid-c', name: 'Carol', hint: '', rules: [] },
      },
      assignments: null,
      instructions: null,
    }, counter())!;

    const a = byName(event.participants, 'Alice');
    const b = byName(event.participants, 'Bob');
    const c = byName(event.participants, 'Carol');
    expect(new Set([a, b, c])).toEqual(new Set(['new-1', 'new-2', 'new-3']));
    expect(event.participants[a]).toEqual({ id: a, name: 'Alice', hint: 'Likes tea', rules: [{ type: 'mustNot', targetParticipantId: b }] });
    expect(event.participants[b]).toEqual({ id: b, name: 'Bob', rules: [{ type: 'must', targetParticipantId: c }] });
    expect(event.participants[c]).toEqual({ id: c, name: 'Carol', rules: [] });
  });
});

const threePeople = {
  'uuid-a': { id: 'uuid-a', name: 'Alice', rules: [] },
  'uuid-b': { id: 'uuid-b', name: 'Bob', rules: [] },
  'uuid-c': { id: 'uuid-c', name: 'Carol', rules: [] },
};

describe('legacy migration: details', () => {
  it('turns the additional instructions into the details notes, untitled', () => {
    const event = mapLegacyData({ participants: threePeople, assignments: null, instructions: '  Budget 20€, bring it Friday ' }, counter())!;
    expect(event.details).toEqual({ title: '', budget: '', date: '', location: '', notes: 'Budget 20€, bring it Friday' });
  });

  it('has empty notes when there were no instructions', () => {
    const event = mapLegacyData({ participants: threePeople, assignments: null, instructions: null }, counter())!;
    expect(event.details).toEqual({ title: '', budget: '', date: '', location: '', notes: '' });
  });
});

describe('legacy migration: last draw', () => {
  it('keeps the last draw as assignments between the new IDs', () => {
    const pair = (giver: string, receiver: string) => ({
      giver: { id: `uuid-${giver[0].toLowerCase()}`, name: giver },
      receiver: { id: `uuid-${receiver[0].toLowerCase()}`, name: receiver },
    });
    const event = mapLegacyData({
      participants: threePeople,
      assignments: { hash: 'whatever', pairings: [pair('Alice', 'Bob'), pair('Bob', 'Carol'), pair('Carol', 'Alice')] },
      instructions: '',
    }, counter())!;
    const [a, b, c] = ['Alice', 'Bob', 'Carol'].map(name => byName(event.participants, name));
    expect(event.assignments).toEqual({ [a]: b, [b]: c, [c]: a });
  });

  it('drops assignments naming someone no longer in the list', () => {
    const event = mapLegacyData({
      participants: { 'uuid-a': threePeople['uuid-a'], 'uuid-b': threePeople['uuid-b'] },
      assignments: {
        hash: '',
        pairings: [
          { giver: { id: 'uuid-a', name: 'Alice' }, receiver: { id: 'uuid-b', name: 'Bob' } },
          { giver: { id: 'uuid-b', name: 'Bob' }, receiver: { id: 'uuid-c', name: 'Carol' } },
          { giver: { id: 'uuid-c', name: 'Carol' }, receiver: { id: 'uuid-a', name: 'Alice' } },
        ],
      },
      instructions: '',
    }, counter())!;
    const [a, b] = ['Alice', 'Bob'].map(name => byName(event.participants, name));
    expect(event.assignments).toEqual({ [a]: b });
  });

  it('has no assignments when there was no draw', () => {
    const event = mapLegacyData({ participants: threePeople, assignments: null, instructions: '' }, counter())!;
    expect(event.assignments).toEqual({});
  });
});

describe('legacy migration: first release shapes', () => {
  it('reads an array of participants whose rules and draw name people', () => {
    const event = mapLegacyData({
      participants: [
        { name: 'Alice', rules: [{ type: 'mustNot', targetParticipant: 'Bob' }] },
        { name: 'Bob', rules: [{ type: 'must', targetParticipant: 'Nobody' }] },
      ],
      assignments: [['Alice', 'Bob'], ['Bob', 'Alice']],
      instructions: '',
    }, counter())!;
    const [a, b] = ['Alice', 'Bob'].map(name => byName(event.participants, name));
    expect(event.participants[a].rules).toEqual([{ type: 'mustNot', targetParticipantId: b }]);
    expect(event.participants[b].rules).toEqual([]);
    expect(event.assignments).toEqual({ [a]: b, [b]: a });
  });
});

describe('legacy migration: nothing to migrate', () => {
  it('returns null for missing, empty or junk data', () => {
    expect(mapLegacyData({ participants: null, assignments: null, instructions: null })).toBeNull();
    expect(mapLegacyData({ participants: {}, assignments: null, instructions: '  ' })).toBeNull();
    expect(mapLegacyData({ participants: 'oops', assignments: 42, instructions: {} })).toBeNull();
    expect(mapLegacyData({ participants: [], assignments: [], instructions: '' })).toBeNull();
  });

  it('migrates instructions alone', () => {
    const event = mapLegacyData({ participants: {}, assignments: null, instructions: 'See you Friday' })!;
    expect(event).toEqual({ details: { title: '', budget: '', date: '', location: '', notes: 'See you Friday' }, participants: {}, assignments: {} });
  });
});
