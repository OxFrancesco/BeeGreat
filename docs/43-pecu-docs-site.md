# Pecu docs site

`pecu.app/docs` documents three products in one place: Pecu, the Aero SDK with
its `aero` CLI and TUI, and evmSDK. The pages are Markdown files under
`apps/pecu/apps/site/docs/<product>/`. `scripts/build-docs-site.ts` turns them
into static HTML during the Pecu site build.

## What users see

- `/docs` links to each product and its most used pages.
- Each page has a page rail, the article, an outline and previous/next links.
  Narrow screens move the rail into a drawer and the outline into a
  disclosure.
- Search covers every heading and paragraph. It opens from the header, `/` or
  Cmd/Ctrl+K, and loads `/docs/search.json` on first use.
- Code blocks are highlighted at build time and have a copy button.
- The homepage, its footer and both SDK landing pages link to the docs.
  `/un-aerosdk/docs`, which rendered the pinned Aero README, now redirects to
  `/docs/aero`. The analytics page path groups docs views by product.

## Content rules

`apps/pecu/apps/site/docs/README.md` defines the frontmatter, Markdown subset
and writing rules. The build rejects H1s, headings below `###`, em and en
dashes, curly quotes, raw HTML and unlabeled code blocks. It also rejects links
to missing docs pages or headings. Pages must be checked against source, not
package READMEs. Pecu pages leave out operator details.

The Aero and evmSDK pages describe the current `packages/sugar` and
`packages/evm` source, which the standalone repositories mirror. Pecu's own
`/aero` commands use its pinned Aero revision, and the Pecu pages describe
those commands separately.

## Checks

```sh
bun run --cwd apps/pecu design:check
bun test apps/pecu/tests/docs-site.test.ts
bun run --cwd apps/pecu/apps/site build
```

`design:check` covers `docs.css`. The docs test covers the content rules, a
fixture build, link failures and the gateway routes.

## Surfaces

This is a web change on the Pecu site. The Pecu bot, Bee clients, CLI,
iMessage, voice, providers and backend contracts do not change. Deploying
needs only the `pecu-app` gateway Worker.
