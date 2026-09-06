# BeeDocs

> This is an independent project and is not affiliated with, endorsed by, sponsored by, or maintained by Aerodrome Finance, Velodrome Finance, Dromos Labs, or Mellow Protocol. References to their names and protocols describe compatibility or source attribution only. All trademarks belong to their respective owners. Third-party code remains subject to its applicable licenses.

The Astro documentation site for BeeGreat. It contains separate guides for people using BeeGreat and contributors working on the codebase.

## Commands

Run commands from the BeeGreat repository root:

```sh
bun run docs          # Start the local Astro server
bun run --cwd apps/beedocs build
bun run docs:deploy   # Build and deploy to Cloudflare Pages
```

The production site is [beedocs.pages.dev](https://beedocs.pages.dev/).

## Structure

- `src/layouts` — shared site and documentation layouts
- `src/pages/users` — current product guidance
- `src/pages/developers` — setup and architecture guidance
- `public/assets` — reused BeeGreat mobile assets

Product behavior must match the current app and canonical repository docs. Do not describe planned features as available.
