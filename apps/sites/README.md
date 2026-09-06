# Bee Sites

> This is an independent project and is not affiliated with, endorsed by, sponsored by, or maintained by Aerodrome Finance, Velodrome Finance, Dromos Labs, or Mellow Protocol. References to their names and protocols describe compatibility or source attribution only. All trademarks belong to their respective owners. Third-party code remains subject to its applicable licenses.

This Cloudflare Worker serves versioned static Astro output from the shared
`beegreat-sites` R2 bucket. Live slugs and preview versions are resolved through
Convex, so unpublishing or deleting a site takes effect immediately.

Local setup:

```sh
cp apps/sites/.dev.vars.example apps/sites/.dev.vars
bun run sites
```

One-time Cloudflare setup and deployment:

```sh
bunx wrangler r2 bucket create beegreat-sites
bunx wrangler secret put CONVEX_URL --config apps/sites/wrangler.jsonc
bun run sites:deploy
```

The agent Worker uses the same bucket and builds Astro in its Cloudflare
Sandbox container. Before deploying it, configure the existing Convex and
broker secrets documented in `packages/agent/.env.example`; `wrangler.jsonc`
provides the Sandbox, container, and R2 bindings.

The public Worker is routed at `sites.buddytools.org/*` on the proxied
`buddytools.org` zone. Production pages receive a strict no-script CSP; preview
pages additionally receive `noindex` and `no-store` headers.
