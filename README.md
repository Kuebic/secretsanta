# Secret Santa

<img align="right" height="160" src="https://user-images.githubusercontent.com/1037931/87014534-92e21280-c1cc-11ea-9675-5f2c0f3c287f.png"/>

Check it live on [mael.dev/secretsanta/](https://mael.dev/secretsanta/) 🎄

Should you appreciate this tool so much that you'd like to thank me, you can either drop a friendly note in this repository's issues, or be a [one-time sponsor](https://github.com/sponsors/arcanis?frequency=one-time&sponsor=arcanis). Either would make my day 😊

<br/>

## Hosting

This fork runs as one Cloudflare Worker that serves the built app and the `/api/*` endpoints from the same origin (see `docs/adr/0001-single-worker-serves-app-and-api.md`). Config lives in `wrangler.jsonc`; the Worker code is in `worker/`.

### Local dev

```sh
npm install
npm run dev          # Vite dev server, app only (no /api)
npm run dev:worker   # builds, then `wrangler dev` serves the build and the API with local KV
npm test             # Vitest, including the Worker fetch handler
npm run typecheck
```

`npm run dev:worker` listens on http://localhost:8787; `curl localhost:8787/api/health` should return `{"ok":true}`. Rebuild (re-run the script) after changing the app.

### Deploy

Deploys run from the organizer's machine. There is no API token for this account, so log in once with OAuth:

```sh
npx wrangler login
npm run deploy       # vite build, then wrangler deploy
```

### KV setup (one time)

The Worker stores events in a KV namespace bound as `EVENTS`. `wrangler.jsonc` ships with a placeholder id until it exists. Create it and paste the printed id into the `EVENTS` entry of `kv_namespaces`:

```sh
npx wrangler kv namespace create EVENTS
```

Local dev and tests never touch the real namespace.

### Legacy links

Links from the static version (`/pairing?from=…&to=…`) keep working on the Worker: unknown page paths fall back to the app, which decrypts them as before.


## License (MIT)

> **Copyright © 2015 Maël Nison**
>
> Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
>
> The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
>
> THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
