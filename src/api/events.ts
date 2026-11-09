import { SealedEvent } from '../utils/eventData';

// Thin client for the Worker's events API. Bodies carry ciphertext and token
// hashes only; the organizer token travels in the Authorization header.

export class ApiError extends Error {
  constructor(readonly status: number) {
    super(`Events API answered ${status}`);
  }
}

// Plaintext timing the Worker keeps per participant (ADR 0002).
export interface AssignmentStatus {
  assignedAt?: string;
  openedAt?: string;
}

// Plaintext timing per participant in the event status: assignment timing
// plus when their wishlist last changed.
export interface ParticipantStatus extends AssignmentStatus {
  wishlistUpdatedAt?: string;
}

export interface StoredEvent {
  details: string;
  roster: string;
  organizer: string;
  createdAt: string;
  updatedAt: string;
  status: Record<string, ParticipantStatus>;
}

export interface StoredAssignment extends AssignmentStatus {
  assignment: string;
}

async function request(method: string, eventId: string, token?: string, body?: unknown, resource = ''): Promise<Response> {
  const headers: Record<string, string> = {};
  if (token) headers.authorization = `Bearer ${token}`;
  if (body !== undefined) headers['content-type'] = 'application/json';
  const response = await fetch(`/api/events/${encodeURIComponent(eventId)}${resource}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) {
    throw new ApiError(response.status);
  }
  return response;
}

export async function saveEvent(eventId: string, organizerToken: string, sealed: SealedEvent): Promise<{ createdAt: string; updatedAt: string }> {
  return (await request('PUT', eventId, organizerToken, sealed)).json();
}

export async function fetchEvent(eventId: string): Promise<StoredEvent> {
  return (await request('GET', eventId)).json();
}

// One ciphertext per giver; replaces the whole draw.
export async function saveAssignments(eventId: string, organizerToken: string, assignments: Record<string, string>): Promise<void> {
  await request('PUT', eventId, organizerToken, { assignments }, '/assignments');
}

export async function deleteEvent(eventId: string, organizerToken: string): Promise<void> {
  await request('DELETE', eventId, organizerToken);
}

// A giver's encrypted assignment and its timing, or null when the event has
// no draw for them yet.
export async function fetchAssignment(eventId: string, participantId: string): Promise<StoredAssignment | null> {
  const response = await fetch(
    `/api/events/${encodeURIComponent(eventId)}/participants/${encodeURIComponent(participantId)}/assignment`,
  );
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new ApiError(response.status);
  }
  return await response.json() as StoredAssignment;
}

// Records that the giver opened their assignment, with their own participant token.
export async function markOpened(eventId: string, participantId: string, participantToken: string): Promise<string> {
  const response = await request('POST', eventId, participantToken, undefined, `/participants/${encodeURIComponent(participantId)}/opened`);
  const { openedAt } = await response.json() as { openedAt: string };
  return openedAt;
}

export interface StoredWishlist {
  wishlist: string;
  wishlistUpdatedAt?: string;
}

const wishlistResource = (participantId: string) => `/participants/${encodeURIComponent(participantId)}/wishlist`;

// A participant's sealed wishlist, or null when they have not written one yet.
export async function fetchWishlist(eventId: string, participantId: string): Promise<StoredWishlist | null> {
  const response = await fetch(`/api/events/${encodeURIComponent(eventId)}${wishlistResource(participantId)}`);
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new ApiError(response.status);
  }
  return await response.json() as StoredWishlist;
}

// Saves the participant's own sealed wishlist with their participant token.
export async function saveWishlist(eventId: string, participantId: string, participantToken: string, wishlist: string): Promise<string> {
  const response = await request('PUT', eventId, participantToken, { wishlist }, wishlistResource(participantId));
  const { wishlistUpdatedAt } = await response.json() as { wishlistUpdatedAt: string };
  return wishlistUpdatedAt;
}
