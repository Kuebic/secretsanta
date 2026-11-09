# 14: create the KV namespace, deploy, verify end to end

**What to build:** Organizer-side steps no agent can do: Cloudflare login and a real deploy.

**Blocked by:** 03, 04, 07, 08, 11, 12

**Status:** human

**GitHub:** Kuebic/secretsanta#14

- [ ] `npx wrangler kv namespace create EVENTS` on the personal account; paste the id into wrangler config
- [ ] `npm run deploy` succeeds; app loads on the workers.dev URL
- [ ] Create an event, open the organizer link on a phone, open a participant link, confirm identity, fill a wishlist, draw, reveal
- [ ] Add a Cloudflare rate-limiting rule on `/api/*` writes
- [ ] Legacy `/pairing?from=&to=` link still works on the new host
