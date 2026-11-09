---
status: accepted
---
# One Cloudflare Worker serves the app and the API

The upstream project is a static site on GitHub Pages with no backend. Wishlists, stable participant links and fill-in status need server storage. We serve the built app as Worker static assets and the API from the same Worker, replacing the GitHub Pages deploy. One origin means no CORS, one deploy pipeline, and the free tier covers expected traffic.

## Considered Options

- Keep GitHub Pages and add a separate Worker on another origin. Rejected: CORS, two deploys, two places for config.
- Keep a static-only mode alongside the Worker mode. Rejected: every feature would need two implementations. Legacy `?from&to` links continue to decrypt.
