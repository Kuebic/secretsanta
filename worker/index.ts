import { handleEvents } from './events';

// Minimal structural types for the bindings this Worker uses, so the
// handler typechecks without pulling in @cloudflare/workers-types.
export interface AssetsBinding {
  fetch(request: Request): Promise<Response>;
}

export interface KVNamespaceLike {
  get(key: string): Promise<string | null>;
  getWithMetadata(key: string): Promise<{ value: string | null; metadata: unknown }>;
  put(key: string, value: string, options?: { expirationTtl?: number; expiration?: number; metadata?: unknown }): Promise<void>;
  delete(key: string): Promise<void>;
  list(options?: { prefix?: string; cursor?: string }): Promise<{
    keys: { name: string; metadata?: unknown }[];
    list_complete: boolean;
    cursor?: string;
  }>;
}

export interface Env {
  ASSETS: AssetsBinding;
  EVENTS: KVNamespaceLike;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

async function handleApi(request: Request, url: URL, env: Env): Promise<Response> {
  if (url.pathname === '/api/health' && request.method === 'GET') {
    return json({ ok: true });
  }
  const [, , collection, ...rest] = url.pathname.split('/');
  if (collection === 'events') {
    return handleEvents(request, env, rest);
  }
  return json({ error: 'not_found' }, 404);
}

// SPA fallback: a page navigation to a path with no file behind it (app
// routes such as /o/<id> or legacy /pairing?from=&to= links) gets the app shell (index.html, served at /)
// and react-router takes over. Missing scripts, images etc. stay 404.
async function serveAsset(request: Request, url: URL, env: Env): Promise<Response> {
  const response = await env.ASSETS.fetch(request);
  const isNavigation = request.method === 'GET' && (request.headers.get('accept') ?? '').includes('text/html');
  if (response.status !== 404 || !isNavigation) {
    return response;
  }
  return env.ASSETS.fetch(new Request(new URL('/', url.origin), { headers: request.headers }));
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/api' || url.pathname.startsWith('/api/')) {
      return handleApi(request, url, env);
    }
    return serveAsset(request, url, env);
  },
};
