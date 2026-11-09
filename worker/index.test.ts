import { describe, expect, it } from 'vitest';
import worker, { type Env } from './index';

const INDEX_HTML = '<!doctype html><div id="root"></div>';

// Stands in for the Workers static-assets binding: serves a fixed set of
// files and answers 404 for anything else, like the real binding does
// without not_found_handling.
function makeEnv(files: Record<string, string> = { '/': INDEX_HTML, '/assets/app.js': 'js' }): Env & { seen: string[] } {
  const seen: string[] = [];
  return {
    seen,
    ASSETS: {
      fetch: async (request: Request) => {
        const url = new URL(request.url);
        seen.push(url.pathname + url.search);
        const body = files[url.pathname];
        return body === undefined ? new Response('missing', { status: 404 }) : new Response(body, { status: 200 });
      },
    },
    EVENTS: {} as Env['EVENTS'],
  };
}

function navigate(path: string): Request {
  return new Request(`https://santa.test${path}`, { headers: { accept: 'text/html' } });
}

describe('worker fetch handler', () => {
  it('answers /api/health with JSON', async () => {
    const response = await worker.fetch(new Request('https://santa.test/api/health'), makeEnv());
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(await response.json()).toEqual({ ok: true });
  });

  it('answers unknown /api paths with a JSON 404 and never serves the app', async () => {
    const env = makeEnv();
    const response = await worker.fetch(navigate('/api/nope'), env);
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'not_found' });
    expect(env.seen).toEqual([]);
  });

  it('serves existing static assets as they are', async () => {
    const response = await worker.fetch(new Request('https://santa.test/assets/app.js'), makeEnv());
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('js');
  });

  it('serves the app for a legacy /pairing?from=&to= link so the assignment can decrypt', async () => {
    const response = await worker.fetch(navigate('/pairing?from=Alice&to=abc%2B%2F%3D'), makeEnv());
    expect(response.status).toBe(200);
    expect(await response.text()).toBe(INDEX_HTML);
  });

  it('serves the app for unknown app routes at the Worker root', async () => {
    const response = await worker.fetch(navigate('/o/someEventId'), makeEnv());
    expect(response.status).toBe(200);
    expect(await response.text()).toBe(INDEX_HTML);
  });

  it('keeps a 404 for missing files that are not page navigations', async () => {
    const response = await worker.fetch(new Request('https://santa.test/assets/gone.js'), makeEnv());
    expect(response.status).toBe(404);
  });
});
