# 03: Hosting: serve app and API from one Cloudflare Worker

**What to build:** The app is served from a single Cloudflare Worker (static assets + API on one origin) instead of GitHub Pages. A health endpoint proves the API path works. Deploys run from the organizer's machine with `npm run deploy` (wrangler, logged in via OAuth; no API token exists for this account). Existing `/pairing?from=&to=` links keep decrypting.

See ADR 0001.

**Blocked by:** None (can start immediately)

**Status:** resolved

**GitHub:** Kuebic/secretsanta#3

- [x] `worker/` directory with a plain fetch handler: `/api/health` returns JSON, everything else falls through to static assets with SPA fallback
- [x] wrangler config: Worker name `secretsanta`, account id taken from sibling repos, Vite build output as assets, a KV binding named `EVENTS` with a placeholder id and a comment pointing at the human ticket
- [x] Vite `base` is `/`; app routes work at the Worker root
- [x] `npm run deploy` builds then runs `wrangler deploy`; `npm run dev:worker` runs `wrangler dev` against the build
- [x] GitHub Pages workflow removed
- [x] README documents local dev, deploy, and the KV setup step
- [x] A legacy `/pairing?from=&to=` link still shows the assignment
- [x] Worker route logic has a Vitest test calling the fetch handler directly
