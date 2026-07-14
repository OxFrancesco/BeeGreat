# BeeDocs

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
