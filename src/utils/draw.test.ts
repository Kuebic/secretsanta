import { describe, it, expect } from 'vitest';
import { changedGivers, keepOrder, NO_DRAW } from './draw';

const draw: { receivers: Record<string, string>; sealed: Record<string, string> } = {
  receivers: { a: 'b', b: 'c', c: 'd', d: 'a' },
  sealed: { a: 'A', b: 'B', c: 'C', d: 'D' },
};

describe('keepOrder', () => {
  it('lists givers who opened their current assignment before the others', () => {
    const status = {
      a: { assignedAt: '2026-11-01T00:00:00Z', openedAt: '2026-11-02T00:00:00Z' },
      b: { assignedAt: '2026-11-01T00:00:00Z' },
      // c opened, then was re-drawn: not opened for the current assignment.
      c: { assignedAt: '2026-11-03T00:00:00Z', openedAt: '2026-11-02T00:00:00Z' },
      d: { assignedAt: '2026-11-01T00:00:00Z', openedAt: '2026-11-02T00:00:00Z' },
    };
    const order = keepOrder(draw, status);
    expect(order).toHaveLength(4);
    expect(order.slice(0, 2).map(k => k.giverId).sort()).toEqual(['a', 'd']);
    expect(order.slice(2).map(k => k.giverId).sort()).toEqual(['b', 'c']);
    for (const { giverId, receiverId } of order) expect(receiverId).toBe(draw.receivers[giverId]);
  });

  it('is empty when there is no draw', () => {
    expect(keepOrder(NO_DRAW, {})).toEqual([]);
  });
});

describe('changedGivers', () => {
  it('names givers whose receiver differs, ignoring givers who left', () => {
    const next = { a: 'b', b: 'd', c: 'b', e: 'a' };
    expect(changedGivers(draw.receivers, next).sort()).toEqual(['b', 'c']);
  });

  it('is empty when nothing moved', () => {
    expect(changedGivers(draw.receivers, draw.receivers)).toEqual([]);
  });
});
