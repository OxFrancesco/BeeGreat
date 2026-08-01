# BeeGreat public profiles

One Astro application renders every published BeeGreat profile from the shared
Convex deployment. It runs on Cloudflare Workers; users do not receive separate
deployments.

For local development, copy `.dev.vars.example` to `.dev.vars` and set the
shared `CONVEX_URL`, then run from the repository root:

```sh
bun run profile
```

Production requires the same Worker variable:

```sh
bunx wrangler secret put CONVEX_URL --config apps/profile/wrangler.jsonc
bun run profile:deploy
```

The Worker is routed at `bee.buddytools.org/*` on the existing proxied
`buddytools.org` zone, with TLS handled by Cloudflare.
Human-readable links use `/@handle`; permanent QR destinations use
`/p/:publicId`.
