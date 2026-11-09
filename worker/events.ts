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
async function authorizeOrganizer(request: Request, meta: Meta): Promise<void> {
  const token = bearerToken(request);
  if (!token) {
    throw new HttpError(401, 'unauthorized');
  }
  if (!constantTimeEqual(await hashToken(token), meta.organizerTokenHash)) {
    throw new HttpError(403, 'forbidden');
  }
}

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

async function getEvent(env: Env, id: string): Promise<Response> {
  const meta = await requireEvent(env, id);
  const { details, roster } = await readStored(env, id);
  return json({
    details,
    roster: roster.roster,
    organizer: roster.organizer,
    createdAt: meta.createdAt,
    updatedAt: meta.updatedAt,
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
    if (!id || !ID.test(id) || rest.length > 0) {
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
    }
    throw new HttpError(404, 'not_found');
  } catch (error) {
    if (error instanceof HttpError) {
      return json({ error: error.code }, error.status);
    }
    throw error;
  }
}
