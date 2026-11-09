import { Participant, Participants, Rule } from '../types';
import { hashToken } from './base64url';
import { decryptBlob, deriveKey, encryptBlob, mintToken } from './eventCrypto';
import { OrganizerCredentials } from './linkCodec';

// What the organizer edits, in plaintext, only ever in the browser.
export interface EventDetails {
  title: string;
  budget: string;
  // Exchange date as YYYY-MM-DD, or empty.
  date: string;
  location: string;
  notes: string;
}

// Character budgets per field, in UTF-16 code units (what <input maxLength>
// counts). Chosen so that even the costliest characters to JSON-encode (six
// bytes each) keep the sealed details blob under the Worker's 16 KB limit.
export const DETAILS_LIMITS = { title: 100, budget: 50, location: 200, notes: 1500 } as const;

export interface EventContent {
  details: EventDetails;
  participants: Participants;
  participantTokens: Record<string, string>;
}

// Readable by everyone holding the event key (organizer and participants).
type RosterPlaintext = Record<string, { name: string; note?: string }>;

// Readable only with the organizer link: a participant who knew another
// participant's token could write their wishlist and read their assignment.
interface OrganizerPlaintext {
  participantTokens: Record<string, string>;
  rules: Record<string, Rule[]>;
}

// The JSON body of PUT /api/events/:id. Ciphertext and token hashes only.
export interface SealedEvent {
  details: string;
  roster: string;
  organizer: string;
  participantTokenHashes: Record<string, string>;
}

export const EMPTY_DETAILS: EventDetails = { title: '', budget: '', date: '', location: '', notes: '' };

const organizerKey = (credentials: OrganizerCredentials) =>
  deriveKey(credentials.eventKey, credentials.organizerToken, 'organizer');

// Every participant has a token; new participants get one minted here and
// removed participants lose theirs.
export function withParticipantTokens(participants: Participants, tokens: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.keys(participants).map(id => [id, tokens[id] ?? mintToken()]));
}

export async function sealEvent(credentials: OrganizerCredentials, content: EventContent): Promise<SealedEvent> {
  const participants = Object.values(content.participants);
  const roster: RosterPlaintext = Object.fromEntries(
    participants.map(({ id, name, hint }) => [id, hint ? { name, note: hint } : { name }]),
  );
  const organizer: OrganizerPlaintext = {
    participantTokens: content.participantTokens,
    rules: Object.fromEntries(participants.filter(p => p.rules.length > 0).map(({ id, rules }) => [id, rules])),
  };
  const participantTokenHashes: Record<string, string> = {};
  for (const { id } of participants) {
    participantTokenHashes[id] = await hashToken(content.participantTokens[id]);
  }
  return {
    details: await encryptBlob(credentials.eventKey, JSON.stringify(content.details)),
    roster: await encryptBlob(credentials.eventKey, JSON.stringify(roster)),
    organizer: await encryptBlob(await organizerKey(credentials), JSON.stringify(organizer)),
    participantTokenHashes,
  };
}

export async function openEvent(
  credentials: OrganizerCredentials,
  sealed: { details: string; roster: string; organizer: string },
): Promise<EventContent> {
  const details = { ...EMPTY_DETAILS, ...JSON.parse(await decryptBlob(credentials.eventKey, sealed.details)) } as EventDetails;
  const roster = JSON.parse(await decryptBlob(credentials.eventKey, sealed.roster)) as RosterPlaintext;
  const organizer = JSON.parse(await decryptBlob(await organizerKey(credentials), sealed.organizer)) as OrganizerPlaintext;
  const participants: Participants = {};
  for (const [id, { name, note }] of Object.entries(roster)) {
    const participant: Participant = { id, name, rules: organizer.rules[id] ?? [] };
    if (note) {
      participant.hint = note;
    }
    participants[id] = participant;
  }
  return { details, participants, participantTokens: withParticipantTokens(participants, organizer.participantTokens) };
}

// What a participant link can read: details and roster, both under the event
// key. Rules and tokens stay in the organizer blob.
export interface ParticipantView {
  details: EventDetails;
  names: Record<string, string>;
  // Organizer's notes, by participant ID, for the giver to see.
  notes: Record<string, string>;
}

export async function openParticipantView(eventKey: string, sealed: { details: string; roster: string }): Promise<ParticipantView> {
  const details = { ...EMPTY_DETAILS, ...JSON.parse(await decryptBlob(eventKey, sealed.details)) } as EventDetails;
  const roster = JSON.parse(await decryptBlob(eventKey, sealed.roster)) as RosterPlaintext;
  return {
    details,
    names: Object.fromEntries(Object.entries(roster).map(([id, { name }]) => [id, name])),
    notes: Object.fromEntries(Object.entries(roster).flatMap(([id, { note }]) => note ? [[id, note]] : [])),
  };
}
