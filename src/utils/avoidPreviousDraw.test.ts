import { describe, it, expect } from 'vitest';

import { avoidPreviousDraw, PreviousDraw } from './avoidPreviousDraw';
import { Participants } from '../types';

// Previous and current events mint their own participant IDs, so the same
// person has a different ID in each; only the name links them.
function current(...names: string[]): Participants {
  return Object.fromEntries(names.map(name => [`now-${name}`, { id: `now-${name}`, name, rules: [] }]));
}

function previous(assignments: Array<[giver: string, receiver: string]>, extraNames: string[] = []): PreviousDraw {
  const names = [...new Set([...assignments.flat(), ...extraNames])];
  return {
    roster: Object.fromEntries(names.map(name => [`then-${name}`, { name }])),
    assignments: Object.fromEntries(assignments.map(([giver, receiver]) => [`then-${giver}`, `then-${receiver}`])),
  };
}

describe('avoidPreviousDraw', () => {
  it('gives each giver a Must Not rule toward their previous receiver', () => {
    const result = avoidPreviousDraw(
      previous([['Alice', 'Bob'], ['Bob', 'Carol'], ['Carol', 'Alice']]),
      current('Alice', 'Bob', 'Carol'),
    );

    expect(result.participants['now-Alice'].rules).toEqual([{ type: 'mustNot', targetParticipantId: 'now-Bob' }]);
    expect(result.participants['now-Bob'].rules).toEqual([{ type: 'mustNot', targetParticipantId: 'now-Carol' }]);
    expect(result.participants['now-Carol'].rules).toEqual([{ type: 'mustNot', targetParticipantId: 'now-Alice' }]);
    expect(result.added).toHaveLength(3);
    expect(result.unmatched).toEqual([]);
  });

  it('keeps existing rules and does not add a Must Not rule twice', () => {
    const participants = current('Alice', 'Bob', 'Carol');
    participants['now-Alice'].rules = [{ type: 'mustNot', targetParticipantId: 'now-Bob' }];
    participants['now-Bob'].rules = [{ type: 'mustNot', targetParticipantId: 'now-Alice' }];

    const result = avoidPreviousDraw(previous([['Alice', 'Bob'], ['Bob', 'Carol'], ['Carol', 'Alice']]), participants);

    expect(result.participants['now-Alice'].rules).toEqual([{ type: 'mustNot', targetParticipantId: 'now-Bob' }]);
    expect(result.participants['now-Bob'].rules).toEqual([
      { type: 'mustNot', targetParticipantId: 'now-Alice' },
      { type: 'mustNot', targetParticipantId: 'now-Carol' },
    ]);
    expect(result.added).toEqual([
      { giverId: 'now-Bob', receiverId: 'now-Carol' },
      { giverId: 'now-Carol', receiverId: 'now-Alice' },
    ]);
  });

  it('adds nothing new when imported twice', () => {
    const draw = previous([['Alice', 'Bob'], ['Bob', 'Alice']]);
    const once = avoidPreviousDraw(draw, current('Alice', 'Bob')).participants;

    const twice = avoidPreviousDraw(draw, once);

    expect(twice.participants).toEqual(once);
    expect(twice.added).toEqual([]);
  });

  it('lists previous names missing from the current event and still imports the rest', () => {
    // Dave took part before but not now; Eve is new this time.
    const result = avoidPreviousDraw(
      previous([['Alice', 'Dave'], ['Dave', 'Bob'], ['Bob', 'Alice']]),
      current('Alice', 'Bob', 'Eve'),
    );

    expect(result.unmatched).toEqual(['Dave']);
    expect(result.added).toEqual([{ giverId: 'now-Bob', receiverId: 'now-Alice' }]);
    expect(result.participants['now-Alice'].rules).toEqual([]);
    expect(result.participants['now-Eve'].rules).toEqual([]);
  });

  it('matches names regardless of case and surrounding spaces', () => {
    const result = avoidPreviousDraw(previous([[' alice', 'BOB '], ['BOB ', ' alice']]), current('Alice', 'Bob'));

    expect(result.added).toEqual([
      { giverId: 'now-Alice', receiverId: 'now-Bob' },
      { giverId: 'now-Bob', receiverId: 'now-Alice' },
    ]);
    expect(result.unmatched).toEqual([]);
  });

  it('treats a name two current participants share as unmatched', () => {
    const participants = current('Alice', 'Bob');
    participants['now-other-Alice'] = { id: 'now-other-Alice', name: 'alice', rules: [] };

    const result = avoidPreviousDraw(previous([['Alice', 'Bob'], ['Bob', 'Alice']]), participants);

    expect(result.added).toEqual([]);
    expect(result.unmatched).toEqual(['Alice']);
  });

  it('leaves a giver with a Must rule alone, since their receiver is already fixed', () => {
    const participants = current('Alice', 'Bob', 'Carol');
    participants['now-Alice'].rules = [{ type: 'must', targetParticipantId: 'now-Bob' }];

    const result = avoidPreviousDraw(previous([['Alice', 'Bob'], ['Bob', 'Carol'], ['Carol', 'Alice']]), participants);

    expect(result.participants['now-Alice'].rules).toEqual([{ type: 'must', targetParticipantId: 'now-Bob' }]);
    expect(result.added).toEqual([
      { giverId: 'now-Bob', receiverId: 'now-Carol' },
      { giverId: 'now-Carol', receiverId: 'now-Alice' },
    ]);
  });
});
