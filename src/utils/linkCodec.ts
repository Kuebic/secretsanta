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

const ID_ONLY = new RegExp(`^${ID}$`);
const ORGANIZER_PATH = new RegExp(`^/o/(${ID})$`);
const PARTICIPANT_PATH = new RegExp(`^/p/(${ID})/(${ID})$`);
// Organizer and participant links share the fragment shape: key, dot, token.
const FRAGMENT = new RegExp(`^#(${KEY})\\.(${TOKEN})$`);

function parseFragment(hash: string): { key: string; token: string } | null {
  const match = FRAGMENT.exec(hash);
  return match ? { key: match[1], token: match[2] } : null;
}

// A pasted link: its path must match, and its fragment carries the credentials.
function parseLink<T>(link: string, path: RegExp, read: (pathParts: string[], hash: string) => T | null): T | null {
  let url: URL;
  try {
    url = new URL(link.trim());
  } catch {
    return null;
  }
  const match = path.exec(url.pathname);
  return match ? read(match.slice(1), url.hash) : null;
}

export function buildOrganizerLink(origin: string, { eventId, eventKey, organizerToken }: OrganizerCredentials): string {
  return `${origin}/o/${eventId}#${eventKey}.${organizerToken}`;
}

// Parses the fragment of the current page or a pasted organizer link.
export function parseOrganizerFragment(eventId: string, hash: string): OrganizerCredentials | null {
  const fragment = parseFragment(hash);
  if (!fragment || !ID_ONLY.test(eventId)) {
    return null;
  }
  return { eventId, eventKey: fragment.key, organizerToken: fragment.token };
}

export function parseOrganizerLink(link: string): OrganizerCredentials | null {
  return parseLink(link, ORGANIZER_PATH, ([eventId], hash) => parseOrganizerFragment(eventId, hash));
}

export interface ParticipantCredentials {
  eventId: string;
  participantId: string;
  eventKey: string;
  participantToken: string;
}

export function buildParticipantLink(origin: string, { eventId, participantId, eventKey, participantToken }: ParticipantCredentials): string {
  return `${origin}/p/${eventId}/${participantId}#${eventKey}.${participantToken}`;
}

// Parses the fragment of the current participant page.
export function parseParticipantFragment(eventId: string, participantId: string, hash: string): ParticipantCredentials | null {
  const fragment = parseFragment(hash);
  if (!fragment || !ID_ONLY.test(eventId) || !ID_ONLY.test(participantId)) {
    return null;
  }
  return { eventId, participantId, eventKey: fragment.key, participantToken: fragment.token };
}

export function parseParticipantLink(link: string): ParticipantCredentials | null {
  return parseLink(link, PARTICIPANT_PATH, ([eventId, participantId], hash) => parseParticipantFragment(eventId, participantId, hash));
}
