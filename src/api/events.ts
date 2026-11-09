import { SealedEvent } from '../utils/eventData';

// Thin client for the Worker's events API. Bodies carry ciphertext and token
// hashes only; the organizer token travels in the Authorization header.

export class ApiError extends Error {
  constructor(readonly status: number) {
    super(`Events API answered ${status}`);
  }
}

export interface StoredEvent {
  details: string;
  roster: string;
  organizer: string;
  createdAt: string;
  updatedAt: string;
}

async function request(method: string, eventId: string, token?: string, body?: unknown): Promise<Response> {
  const headers: Record<string, string> = {};
  if (token) headers.authorization = `Bearer ${token}`;
  if (body !== undefined) headers['content-type'] = 'application/json';
  const response = await fetch(`/api/events/${encodeURIComponent(eventId)}`, {
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

export async function deleteEvent(eventId: string, organizerToken: string): Promise<void> {
  await request('DELETE', eventId, organizerToken);
}
