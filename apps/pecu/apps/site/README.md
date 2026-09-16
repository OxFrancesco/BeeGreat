# Pecu domain routes

`pecu-app` owns the `pecu.app` custom domain in Francesco's personal Cloudflare account.

| Path | Destination |
| --- | --- |
| `/` | Pecu homepage |
| `/aero/cli` | Existing `aero-cli-site` landing page |
| `/aero/cli/docs` | Documentation generated from the pinned Aero SDK README |
| `/aero/stocks` and `/aero/stocks/*` | Existing `aero-stocks` app and API |
| `/agent` and `/agent/*` | Browser conversation with the Pecu agent, served by the `aero-stocks` Worker |
| `/chat` and `/chat/*` | Permanent 308 redirect to `/agent` |
| `/stocks` and `/stocks/*` | Permanent 308 redirect to `/aero/stocks`, preserving suffix, query, and method |
| `/assets/*` | Stocks build assets |

The gateway calls the existing Workers through service bindings. It preserves the stocks request URL and Origin header for authentication and same-origin validation. CLI assets, links, social metadata, and the scene model URL are rewritten under `/aero/cli`. Existing `aerocli.buddytools.org` routes stay deployed.

The homepage is a static page in `site/`. Its tokens (the shadcn amber-minimal theme), type, motion and mascot rules are in `../../docs/design-system.md`. Mascot clips under `site/pecu-assets/mascot/` are encoded with alpha from `output/blender/pecu-mascot-v2`; the reveal runs full width above the tagline and falls back to a still poster under reduced motion or without an alpha-capable codec. `/favicon.ico` and `/apple-touch-icon.png` are served from `site/pecu-assets/`.

Run `bunx wrangler deploy` from this directory. Its build step regenerates documentation from the Aero SDK revision in `apps/pecu/package.json`. Run `bunx tsc --noEmit -p apps/pecu/apps/site/tsconfig.json` from the repository root to check types.


This is an independent project and is not affiliated with, endorsed by, sponsored by, or maintained by Aerodrome Finance, Velodrome Finance, Dromos Labs, or Mellow Protocol. References to their names and protocols describe compatibility or source attribution only. All trademarks belong to their respective owners. Third-party code remains subject to its applicable licenses.
