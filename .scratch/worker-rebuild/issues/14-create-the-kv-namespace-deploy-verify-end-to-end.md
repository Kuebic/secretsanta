# 14: create the KV namespace, deploy, verify end to end

**What to build:** Organizer-side steps no agent can do: Cloudflare login and a real deploy.

**Blocked by:** 03, 04, 07, 08, 11, 12

**Status:** human

**GitHub:** Kuebic/secretsanta#14

- [x] `npx wrangler kv namespace create EVENTS` on the personal account; paste the id into wrangler config
- [x] `npm run deploy` succeeds; app loads on the workers.dev URL
- [ ] Create an event, open the organizer link on a phone, open a participant link, confirm identity, fill a wishlist, draw, reveal
- [ ] Add a Cloudflare rate-limiting rule on `/api/*` writes
- [ ] Legacy `/pairing?from=&to=` link still works on the new host

## Comments

2026-11-09: namespace `cf65a224cd7749559205f18325a2c8b9` created and bound; deployed to https://secretsanta.menningkenei.workers.dev. Health, SPA fallback, legacy link and 404 on an unknown event checked with curl. The first create attempt failed with a 401 (code 10000) that went away on retry after `wrangler whoami` refreshed the OAuth token. Left for a person: the end-to-end walkthrough in a browser and the rate-limit rule.
