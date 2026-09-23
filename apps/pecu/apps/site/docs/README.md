# Pecu docs source

`scripts/build-docs-site.ts` turns these Markdown files into the static pages
served at `pecu.app/docs`. Each product has its own folder:

| Folder | Product | URL |
| --- | --- | --- |
| `pecu/` | Pecu on X and in the browser | `/docs/pecu` |
| `aero/` | Aero SDK, `aero` CLI and TUI | `/docs/aero` |
| `evm/` | evmSDK, `evm` CLI, TUI and MCP server | `/docs/evm` |

## Files

One page per file, named `NN-slug.md`. The two-digit prefix sets the sidebar
order. The page URL is `/docs/<product>/<slug>`. The `overview` page is the
product root, `/docs/<product>`.

Every file starts with frontmatter:

```md
---
title: Quickstart
description: One plain sentence, used as the page lead and the meta description.
group: Start
---
```

`title` is the sidebar label and the page heading, so keep it to one to four
words. `group` is the sidebar section. Groups appear in the order of their
first page.

## Markdown

- Do not write an H1. The build adds it from `title`.
- Use `##` for sections and `###` for subsections. Both appear in the page
  outline. Do not go deeper than `###`.
- Headings use sentence case and stay unique within a page. Their anchor is
  the lowercase text with other characters collapsed to `-`.
- Fenced code blocks need a language: `sh`, `ts`, `json` or `text`. Terminal
  commands use `sh` with no `$` prompt. Pecu chat messages use `text`.
- Callouts use GitHub alert syntax, at most two per page:

  ```md
  > [!WARNING]
  > Transactions on Base are real.
  ```

  `NOTE`, `TIP` and `WARNING` are supported. Keep `WARNING` for fund-loss risk.
- Link other pages with absolute paths such as `/docs/aero/cli-reference` or
  `/docs/evm#install`.
- No raw HTML, images or emoji.
- Placeholders: `0xRECIPIENT`, `0xTOKEN`, `0xPOOL`, `0xOWNER`, `0xSPENDER`,
  `0xYOUR_ADDRESS`, `PLAN_ID`, `ABC123`, and position `123`.

The site footer carries the experimental warning and the non-affiliation
notice on every page. Do not repeat them on each page.

## Writing

Write for someone about to run the command. Say what it does, what it returns
and what can go wrong, with real flag names, defaults and limits.

- Use plain words, active voice and "you".
- No em or en dashes. Use periods and commas.
- Use colons only before a list or code.
- No marketing copy, filler introductions or closing summaries.
- Bold sparingly. No "**Label:** text" lists.
- Straight quotes only.

## Accuracy

Check every command, flag, environment variable, default and method name
against the source, not only the package README. When they disagree, the
source wins. Leave out anything you cannot verify. Do not invent package
names, versions, URLs, fees, limits or chain support.

Pecu pages are for people using Pecu. Keep operator details out: deployment
steps, secrets, admin routes, Worker and Durable Object names, account IDs and
wallet owner strings.

Run `bun run --cwd apps/pecu/apps/site build` after editing to regenerate the
pages.
