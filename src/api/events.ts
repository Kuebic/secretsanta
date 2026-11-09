import type { AssignmentStatus, ParticipantStatus } from '../../worker/events';
import { SealedEvent } from '../utils/eventData';

// Thin client for the Worker's events API. Bodies carry ciphertext and token
// hashes only; the organizer token travels in the Authorization header.

export class ApiError extends Error {
  constructor(readonly status: number) {
    super(`Events API answered ${status}`);
  }
}

// Plaintext timing the Worker keeps per participant (ADR 0002), as the
// Worker defines it.
export type { AssignmentStatus, ParticipantStatus } from '../../worker/events';

export interface StoredEvent {
  details: string;
  roster: string;
  organizerOnly: string;
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

// A per-participant resource that may not exist yet: null on 404.
async function fetchOptional<T>(eventId: string, resource: string): Promise<T | null> {
  try {
    return await (await request('GET', eventId, undefined, undefined, resource)).json() as T;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

const participantResource = (participantId: string, sub: string) => `/participants/${encodeURIComponent(participantId)}/${sub}`;

export async function saveEvent(eventId: string, organizerToken: string, sealed: SealedEvent): Promise<{ createdAt: string; updatedAt: string }> {
  return (await request('PUT', eventId, organizerToken, sealed)).json();
}

export async function fetchEvent(eventId: string): Promise<StoredEvent> {
  return (await request('GET', eventId)).json();
}

// The organizer's status table: per-participant wishlist and opened timing.
// Timing is plaintext the event GET already carries (ADR 0002), so there is
// no separate call.
export async function fetchStatus(eventId: string): Promise<Record<string, ParticipantStatus>> {
  return (await fetchEvent(eventId)).status;
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
export function fetchAssignment(eventId: string, participantId: string): Promise<StoredAssignment | null> {
  return fetchOptional<StoredAssignment>(eventId, participantResource(participantId, 'assignment'));
}

// Records that the giver opened their assignment, with their own participant token.
export async function markOpened(eventId: string, participantId: string, participantToken: string): Promise<string> {
  const response = await request('POST', eventId, participantToken, undefined, participantResource(participantId, 'opened'));
  const { openedAt } = await response.json() as { openedAt: string };
  return openedAt;
}

export interface StoredWishlist {
  wishlist: string;
  wishlistUpdatedAt?: string;
}

// A participant's sealed wishlist, or null when they have not written one yet.
export function fetchWishlist(eventId: string, participantId: string): Promise<StoredWishlist | null> {
  return fetchOptional<StoredWishlist>(eventId, participantResource(participantId, 'wishlist'));
}

// Saves the participant's own sealed wishlist with their participant token.
export async function saveWishlist(eventId: string, participantId: string, participantToken: string, wishlist: string): Promise<string> {
  const response = await request('PUT', eventId, participantToken, { wishlist }, participantResource(participantId, 'wishlist'));
  const { wishlistUpdatedAt } = await response.json() as { wishlistUpdatedAt: string };
  return wishlistUpdatedAt;
}
