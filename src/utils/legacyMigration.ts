import { Participant, Participants, Rule } from '../types';
import { mintParticipantId } from './eventCrypto';
import { EMPTY_DETAILS, EventDetails } from './eventData';

// The static version kept everything in three localStorage keys. Values are
// whatever JSON.parse gave back: any shape the old app ever wrote, or junk.
export interface LegacyData {
  participants: unknown;
  assignments: unknown;
  instructions: unknown;
}

export interface MigratedEvent {
  details: EventDetails;
  participants: Participants;
  // giver participant ID -> receiver participant ID, both in `participants`.
  assignments: Record<string, string>;
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isRuleType = (value: unknown): value is Rule['type'] => value === 'must' || value === 'mustNot';

interface RawParticipant {
  oldId: string;
  name: string;
  hint: string;
  rules: { type: Rule['type']; target: string }[];
}

// Records keyed by ID (every release but the first) or, from the first
// release, an array of `{ name, rules: [{ type, targetParticipant: name }] }`.
// Either way rules end up pointing at an old ID.
function readParticipants(value: unknown): RawParticipant[] {
  const read = (entry: unknown, oldId: string, ruleTarget: (rule: Record<string, unknown>) => unknown): RawParticipant | null => {
    if (!isObject(entry) || typeof entry.name !== 'string' || entry.name.trim() === '') return null;
    const rules = Array.isArray(entry.rules) ? entry.rules : [];
    return {
      oldId,
      name: entry.name.trim(),
      hint: typeof entry.hint === 'string' ? entry.hint.trim() : '',
      rules: rules.flatMap(rule => {
        if (!isObject(rule) || !isRuleType(rule.type)) return [];
        const target = ruleTarget(rule);
        return typeof target === 'string' ? [{ type: rule.type, target }] : [];
      }),
    };
  };
  if (Array.isArray(value)) {
    return value.flatMap(entry => {
      const participant = read(entry, isObject(entry) ? String(entry.name).trim() : '', rule =>
        typeof rule.targetParticipant === 'string' ? rule.targetParticipant.trim() : undefined);
      return participant ? [participant] : [];
    });
  }
  if (isObject(value)) {
    return Object.entries(value).flatMap(([oldId, entry]) => {
      const participant = read(entry, oldId, rule => rule.targetParticipantId);
      return participant ? [participant] : [];
    });
  }
  return [];
}

// Participant IDs are re-minted: the old ones are UUIDs (or names), the
// Worker only accepts 128-bit base64url IDs.
export function mapLegacyData(legacy: LegacyData, mintId: () => string = mintParticipantId): MigratedEvent | null {
  const raw = readParticipants(legacy.participants);
  const newIds = new Map<string, string>();
  for (const { oldId } of raw) {
    if (!newIds.has(oldId)) newIds.set(oldId, mintId());
  }
  const participants: Participants = {};
  for (const { oldId, name, hint, rules } of raw) {
    const id = newIds.get(oldId)!;
    if (participants[id]) continue;
    const participant: Participant = {
      id,
      name,
      rules: rules.flatMap(({ type, target }) => {
        const targetParticipantId = newIds.get(target);
        return targetParticipantId && targetParticipantId !== id ? [{ type, targetParticipantId }] : [];
      }),
    };
    if (hint) participant.hint = hint;
    participants[id] = participant;
  }
  const notes = typeof legacy.instructions === 'string' ? legacy.instructions.trim() : '';
  if (Object.keys(participants).length === 0 && notes === '') {
    return null;
  }
  return { details: { ...EMPTY_DETAILS, notes }, participants, assignments: readAssignments(legacy.assignments, raw, newIds) };
}

// The last draw is `{ hash, pairings: [{ giver: { id, name }, receiver }] }`,
// or from the first release `[[giverName, receiverName]]`. Its old IDs were
// blank when the old app converted the first shape, so a person is found by
// old ID first, then by a name nobody else has. An assignment naming someone
// who left the list since is dropped; the draw was stale already.
function readAssignments(value: unknown, raw: RawParticipant[], newIds: Map<string, string>): Record<string, string> {
  const nameCounts = new Map<string, number>();
  for (const { name } of raw) nameCounts.set(name, (nameCounts.get(name) ?? 0) + 1);
  const byName = new Map(raw.filter(({ name }) => nameCounts.get(name) === 1).map(({ oldId, name }) => [name, newIds.get(oldId)!]));
  const find = (person: unknown): string | undefined => {
    if (typeof person === 'string') return byName.get(person.trim());
    if (!isObject(person)) return undefined;
    if (typeof person.id === 'string' && newIds.has(person.id)) return newIds.get(person.id);
    return typeof person.name === 'string' ? byName.get(person.name.trim()) : undefined;
  };
  const pairs: [unknown, unknown][] = Array.isArray(value)
    ? value.flatMap(entry => (Array.isArray(entry) ? [[entry[0], entry[1]] as [unknown, unknown]] : []))
    : isObject(value) && Array.isArray(value.pairings)
      ? value.pairings.flatMap(entry => (isObject(entry) ? [[entry.giver, entry.receiver] as [unknown, unknown]] : []))
      : [];
  const assignments: Record<string, string> = {};
  for (const [giver, receiver] of pairs) {
    const giverId = find(giver);
    const receiverId = find(receiver);
    if (giverId && receiverId && giverId !== receiverId) {
      assignments[giverId] = receiverId;
    }
  }
  return assignments;
}
