# Pecu domain routes

`pecu-app` owns the `pecu.app` custom domain in Francesco's personal Cloudflare account.

| Path | Destination |
| --- | --- |
| `/` | Pecu homepage |
| `/un-aerosdk` | Existing `aero-cli-site` landing page |
| `/docs` | Docs landing page with the three products |
| `/docs/pecu`, `/docs/aero`, `/docs/evm` and `/docs/<product>/<page>` | Docs pages built from `docs/` |
| `/docs/search.json` | Search index used by the docs search dialog |
| `/un-aerosdk/docs` and `/un-aerosdk/docs/*` | Permanent 308 redirect to `/docs/aero` |
| `/stocks` and `/stocks/*` | Existing `aero-stocks` app and API |
| `/agent` and `/agent/*` | Browser conversation with the Pecu agent, served by the `aero-stocks` Worker |
| `/chat` and `/chat/*` | Permanent 308 redirect to `/agent` |
| `/aero/stocks` and `/aero/stocks/*` | Permanent 308 redirect to `/stocks`, preserving suffix, query, and method |
| `/aero/cli` and `/aero/cli/*` | Permanent 308 redirect to `/un-aerosdk`, preserving suffix, query, and method |
| `/evmsdk` and `/evmsdk/*` | Existing `evm-sdk-site` landing page and assets |
| `/assets/*` | Stocks build assets |

The gateway calls the existing Workers through service bindings. It preserves the stocks request URL and Origin header for authentication and same-origin validation. SDK assets, links, and social metadata are rewritten under `/un-aerosdk` and `/evmsdk`, and both landing pages' GitHub README links point at `/docs/aero` and `/docs/evm`. The Aero scene model URL is also rewritten. Existing `aerocli.buddytools.org` routes stay deployed.

Docs pages are static. `scripts/build-docs-site.ts` renders the Markdown in `docs/` with Shiki highlighting, an outline per page and a search index. `docs/README.md` has the page format and writing rules. The build fails on content rule violations and on links to missing pages or headings. Unknown `/docs/*` paths return the docs 404 page with status 404.

The homepage is a static page in `site/`. Its tokens (the shadcn amber-minimal theme), type, motion and mascot rules are in `../../docs/design-system.md`. Mascot clips under `site/pecu-assets/mascot/` are encoded with alpha from `output/blender/pecu-mascot-v2`; the reveal runs full width above the tagline and falls back to a still poster under reduced motion or without an alpha-capable codec. `/favicon.ico` and `/apple-touch-icon.png` are served from `site/pecu-assets/`.

Run `bunx wrangler deploy` from this directory. Its build step regenerates the homepage assets, docs, design reference and Nansen showcase. Run `bunx tsc --noEmit -p apps/pecu/apps/site/tsconfig.json` from the repository root to check types.


This is an independent project and is not affiliated with, endorsed by, sponsored by, or maintained by Aerodrome Finance, Velodrome Finance, Dromos Labs, or Mellow Protocol. References to their names and protocols describe compatibility or source attribution only. All trademarks belong to their respective owners. Third-party code remains subject to its applicable licenses.
