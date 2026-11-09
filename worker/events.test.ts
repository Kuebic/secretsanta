import { beforeEach, describe, expect, it } from 'vitest';
import worker, { type Env } from './index';
import { hashToken } from '../src/utils/base64url';

const THIRTEEN_MONTHS = 396 * 24 * 60 * 60;
const MAX_BLOB_BYTES_PLUS_ONE = 16 * 1024 + 1;

interface StoredEntry {
  value: string;
  expirationTtl?: number;
  expiration?: number;
  metadata?: unknown;
  writes: number;
}

// In-memory stand-in for the EVENTS KV namespace.
function makeKv() {
  const store = new Map<string, StoredEntry>();
  return {
    store,
    async get(key: string) {
      return store.get(key)?.value ?? null;
    },
    async getWithMetadata(key: string) {
      const entry = store.get(key);
      return { value: entry?.value ?? null, metadata: entry?.metadata ?? null };
    },
    async put(key: string, value: string, options: { expirationTtl?: number; expiration?: number; metadata?: unknown } = {}) {
      store.set(key, { value, ...options, writes: (store.get(key)?.writes ?? 0) + 1 });
    },
    async delete(key: string) {
      store.delete(key);
    },
    async list({ prefix = '', cursor }: { prefix?: string; cursor?: string } = {}) {
      // Pages of two keys so callers must follow the cursor.
      const names = [...store.keys()].filter(name => name.startsWith(prefix)).sort();
      const start = cursor ? Number(cursor) : 0;
      const page = names.slice(start, start + 2);
      const done = start + 2 >= names.length;
      return { keys: page.map(name => ({ name, metadata: store.get(name)!.metadata })), list_complete: done, cursor: done ? undefined : String(start + 2) };
    },
  };
}

let kv: ReturnType<typeof makeKv>;
let env: Env;

beforeEach(() => {
  kv = makeKv();
  env = { ASSETS: { fetch: async () => new Response('asset') }, EVENTS: kv };
});

const EVENT_ID = 'evt_evt_evt_evt_evt_eA';
const ORGANIZER_TOKEN = 'org-org-org-org-org-oA';
const OTHER_TOKEN = 'bad-bad-bad-bad-bad-bA';
const P1 = 'p1p1p1p1p1p1p1p1p1p1p1';
const P2 = 'p2p2p2p2p2p2p2p2p2p2p2';

// Shaped like real ciphertext: base64url of iv || data || tag.
function blob(length = 64, fill = 'Q'): string {
  return fill.repeat(length);
}

async function eventBody(overrides: Record<string, unknown> = {}) {
  return {
    details: blob(64, 'D'),
    roster: blob(64, 'R'),
    organizer: blob(64, 'O'),
    participantTokenHashes: { [P1]: await hashToken('t1'), [P2]: await hashToken('t2') },
    ...overrides,
  };
}

function call(method: string, path: string, { token, body }: { token?: string; body?: unknown } = {}) {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (token) headers.authorization = `Bearer ${token}`;
  return worker.fetch(
    new Request(`https://santa.test${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
    }),
    env,
  );
}

async function createEvent() {
  const response = await call('PUT', `/api/events/${EVENT_ID}`, { token: ORGANIZER_TOKEN, body: await eventBody() });
  expect(response.status).toBe(201);
  return response;
}

describe('events API: create and read', () => {
  it('creates an event and returns its details and roster ciphertext', async () => {
    await createEvent();
    const response = await call('GET', `/api/events/${EVENT_ID}`);
    expect(response.status).toBe(200);
    const event = await response.json();
    expect(event).toMatchObject({ details: blob(64, 'D'), roster: blob(64, 'R'), organizer: blob(64, 'O') });
    expect(typeof event.createdAt).toBe('string');
    expect(typeof event.updatedAt).toBe('string');
  });

  it('stores only the SHA-256 of the organizer token', async () => {
    await createEvent();
    const everything = [...kv.store.values()].map(entry => entry.value).join('\n');
    expect(everything).not.toContain(ORGANIZER_TOKEN);
    expect(JSON.parse(kv.store.get(`event:${EVENT_ID}:meta`)!.value)).toMatchObject({
      organizerTokenHash: await hashToken(ORGANIZER_TOKEN),
    });
  });

  it('answers 404 for an unknown event', async () => {
    const response = await call('GET', `/api/events/${EVENT_ID}`);
    expect(response.status).toBe(404);
  });
});

describe('events API: organizer token', () => {
  it('updates the event with the right organizer token', async () => {
    await createEvent();
    const response = await call('PUT', `/api/events/${EVENT_ID}`, {
      token: ORGANIZER_TOKEN,
      body: await eventBody({ details: blob(80, 'E') }),
    });
    expect(response.status).toBe(200);
    expect((await (await call('GET', `/api/events/${EVENT_ID}`)).json()).details).toBe(blob(80, 'E'));
  });

  it('refuses an update with the wrong organizer token and keeps the event', async () => {
    await createEvent();
    const response = await call('PUT', `/api/events/${EVENT_ID}`, {
      token: OTHER_TOKEN,
      body: await eventBody({ details: blob(80, 'E') }),
    });
    expect(response.status).toBe(403);
    expect((await (await call('GET', `/api/events/${EVENT_ID}`)).json()).details).toBe(blob(64, 'D'));
  });

  it('refuses a create or update without a token', async () => {
    expect((await call('PUT', `/api/events/${EVENT_ID}`, { body: await eventBody() })).status).toBe(401);
    expect(kv.store.size).toBe(0);
    await createEvent();
    expect((await call('PUT', `/api/events/${EVENT_ID}`, { body: await eventBody() })).status).toBe(401);
  });
});

describe('events API: details after a draw', () => {
  it('new details written after the draw are served on the next read, and the same participant links still open their assignments', async () => {
    await createEvent();
    await call('PUT', `/api/events/${EVENT_ID}/assignments`, { token: ORGANIZER_TOKEN, body: { assignments: { [P1]: blob(64, 'A'), [P2]: blob(64, 'B') } } });

    const update = await call('PUT', `/api/events/${EVENT_ID}`, { token: ORGANIZER_TOKEN, body: await eventBody({ details: blob(64, 'E') }) });
    expect(update.status).toBe(200);

    expect((await (await call('GET', `/api/events/${EVENT_ID}`)).json()).details).toBe(blob(64, 'E'));
    expect(await (await call('GET', `/api/events/${EVENT_ID}/participants/${P1}/assignment`)).json()).toMatchObject({ assignment: blob(64, 'A') });
    expect((await call('POST', `/api/events/${EVENT_ID}/participants/${P1}/opened`, { token: 't1' })).status).toBe(200);
  });

});

describe('events API: limits', () => {
  it('accepts a blob of exactly 16 KB and rejects one byte more', async () => {
    await createEvent();
    const ok = await call('PUT', `/api/events/${EVENT_ID}`, { token: ORGANIZER_TOKEN, body: await eventBody({ details: blob(16 * 1024) }) });
    expect(ok.status).toBe(200);
    const tooBig = await call('PUT', `/api/events/${EVENT_ID}`, { token: ORGANIZER_TOKEN, body: await eventBody({ details: blob(16 * 1024 + 1) }) });
    expect(tooBig.status).toBe(413);
    const roster = await call('PUT', `/api/events/${EVENT_ID}`, { token: ORGANIZER_TOKEN, body: await eventBody({ roster: blob(16 * 1024 + 1) }) });
    expect(roster.status).toBe(413);
  });

  it('rejects a request body far over the limit before parsing it', async () => {
    await createEvent();
    const response = await call('PUT', `/api/events/${EVENT_ID}`, { token: ORGANIZER_TOKEN, body: 'x'.repeat(200 * 1024) });
    expect(response.status).toBe(413);
  });

  it('accepts 100 participants and rejects 101', async () => {
    const hashes = async (count: number) => {
      const entries: [string, string][] = [];
      for (let i = 0; i < count; i++) {
        entries.push([String(i).padStart(22, 'p'), await hashToken(`t${i}`)]);
      }
      return Object.fromEntries(entries);
    };
    const ok = await call('PUT', `/api/events/${EVENT_ID}`, { token: ORGANIZER_TOKEN, body: await eventBody({ participantTokenHashes: await hashes(100) }) });
    expect(ok.status).toBe(201);
    const tooMany = await call('PUT', `/api/events/${EVENT_ID}`, { token: ORGANIZER_TOKEN, body: await eventBody({ participantTokenHashes: await hashes(101) }) });
    expect(tooMany.status).toBe(413);
  });

  it('rejects blobs that are not ciphertext', async () => {
    await createEvent();
    for (const details of ['{"title":"Family Christmas"}', 'Family Christmas', 'short', 42, null]) {
      const response = await call('PUT', `/api/events/${EVENT_ID}`, { token: ORGANIZER_TOKEN, body: await eventBody({ details }) });
      expect(response.status).toBe(400);
    }
  });

  it('rejects malformed event IDs', async () => {
    expect((await call('PUT', '/api/events/short', { token: ORGANIZER_TOKEN, body: await eventBody() })).status).toBe(404);
    expect(kv.store.size).toBe(0);
  });
});

describe('events API: TTL', () => {
  it('stores every event entry with a 13-month TTL', async () => {
    await createEvent();
    expect([...kv.store.keys()].sort()).toEqual([
      `event:${EVENT_ID}:details`,
      `event:${EVENT_ID}:meta`,
      `event:${EVENT_ID}:roster`,
    ]);
    for (const entry of kv.store.values()) {
      expect(entry.expirationTtl).toBe(THIRTEEN_MONTHS);
    }
  });

  it('refreshes the TTL of every event entry on each organizer write', async () => {
    await createEvent();
    await call('PUT', `/api/events/${EVENT_ID}`, { token: ORGANIZER_TOKEN, body: await eventBody({ details: blob(70, 'N') }) });
    for (const entry of kv.store.values()) {
      expect(entry.writes).toBe(2);
      expect(entry.expirationTtl).toBe(THIRTEEN_MONTHS);
    }
  });

  it('does not refresh anything on reads or refused writes', async () => {
    await createEvent();
    await call('GET', `/api/events/${EVENT_ID}`);
    await call('PUT', `/api/events/${EVENT_ID}`, { token: OTHER_TOKEN, body: await eventBody({ details: blob(70, 'N') }) });
    for (const entry of kv.store.values()) {
      expect(entry.writes).toBe(1);
    }
  });

  it('keeps createdAt and moves updatedAt on update', async () => {
    await createEvent();
    const before = await (await call('GET', `/api/events/${EVENT_ID}`)).json();
    await new Promise(resolve => setTimeout(resolve, 5));
    await call('PUT', `/api/events/${EVENT_ID}`, { token: ORGANIZER_TOKEN, body: await eventBody({ details: blob(70, 'N') }) });
    const after = await (await call('GET', `/api/events/${EVENT_ID}`)).json();
    expect(after.createdAt).toBe(before.createdAt);
    expect(after.updatedAt > before.updatedAt).toBe(true);
  });
});

describe('events API: delete', () => {
  it('removes every key of the event with the organizer token', async () => {
    await createEvent();
    // Entries later tickets add under the same prefix go too.
    await kv.put(`event:${EVENT_ID}:p:${P1}:wishlist`, blob());
    await kv.put(`event:${EVENT_ID}:p:${P2}:assignment`, blob());
    await kv.put('event:otherotherotherotherA:meta', '{}');

    const response = await call('DELETE', `/api/events/${EVENT_ID}`, { token: ORGANIZER_TOKEN });
    expect(response.status).toBe(204);
    expect([...kv.store.keys()]).toEqual(['event:otherotherotherotherA:meta']);
    expect((await call('GET', `/api/events/${EVENT_ID}`)).status).toBe(404);
  });

  it('refuses to delete with a wrong or missing token', async () => {
    await createEvent();
    expect((await call('DELETE', `/api/events/${EVENT_ID}`, { token: OTHER_TOKEN })).status).toBe(403);
    expect((await call('DELETE', `/api/events/${EVENT_ID}`)).status).toBe(401);
    expect(kv.store.size).toBe(3);
  });

  it('answers 404 when deleting an unknown event', async () => {
    expect((await call('DELETE', `/api/events/${EVENT_ID}`, { token: ORGANIZER_TOKEN })).status).toBe(404);
  });
});

describe('events API: assignments', () => {
  const assignmentPath = (pid: string) => `/api/events/${EVENT_ID}/participants/${pid}/assignment`;

  it('writes every giver\'s assignment with the organizer token and serves each one without auth', async () => {
    await createEvent();
    const response = await call('PUT', `/api/events/${EVENT_ID}/assignments`, {
      token: ORGANIZER_TOKEN,
      body: { assignments: { [P1]: blob(64, 'A'), [P2]: blob(64, 'B') } },
    });
    expect(response.status).toBe(200);
    expect(await (await call('GET', assignmentPath(P1))).json()).toMatchObject({ assignment: blob(64, 'A') });
    expect(await (await call('GET', assignmentPath(P2))).json()).toMatchObject({ assignment: blob(64, 'B') });
    expect(kv.store.get(`event:${EVENT_ID}:p:${P1}:assignment`)!.expirationTtl).toBe(THIRTEEN_MONTHS);
  });

  it('answers 404 for a giver with no assignment yet', async () => {
    await createEvent();
    expect((await call('GET', assignmentPath(P1))).status).toBe(404);
  });

  it('refuses assignment writes with a wrong or missing token', async () => {
    await createEvent();
    const body = { assignments: { [P1]: blob(64, 'A') } };
    expect((await call('PUT', `/api/events/${EVENT_ID}/assignments`, { token: OTHER_TOKEN, body })).status).toBe(403);
    expect((await call('PUT', `/api/events/${EVENT_ID}/assignments`, { body })).status).toBe(401);
    expect((await call('GET', assignmentPath(P1))).status).toBe(404);
  });

  it('refuses givers outside the roster and blobs that are not ciphertext', async () => {
    await createEvent();
    const stranger = 'p3p3p3p3p3p3p3p3p3p3p3';
    for (const assignments of [{ [stranger]: blob() }, { [P1]: 'not ciphertext' }, { [P1]: blob(MAX_BLOB_BYTES_PLUS_ONE) }]) {
      const response = await call('PUT', `/api/events/${EVENT_ID}/assignments`, { token: ORGANIZER_TOKEN, body: { assignments } });
      expect(response.status).toBeGreaterThanOrEqual(400);
    }
    expect((await call('GET', assignmentPath(P1))).status).toBe(404);
  });

  it('replaces the whole draw: a giver left out of a new draw loses the old assignment', async () => {
    await createEvent();
    const put = (assignments: Record<string, string>) =>
      call('PUT', `/api/events/${EVENT_ID}/assignments`, { token: ORGANIZER_TOKEN, body: { assignments } });
    await put({ [P1]: blob(64, 'A'), [P2]: blob(64, 'B') });
    await put({ [P1]: blob(64, 'C') });
    expect(await (await call('GET', assignmentPath(P1))).json()).toMatchObject({ assignment: blob(64, 'C') });
    expect((await call('GET', assignmentPath(P2))).status).toBe(404);
  });

  it('answers 404 for assignments of an unknown event', async () => {
    const response = await call('PUT', `/api/events/${EVENT_ID}/assignments`, {
      token: ORGANIZER_TOKEN,
      body: { assignments: { [P1]: blob() } },
    });
    expect(response.status).toBe(404);
    expect((await call('GET', assignmentPath(P1))).status).toBe(404);
  });
});

describe('events API: opened', () => {
  const assignmentPath = (pid: string) => `/api/events/${EVENT_ID}/participants/${pid}/assignment`;
  const openedPath = (pid: string) => `/api/events/${EVENT_ID}/participants/${pid}/opened`;
  const draw = (assignments: Record<string, string>) =>
    call('PUT', `/api/events/${EVENT_ID}/assignments`, { token: ORGANIZER_TOKEN, body: { assignments } });

  it('records openedAt when the giver opens their assignment with their own participant token', async () => {
    await createEvent();
    await draw({ [P1]: blob(64, 'A'), [P2]: blob(64, 'B') });
    expect((await (await call('GET', assignmentPath(P1))).json()).openedAt).toBeUndefined();

    const response = await call('POST', openedPath(P1), { token: 't1' });
    expect(response.status).toBe(200);
    const { openedAt } = await response.json();
    expect(Date.parse(openedAt)).not.toBeNaN();
    expect(await (await call('GET', assignmentPath(P1))).json()).toMatchObject({ assignment: blob(64, 'A'), openedAt });
    expect((await (await call('GET', assignmentPath(P2))).json()).openedAt).toBeUndefined();
  });

  it('refuses to mark opened with another participant\'s token, the organizer token, or no token', async () => {
    await createEvent();
    await draw({ [P1]: blob(64, 'A'), [P2]: blob(64, 'B') });
    expect((await call('POST', openedPath(P1), { token: 't2' })).status).toBe(403);
    expect((await call('POST', openedPath(P1), { token: ORGANIZER_TOKEN })).status).toBe(403);
    expect((await call('POST', openedPath(P1))).status).toBe(401);
    expect((await (await call('GET', assignmentPath(P1))).json()).openedAt).toBeUndefined();
  });

  it('answers 404 when there is no assignment to open', async () => {
    await createEvent();
    expect((await call('POST', openedPath(P1), { token: 't1' })).status).toBe(404);
  });

  it('a new draw that changes an assignment moves assignedAt past openedAt; an unchanged one keeps both', async () => {
    await createEvent();
    await draw({ [P1]: blob(64, 'A'), [P2]: blob(64, 'B') });
    await call('POST', openedPath(P1), { token: 't1' });
    await call('POST', openedPath(P2), { token: 't2' });
    const before = await (await call('GET', assignmentPath(P2))).json();
    await new Promise(resolve => setTimeout(resolve, 5));

    await draw({ [P1]: blob(64, 'C'), [P2]: blob(64, 'B') });
    const changed = await (await call('GET', assignmentPath(P1))).json();
    expect(Date.parse(changed.assignedAt)).toBeGreaterThan(Date.parse(changed.openedAt));
    expect(await (await call('GET', assignmentPath(P2))).json()).toEqual(before);
  });

  it('lists each participant\'s assignedAt and openedAt with the event, without auth', async () => {
    await createEvent();
    await draw({ [P1]: blob(64, 'A'), [P2]: blob(64, 'B') });
    await call('POST', openedPath(P1), { token: 't1' });
    const { status } = await (await call('GET', `/api/events/${EVENT_ID}`)).json();
    expect(Object.keys(status).sort()).toEqual([P1, P2].sort());
    expect(typeof status[P1].openedAt).toBe('string');
    expect(typeof status[P1].assignedAt).toBe('string');
    expect(status[P2].openedAt).toBeUndefined();
    expect(typeof status[P2].assignedAt).toBe('string');
  });

  it('lists an empty status before any draw', async () => {
    await createEvent();
    const { status } = await (await call('GET', `/api/events/${EVENT_ID}`)).json();
    expect(status).toEqual({ [P1]: {}, [P2]: {} });
  });

  it('stores only ciphertext and timestamps for assignments, and opening does not outlive the event', async () => {
    await createEvent();
    await draw({ [P1]: blob(64, 'A'), [P2]: blob(64, 'B') });
    await call('POST', openedPath(P1), { token: 't1' });
    const metaEntry = kv.store.get(`event:${EVENT_ID}:meta`)!;
    for (const [pid, value] of [[P1, blob(64, 'A')], [P2, blob(64, 'B')]]) {
      const entry = kv.store.get(`event:${EVENT_ID}:p:${pid}:assignment`)!;
      expect(entry.value).toBe(value);
      for (const [field, stamp] of Object.entries(entry.metadata as Record<string, unknown>)) {
        expect(['assignedAt', 'openedAt']).toContain(field);
        expect(Date.parse(stamp as string)).not.toBeNaN();
      }
    }
    // A participant write must not extend the entry beyond the event's own expiry.
    const opened = kv.store.get(`event:${EVENT_ID}:p:${P1}:assignment`)!;
    const updatedAt = JSON.parse(metaEntry.value).updatedAt;
    expect(opened.expiration).toBe(Math.floor(Date.parse(updatedAt) / 1000) + THIRTEEN_MONTHS);
  });
});

describe('events API: wishlists', () => {
  const wishlistPath = (pid: string) => `/api/events/${EVENT_ID}/participants/${pid}/wishlist`;
  const save = (pid: string, token: string | undefined, wishlist: unknown) =>
    call('PUT', wishlistPath(pid), { token, body: { wishlist } });

  it('saves a participant\'s wishlist with their own token and serves it without auth, with wishlistUpdatedAt', async () => {
    await createEvent();
    const response = await save(P1, 't1', blob(64, 'W'));
    expect(response.status).toBe(200);
    const { wishlistUpdatedAt } = await response.json();
    expect(Date.parse(wishlistUpdatedAt)).not.toBeNaN();
    expect(await (await call('GET', wishlistPath(P1))).json()).toEqual({ wishlist: blob(64, 'W'), wishlistUpdatedAt });
  });

  it('answers 404 for a participant with no wishlist yet', async () => {
    await createEvent();
    expect((await call('GET', wishlistPath(P1))).status).toBe(404);
  });

  it('refuses a wishlist write with another participant\'s token, the organizer token, or no token', async () => {
    await createEvent();
    expect((await save(P1, 't2', blob(64, 'W'))).status).toBe(403);
    expect((await save(P1, ORGANIZER_TOKEN, blob(64, 'W'))).status).toBe(403);
    expect((await save(P1, undefined, blob(64, 'W'))).status).toBe(401);
    expect((await call('GET', wishlistPath(P1))).status).toBe(404);
  });

  it('accepts a wishlist of exactly 16 KB, rejects one byte more and anything that is not ciphertext', async () => {
    await createEvent();
    expect((await save(P1, 't1', blob(16 * 1024))).status).toBe(200);
    expect((await save(P1, 't1', blob(MAX_BLOB_BYTES_PLUS_ONE))).status).toBe(413);
    for (const wishlist of ['{"items":[]}', 'Socks', 42, null]) {
      expect((await save(P1, 't1', wishlist)).status).toBe(400);
    }
    expect((await (await call('GET', wishlistPath(P1))).json()).wishlist).toBe(blob(16 * 1024));
  });

  it('moves wishlistUpdatedAt on every save and lists it in the event status, beside assignment timing', async () => {
    await createEvent();
    const first = (await (await save(P1, 't1', blob(64, 'W'))).json()).wishlistUpdatedAt;
    await new Promise(resolve => setTimeout(resolve, 5));
    const second = (await (await save(P1, 't1', blob(64, 'X'))).json()).wishlistUpdatedAt;
    expect(Date.parse(second)).toBeGreaterThan(Date.parse(first));
    await call('PUT', `/api/events/${EVENT_ID}/assignments`, { token: ORGANIZER_TOKEN, body: { assignments: { [P1]: blob(64, 'A'), [P2]: blob(64, 'B') } } });

    const { status } = await (await call('GET', `/api/events/${EVENT_ID}`)).json();
    expect(status[P1].wishlistUpdatedAt).toBe(second);
    expect(typeof status[P1].assignedAt).toBe('string');
    expect(status[P2].wishlistUpdatedAt).toBeUndefined();
  });

  it('stores only the ciphertext and a timestamp, without outliving the event', async () => {
    await createEvent();
    await save(P1, 't1', blob(64, 'W'));
    const entry = kv.store.get(`event:${EVENT_ID}:p:${P1}:wishlist`)!;
    expect(entry.value).toBe(blob(64, 'W'));
    expect(Object.keys(entry.metadata as object)).toEqual(['wishlistUpdatedAt']);
    const updatedAt = JSON.parse(kv.store.get(`event:${EVENT_ID}:meta`)!.value).updatedAt;
    expect(entry.expiration).toBe(Math.floor(Date.parse(updatedAt) / 1000) + THIRTEEN_MONTHS);
  });

  it('answers 404 for wishlists of an unknown event', async () => {
    expect((await save(P1, 't1', blob(64, 'W'))).status).toBe(404);
    expect((await call('GET', wishlistPath(P1))).status).toBe(404);
  });
});

describe('events API: status listing', () => {
  it('lists every participant\'s wishlistUpdatedAt and openedAt with the event, in one call', async () => {
    await createEvent();
    const saved = await (await call('PUT', `/api/events/${EVENT_ID}/participants/${P2}/wishlist`, { token: 't2', body: { wishlist: blob(64, 'W') } })).json();
    await call('PUT', `/api/events/${EVENT_ID}/assignments`, { token: ORGANIZER_TOKEN, body: { assignments: { [P1]: blob(64, 'A'), [P2]: blob(64, 'B') } } });
    const opened = await (await call('POST', `/api/events/${EVENT_ID}/participants/${P1}/opened`, { token: 't1' })).json();

    const response = await call('GET', `/api/events/${EVENT_ID}`);
    expect(response.status).toBe(200);
    const { status } = await response.json();
    expect(Object.keys(status).sort()).toEqual([P1, P2].sort());
    expect(status[P1].openedAt).toBe(opened.openedAt);
    expect(status[P1].wishlistUpdatedAt).toBeUndefined();
    expect(status[P2].wishlistUpdatedAt).toBe(saved.wishlistUpdatedAt);
    expect(status[P2].openedAt).toBeUndefined();
  });

  it('serves no route for details, roster or status on their own', async () => {
    await createEvent();
    for (const sub of ['details', 'roster', 'status']) {
      expect((await call('GET', `/api/events/${EVENT_ID}/${sub}`, { token: ORGANIZER_TOKEN })).status).toBe(404);
      expect((await call('PUT', `/api/events/${EVENT_ID}/${sub}`, { token: ORGANIZER_TOKEN, body: { [sub]: blob() } })).status).toBe(404);
    }
  });
});
