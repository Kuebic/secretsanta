// Links carry the event key and tokens in the fragment, which browsers never
// send to the server (ADR 0002). Never move them to the path or query.

export interface OrganizerCredentials {
  eventId: string;
  eventKey: string;
  organizerToken: string;
}

const ID = '[A-Za-z0-9_-]{22}';
const KEY = '[A-Za-z0-9_-]{43}';
const TOKEN = '[A-Za-z0-9_-]{22}';

const ORGANIZER_PATH = new RegExp(`^/o/(${ID})$`);
// Organizer and participant links share the fragment shape: key, dot, token.
const ORGANIZER_FRAGMENT = new RegExp(`^#(${KEY})\\.(${TOKEN})$`);

export function buildOrganizerLink(origin: string, { eventId, eventKey, organizerToken }: OrganizerCredentials): string {
  return `${origin}/o/${eventId}#${eventKey}.${organizerToken}`;
}

// Parses the fragment of the current page or a pasted organizer link.
export function parseOrganizerFragment(eventId: string, hash: string): OrganizerCredentials | null {
  const match = ORGANIZER_FRAGMENT.exec(hash);
  if (!match || !new RegExp(`^${ID}$`).test(eventId)) {
    return null;
  }
  return { eventId, eventKey: match[1], organizerToken: match[2] };
}

export function parseOrganizerLink(link: string): OrganizerCredentials | null {
  let url: URL;
  try {
    url = new URL(link.trim());
  } catch {
    return null;
  }
  const path = ORGANIZER_PATH.exec(url.pathname);
  return path ? parseOrganizerFragment(path[1], url.hash) : null;
}

export interface ParticipantCredentials {
  eventId: string;
  participantId: string;
  eventKey: string;
  participantToken: string;
}

const PARTICIPANT_PATH = new RegExp(`^/p/(${ID})/(${ID})$`);
const ID_ONLY = new RegExp(`^${ID}$`);

export function buildParticipantLink(origin: string, { eventId, participantId, eventKey, participantToken }: ParticipantCredentials): string {
  return `${origin}/p/${eventId}/${participantId}#${eventKey}.${participantToken}`;
}

// Parses the fragment of the current participant page.
export function parseParticipantFragment(eventId: string, participantId: string, hash: string): ParticipantCredentials | null {
  const match = ORGANIZER_FRAGMENT.exec(hash);
  if (!match || !ID_ONLY.test(eventId) || !ID_ONLY.test(participantId)) {
    return null;
  }
  return { eventId, participantId, eventKey: match[1], participantToken: match[2] };
}

export function parseParticipantLink(link: string): ParticipantCredentials | null {
  let url: URL;
  try {
    url = new URL(link.trim());
  } catch {
    return null;
  }
  const path = PARTICIPANT_PATH.exec(url.pathname);
  return path ? parseParticipantFragment(path[1], path[2], url.hash) : null;
}
