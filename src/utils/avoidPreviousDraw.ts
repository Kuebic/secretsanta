import { produce } from 'immer';
import { Participants } from '../types';

// The assignments of an earlier event, decrypted in the browser.
// `assignments` maps a giver's participant ID to their receiver's, both IDs
// of the previous event's roster.
export interface PreviousDraw {
  roster: Record<string, { name: string }>;
  assignments: Record<string, string>;
}

export interface AddedRule {
  giverId: string;
  receiverId: string;
}

export interface AvoidPreviousDrawResult {
  participants: Participants;
  added: AddedRule[];
  unmatched: string[];
}

// "Alice", " alice" and "ALICE" are the same person typed twice a year apart.
const nameKey = (name: string) => name.normalize('NFC').trim().toLocaleLowerCase();

// Participant IDs differ between events, so the previous draw is mapped onto
// the current roster by name. A name two current participants share cannot be
// mapped and is reported as unmatched, like a missing one.
export function avoidPreviousDraw(previous: PreviousDraw, current: Participants): AvoidPreviousDrawResult {
  const byName = new Map<string, string | null>();
  for (const { id, name } of Object.values(current)) {
    const key = nameKey(name);
    byName.set(key, byName.has(key) ? null : id);
  }
  const added: AddedRule[] = [];
  const unmatched = new Set<string>();
  const match = (previousId: string): string | undefined => {
    const name = previous.roster[previousId]?.name;
    if (name === undefined) return undefined;
    const id = byName.get(nameKey(name));
    if (!id) {
      unmatched.add(name.trim());
      return undefined;
    }
    return id;
  };
  for (const [previousGiver, previousReceiver] of Object.entries(previous.assignments)) {
    const giverId = match(previousGiver);
    const receiverId = match(previousReceiver);
    if (giverId === undefined || receiverId === undefined) continue;
    const { rules } = current[giverId];
    const receiverFixed = rules.some(rule => rule.type === 'must');
    const alreadyThere = rules.some(rule => rule.type === 'mustNot' && rule.targetParticipantId === receiverId);
    if (giverId !== receiverId && !receiverFixed && !alreadyThere) {
      added.push({ giverId, receiverId });
    }
  }
  const participants = produce(current, draft => {
    for (const { giverId, receiverId } of added) {
      draft[giverId].rules.push({ type: 'mustNot', targetParticipantId: receiverId });
    }
  });
  return { participants, added, unmatched: [...unmatched] };
}
