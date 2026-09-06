# BeeGreat public profiles

> This is an independent project and is not affiliated with, endorsed by, sponsored by, or maintained by Aerodrome Finance, Velodrome Finance, Dromos Labs, or Mellow Protocol. References to their names and protocols describe compatibility or source attribution only. All trademarks belong to their respective owners. Third-party code remains subject to its applicable licenses.

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
