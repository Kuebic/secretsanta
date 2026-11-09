import { hashToken } from '../src/utils/base64url';
import type { Env } from './index';

// Server side of ADR 0002: every value here is ciphertext the browser made,
// except meta (token hash and timestamps) and participant token hashes.

export const MAX_BLOB_BYTES = 16 * 1024;
export const MAX_PARTICIPANTS = 100;
// 13 months, rounded up, refreshed on every organizer write.
export const EVENT_TTL_SECONDS = 396 * 24 * 60 * 60;
// Largest body any route accepts: three blobs plus participant token hashes.
const MAX_BODY_BYTES = 3 * MAX_BLOB_BYTES + MAX_PARTICIPANTS * 80 + 1024;

const ID = /^[A-Za-z0-9_-]{22}$/;
const HASH = /^[A-Za-z0-9_-]{43}$/;
// base64url of at least a 12-byte IV and a 16-byte GCM tag.
const CIPHERTEXT = /^[A-Za-z0-9_-]{38,}$/;

interface Meta {
  organizerTokenHash: string;
  createdAt: string;
  updatedAt: string;
}

interface StoredRoster {
  roster: string;
  organizer: string;
  participantTokenHashes: Record<string, string>;
}

// Plaintext KV metadata of an assignment: timing only (ADR 0002).
// assignedAt moves when a draw changes the ciphertext; openedAt when the
// giver opens it.
interface AssignmentStatus {
  assignedAt?: string;
  openedAt?: string;
}

// What the event status lists per participant: assignment timing plus when
// their wishlist last changed. Plaintext timing only.
interface ParticipantStatus extends AssignmentStatus {
  wishlistUpdatedAt?: string;
}

class HttpError extends Error {
  constructor(readonly status: number, readonly code: string) {
    super(code);
  }
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

const keys = {
  prefix: (id: string) => `event:${id}:`,
  meta: (id: string) => `event:${id}:meta`,
  details: (id: string) => `event:${id}:details`,
  roster: (id: string) => `event:${id}:roster`,
  assignment: (id: string, pid: string) => `event:${id}:p:${pid}:assignment`,
  wishlist: (id: string, pid: string) => `event:${id}:p:${pid}:wishlist`,
};

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

function bearerToken(request: Request): string | null {
  const match = /^Bearer (\S+)$/.exec(request.headers.get('authorization') ?? '');
  return match ? match[1] : null;
}

async function readJson(request: Request): Promise<Record<string, unknown>> {
  const declared = Number(request.headers.get('content-length') ?? '0');
  if (declared > MAX_BODY_BYTES) {
    throw new HttpError(413, 'too_large');
  }
  const text = await request.text();
  if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) {
    throw new HttpError(413, 'too_large');
  }
  try {
    const body = JSON.parse(text);
    if (body && typeof body === 'object' && !Array.isArray(body)) {
      return body;
    }
  } catch {
    // fall through
  }
  throw new HttpError(400, 'invalid_body');
}

function ciphertext(value: unknown): string {
  if (typeof value !== 'string' || !CIPHERTEXT.test(value)) {
    throw new HttpError(400, 'invalid_body');
  }
  if (value.length > MAX_BLOB_BYTES) {
    throw new HttpError(413, 'too_large');
  }
  return value;
}

function rosterFromBody(body: Record<string, unknown>): StoredRoster {
  const hashes = body.participantTokenHashes;
  if (!hashes || typeof hashes !== 'object' || Array.isArray(hashes)) {
    throw new HttpError(400, 'invalid_body');
  }
  const entries = Object.entries(hashes);
  if (entries.length > MAX_PARTICIPANTS) {
    throw new HttpError(413, 'too_many_participants');
  }
  for (const [pid, hash] of entries) {
    if (!ID.test(pid) || typeof hash !== 'string' || !HASH.test(hash)) {
      throw new HttpError(400, 'invalid_body');
    }
  }
  return {
    roster: ciphertext(body.roster),
    organizer: ciphertext(body.organizer),
    participantTokenHashes: Object.fromEntries(entries) as Record<string, string>,
  };
}

async function readMeta(env: Env, id: string): Promise<Meta | null> {
  const raw = await env.EVENTS.get(keys.meta(id));
  return raw ? (JSON.parse(raw) as Meta) : null;
}

// Missing token: 401. Token that does not hash to the stored one: 403.
async function authorizeToken(request: Request, expectedHash: string | undefined): Promise<void> {
  const token = bearerToken(request);
  if (!token) {
    throw new HttpError(401, 'unauthorized');
  }
  if (expectedHash === undefined || !constantTimeEqual(await hashToken(token), expectedHash)) {
    throw new HttpError(403, 'forbidden');
  }
}

const authorizeOrganizer = (request: Request, meta: Meta) => authorizeToken(request, meta.organizerTokenHash);

async function requireEvent(env: Env, id: string): Promise<Meta> {
  const meta = await readMeta(env, id);
  if (!meta) {
    throw new HttpError(404, 'not_found');
  }
  return meta;
}

const put = (env: Env, key: string, value: string) => env.EVENTS.put(key, value, { expirationTtl: EVENT_TTL_SECONDS });

// Every organizer write rewrites meta, details and roster so all three get a
// fresh 13-month TTL together.
async function writeEvent(env: Env, id: string, meta: Meta, details: string, roster: StoredRoster): Promise<void> {
  await put(env, keys.details(id), details);
  await put(env, keys.roster(id), JSON.stringify(roster));
  await put(env, keys.meta(id), JSON.stringify(meta));
}

async function readStored(env: Env, id: string): Promise<{ details: string; roster: StoredRoster }> {
  const [details, roster] = await Promise.all([env.EVENTS.get(keys.details(id)), env.EVENTS.get(keys.roster(id))]);
  if (details === null || roster === null) {
    throw new HttpError(404, 'not_found');
  }
  return { details, roster: JSON.parse(roster) as StoredRoster };
}

async function putEvent(request: Request, env: Env, id: string): Promise<Response> {
  const existing = await readMeta(env, id);
  const token = bearerToken(request);
  if (!token) {
    throw new HttpError(401, 'unauthorized');
  }
  if (existing) {
    await authorizeOrganizer(request, existing);
  }
  const body = await readJson(request);
  const details = ciphertext(body.details);
  const roster = rosterFromBody(body);
  const now = new Date().toISOString();
  const meta: Meta = existing
    ? { ...existing, updatedAt: now }
    : { organizerTokenHash: await hashToken(token), createdAt: now, updatedAt: now };
  await writeEvent(env, id, meta, details, roster);
  return json({ createdAt: meta.createdAt, updatedAt: meta.updatedAt }, existing ? 200 : 201);
}

// Per-participant status for every roster entry, read from KV metadata in
// one prefix listing.
async function readStatus(env: Env, id: string, roster: StoredRoster): Promise<Record<string, ParticipantStatus>> {
  const status: Record<string, ParticipantStatus> = Object.fromEntries(
    Object.keys(roster.participantTokenHashes).map(pid => [pid, {}]),
  );
  const prefix = `${keys.prefix(id)}p:`;
  let cursor: string | undefined;
  do {
    const page = await env.EVENTS.list({ prefix, cursor });
    for (const { name, metadata } of page.keys) {
      const [pid, kind] = name.slice(prefix.length).split(':');
      if (kind === 'assignment' && pid in status) {
        Object.assign(status[pid], assignmentStatus(metadata));
      }
      if (kind === 'wishlist' && pid in status) {
        Object.assign(status[pid], wishlistStatus(metadata));
      }
    }
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);
  return status;
}

function assignmentStatus(metadata: unknown): AssignmentStatus {
  const status: AssignmentStatus = {};
  if (metadata && typeof metadata === 'object') {
    const { assignedAt, openedAt } = metadata as Record<string, unknown>;
    if (typeof assignedAt === 'string') status.assignedAt = assignedAt;
    if (typeof openedAt === 'string') status.openedAt = openedAt;
  }
  return status;
}

function wishlistStatus(metadata: unknown): { wishlistUpdatedAt?: string } {
  const value = metadata && typeof metadata === 'object' ? (metadata as Record<string, unknown>).wishlistUpdatedAt : undefined;
  return typeof value === 'string' ? { wishlistUpdatedAt: value } : {};
}

// Participant writes keep the event's expiry rather than refreshing it: only
// organizer writes extend an event's life.
const eventExpiration = (meta: Meta) => Math.floor(Date.parse(meta.updatedAt) / 1000) + EVENT_TTL_SECONDS;

async function getEvent(env: Env, id: string): Promise<Response> {
  const meta = await requireEvent(env, id);
  const { details, roster } = await readStored(env, id);
  return json({
    details,
    roster: roster.roster,
    organizer: roster.organizer,
    createdAt: meta.createdAt,
    updatedAt: meta.updatedAt,
    status: await readStatus(env, id, roster),
  });
}

async function putDetails(request: Request, env: Env, id: string): Promise<Response> {
  const meta = await requireEvent(env, id);
  await authorizeOrganizer(request, meta);
  const details = ciphertext((await readJson(request)).details);
  const { roster } = await readStored(env, id);
  const updated = { ...meta, updatedAt: new Date().toISOString() };
  await writeEvent(env, id, updated, details, roster);
  return json({ updatedAt: updated.updatedAt });
}

async function getDetails(env: Env, id: string): Promise<Response> {
  await requireEvent(env, id);
  const { details } = await readStored(env, id);
  return json({ details });
}

async function putRoster(request: Request, env: Env, id: string): Promise<Response> {
  const meta = await requireEvent(env, id);
  await authorizeOrganizer(request, meta);
  const roster = rosterFromBody(await readJson(request));
  const { details } = await readStored(env, id);
  const updated = { ...meta, updatedAt: new Date().toISOString() };
  await writeEvent(env, id, updated, details, roster);
  return json({ updatedAt: updated.updatedAt });
}

async function getRoster(env: Env, id: string): Promise<Response> {
  await requireEvent(env, id);
  const { roster } = await readStored(env, id);
  return json({ roster: roster.roster, organizer: roster.organizer });
}

// One ciphertext per giver, each sealed with a key only that giver's token
// derives (ADR 0003). A draw replaces the previous one entirely.
async function putAssignments(request: Request, env: Env, id: string): Promise<Response> {
  const meta = await requireEvent(env, id);
  await authorizeOrganizer(request, meta);
  const body = (await readJson(request)).assignments;
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new HttpError(400, 'invalid_body');
  }
  const { roster } = await readStored(env, id);
  const assignments: [string, string][] = [];
  for (const [pid, value] of Object.entries(body)) {
    if (!(pid in roster.participantTokenHashes)) {
      throw new HttpError(400, 'invalid_body');
    }
    assignments.push([pid, ciphertext(value)]);
  }
  const drawn = new Set(assignments.map(([pid]) => pid));
  const now = new Date().toISOString();
  // A giver whose ciphertext is resent unchanged keeps assignedAt and
  // openedAt, so "this changed" only shows when their receiver changed.
  const write = async ([pid, value]: [string, string]) => {
    const existing = await env.EVENTS.getWithMetadata(keys.assignment(id, pid));
    const status = assignmentStatus(existing.metadata);
    const metadata = existing.value === value && status.assignedAt ? status : { ...status, assignedAt: now };
    await env.EVENTS.put(keys.assignment(id, pid), value, { expirationTtl: EVENT_TTL_SECONDS, metadata });
  };
  await Promise.all([
    ...assignments.map(write),
    ...Object.keys(roster.participantTokenHashes)
      .filter(pid => !drawn.has(pid))
      .map(pid => env.EVENTS.delete(keys.assignment(id, pid))),
  ]);
  return json({ ok: true });
}

async function getAssignment(env: Env, id: string, pid: string): Promise<Response> {
  await requireEvent(env, id);
  const { value, metadata } = await env.EVENTS.getWithMetadata(keys.assignment(id, pid));
  if (value === null) {
    throw new HttpError(404, 'not_found');
  }
  return json({ assignment: value, ...assignmentStatus(metadata) });
}

// The giver, with their own participant token, records that they opened
// their assignment. The entry keeps the event's expiry: a participant write
// does not refresh the TTL.
async function postOpened(request: Request, env: Env, id: string, pid: string): Promise<Response> {
  const meta = await requireEvent(env, id);
  const { roster } = await readStored(env, id);
  await authorizeToken(request, roster.participantTokenHashes[pid]);
  const { value, metadata } = await env.EVENTS.getWithMetadata(keys.assignment(id, pid));
  if (value === null) {
    throw new HttpError(404, 'not_found');
  }
  const openedAt = new Date().toISOString();
  await env.EVENTS.put(keys.assignment(id, pid), value, {
    expiration: eventExpiration(meta),
    metadata: { ...assignmentStatus(metadata), openedAt },
  });
  return json({ openedAt });
}

// A participant saves their own wishlist, sealed with the event key in their
// browser, using their participant token. The server keeps the ciphertext
// and when it last changed (ADR 0002).
async function putWishlist(request: Request, env: Env, id: string, pid: string): Promise<Response> {
  const meta = await requireEvent(env, id);
  const { roster } = await readStored(env, id);
  await authorizeToken(request, roster.participantTokenHashes[pid]);
  const wishlist = ciphertext((await readJson(request)).wishlist);
  const wishlistUpdatedAt = new Date().toISOString();
  await env.EVENTS.put(keys.wishlist(id, pid), wishlist, {
    expiration: eventExpiration(meta),
    metadata: { wishlistUpdatedAt },
  });
  return json({ wishlistUpdatedAt });
}

async function getWishlist(env: Env, id: string, pid: string): Promise<Response> {
  await requireEvent(env, id);
  const { value, metadata } = await env.EVENTS.getWithMetadata(keys.wishlist(id, pid));
  if (value === null) {
    throw new HttpError(404, 'not_found');
  }
  return json({ wishlist: value, ...wishlistStatus(metadata) });
}

// Removes everything under the event's prefix, including entries later
// features add (wishlists, assignments).
async function deleteEvent(request: Request, env: Env, id: string): Promise<Response> {
  const meta = await requireEvent(env, id);
  await authorizeOrganizer(request, meta);
  const names: string[] = [];
  let cursor: string | undefined;
  do {
    const page = await env.EVENTS.list({ prefix: keys.prefix(id), cursor });
    names.push(...page.keys.map(key => key.name));
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);
  // Meta last, so a half-finished delete can be retried with the same token.
  const metaKey = keys.meta(id);
  await Promise.all(names.filter(name => name !== metaKey).map(name => env.EVENTS.delete(name)));
  await env.EVENTS.delete(metaKey);
  return new Response(null, { status: 204 });
}

export async function handleEvents(request: Request, env: Env, path: string[]): Promise<Response> {
  try {
    const [id, resource, ...rest] = path;
    if (!id || !ID.test(id)) {
      throw new HttpError(404, 'not_found');
    }
    if (resource === 'participants' && rest.length === 2 && ID.test(rest[0])) {
      const [pid, sub] = rest;
      if (request.method === 'GET' && sub === 'assignment') {
        return await getAssignment(env, id, pid);
      }
      if (request.method === 'GET' && sub === 'wishlist') {
        return await getWishlist(env, id, pid);
      }
      if (request.method === 'PUT' && sub === 'wishlist') {
        return await putWishlist(request, env, id, pid);
      }
      if (request.method === 'POST' && sub === 'opened') {
        return await postOpened(request, env, id, pid);
      }
      throw new HttpError(404, 'not_found');
    }
    if (rest.length > 0) {
      throw new HttpError(404, 'not_found');
    }
    const route = `${request.method} ${resource ?? ''}`;
    switch (route) {
      case 'PUT ':
        return await putEvent(request, env, id);
      case 'GET ':
        return await getEvent(env, id);
      case 'DELETE ':
        return await deleteEvent(request, env, id);
      case 'PUT details':
        return await putDetails(request, env, id);
      case 'GET details':
        return await getDetails(env, id);
      case 'PUT roster':
        return await putRoster(request, env, id);
      case 'GET roster':
        return await getRoster(env, id);
      case 'PUT assignments':
        return await putAssignments(request, env, id);
    }
    throw new HttpError(404, 'not_found');
  } catch (error) {
    if (error instanceof HttpError) {
      return json({ error: error.code }, error.status);
    }
    throw error;
  }
}
