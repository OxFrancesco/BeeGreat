import { readdir, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { createCssVariablesTheme, createHighlighter } from "shiki";

const site = resolve(import.meta.dir, "..");

type ProductId = "pecu" | "aero" | "evm";
type Product = { id: ProductId; name: string; source?: { label: string; href: string } };
type Heading = { level: 2 | 3; id: string; text: string };
type Page = {
  product: Product;
  slug: string;
  url: string;
  file: string;
  title: string;
  description: string;
  group: string;
  html: string;
  headings: Heading[];
};

export const products: Product[] = [
  { id: "pecu", name: "Pecu" },
  { id: "aero", name: "Aero", source: { label: "Aero SDK on GitHub", href: "https://github.com/OxFrancesco/UNOFFICIAL-Aero-SDK" } },
  { id: "evm", name: "evmSDK", source: { label: "evmSDK on GitHub", href: "https://github.com/OxFrancesco/evmSDK" } },
];

const escape = (value: string) =>
  value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
const decode = (value: string) =>
  value
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&amp;", "&");
const stripTags = (html: string) => decode(html.replace(/<[^>]+>/g, ""));
export const slugify = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const svg = (body: string, className = "icon") =>
  `<svg class="${className}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
const icons = {
  search: svg('<path d="m21 21-4.34-4.34"/><circle cx="11" cy="11" r="8"/>'),
  menu: svg('<path d="M4 5h16"/><path d="M4 12h16"/><path d="M4 19h16"/>'),
  close: svg('<path d="M18 6 6 18"/><path d="m6 6 12 12"/>'),
  copy: svg('<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>', "icon icon-copy"),
  check: svg('<path d="M20 6 9 17l-5-5"/>', "icon icon-check"),
  note: svg('<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>'),
  tip: svg('<path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/>'),
  warning: svg('<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>'),
  previous: svg('<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>'),
  next: svg('<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>'),
  chevron: svg('<path d="m6 9 6 6 6-6"/>', "icon icon-chevron"),
  enter: svg('<path d="M20 4v7a4 4 0 0 1-4 4H4"/><path d="m9 10-5 5 5 5"/>'),
};

function parseFrontmatter(file: string, text: string) {
  const match = text.match(/^---\n([\s\S]*?)\n---\n/);
  if (!match) throw new Error(`${file}: missing frontmatter`);
  const meta: Record<string, string> = {};
  for (const line of match[1]!.split("\n")) {
    const colon = line.indexOf(":");
    if (colon < 1) continue;
    meta[line.slice(0, colon).trim()] = line.slice(colon + 1).trim().replace(/^(["'])(.*)\1$/, "$2");
  }
  for (const key of ["title", "description", "group"]) if (!meta[key]) throw new Error(`${file}: frontmatter needs ${key}`);
  return { meta, body: text.slice(match[0].length) };
}

export function lintMarkdown(body: string): string[] {
  const prose = body.replace(/^(`{3,})[^\n]*\n[\s\S]*?^\1\s*$/gm, "");
  const problems: string[] = [];
  if (/^#\s/m.test(prose)) problems.push("remove the H1; the build adds it from the title");
  if (/^#{4,}\s/m.test(prose)) problems.push("use ## and ### headings only");
  if (/[\u2013\u2014]/.test(body)) problems.push("replace em and en dashes with periods or commas");
  if (/[\u201c\u201d\u2018\u2019]/.test(body)) problems.push("use straight quotes");
  if (/<\/?[a-z][\w-]*(\s[^>]*)?>/i.test(prose.replace(/`[^`\n]*`/g, "").replace(/<https?:[^>]+>/g, "")))
    problems.push("remove raw HTML");
  let open = false;
  for (const line of body.split("\n")) {
    const fence = line.match(/^```(\S*)/);
    if (!fence) continue;
    if (!open && !fence[1]) problems.push("give every code block a language");
    open = !open;
  }
  return [...new Set(problems)];
}

const languages = new Map<string, string>(Object.entries({
  sh: "bash", bash: "bash", shell: "bash", zsh: "bash", console: "bash",
  ts: "typescript", typescript: "typescript", tsx: "tsx", js: "javascript", javascript: "javascript",
  json: "json", jsonc: "jsonc", yaml: "yaml", yml: "yaml", toml: "toml", diff: "diff",
  text: "text", txt: "text", plain: "text",
}));
const highlighter = await createHighlighter({
  themes: [createCssVariablesTheme({ name: "pecu", variablePrefix: "--shiki-", fontStyle: true })],
  langs: ["bash", "typescript", "tsx", "javascript", "json", "jsonc", "yaml", "toml", "diff"],
});
const highlight = (code: string, lang: string) =>
  highlighter.codeToHtml(code, { lang: languages.get(lang) ?? "text", theme: "pecu" }).replace(/^<pre class="shiki pecu"[^>]*>/, '<pre tabindex="0">');

const calloutIcons = { NOTE: icons.note, TIP: icons.tip, WARNING: icons.warning };
const calloutLabels = { NOTE: "Note", TIP: "Tip", WARNING: "Warning" } as const;

function renderMarkdown(body: string) {
  const headings: Heading[] = [];
  const seen = new Map<string, number>();
  const html = Bun.markdown
    .html(body)
    .replace(/<pre><code(?: class="language-([\w-]+)")?>([\s\S]*?)<\/code><\/pre>/g, (_, lang = "text", code: string) =>
      `<div class="code-block">${highlight(decode(code).replace(/\n$/, ""), lang)}<button class="copy-code" type="button" aria-label="Copy code">${icons.copy}${icons.check}</button></div>`,
    )
    .replace(/<blockquote>\s*<p>\[!(NOTE|TIP|WARNING)\]\s*([\s\S]*?)<\/blockquote>/g, (_, kind: keyof typeof calloutLabels, inner: string) =>
      `<aside class="callout callout-${kind.toLowerCase()}"><p class="callout-title">${calloutIcons[kind]}${calloutLabels[kind]}</p><p>${inner}</aside>`.replace(/<p>\s*<\/p>/g, ""),
    )
    .replace(/<h([23])>([\s\S]*?)<\/h\1>/g, (_, level: string, inner: string) => {
      const text = stripTags(inner).trim();
      const base = slugify(text) || "section";
      const count = seen.get(base) ?? 0;
      seen.set(base, count + 1);
      const id = count ? `${base}-${count + 1}` : base;
      headings.push({ level: level === "2" ? 2 : 3, id, text });
      return `<h${level} id="${id}">${inner}<a class="anchor" href="#${id}" aria-label="Link to ${escape(text)}">#</a></h${level}>`;
    })
    .replace(/<code>([^<]{1,40})<\/code>/g, '<code class="nowrap">$1</code>')
    .replace(/<table>/g, '<div class="table-wrap" tabindex="0" role="region" aria-label="Table"><table>')
    .replace(/<\/table>/g, "</table></div>");
  return { html, headings };
}

async function loadPages(sourceDir: string): Promise<Page[]> {
  const pages: Page[] = [];
  const problems: string[] = [];
  for (const product of products) {
    const files = (await readdir(resolve(sourceDir, product.id)).catch((): string[] => []))
      .filter((file) => /^\d{2}-[a-z0-9-]+\.md$/.test(file))
      .sort();
    for (const file of files) {
      const path = `${product.id}/${file}`;
      const { meta, body } = parseFrontmatter(path, await Bun.file(resolve(sourceDir, path)).text());
      problems.push(...lintMarkdown(body).map((problem) => `${path}: ${problem}`));
      const slug = file.slice(3, -3);
      const { html, headings } = renderMarkdown(body);
      pages.push({
        product,
        slug,
        url: slug === "overview" ? `/docs/${product.id}` : `/docs/${product.id}/${slug}`,
        file: path,
        title: meta.title!,
        description: meta.description!,
        group: meta.group!,
        html,
        headings,
      });
    }
    if (files.length && !pages.some((page) => page.product === product && page.slug === "overview"))
      problems.push(`${product.id}/: add an NN-overview.md page for the product root`);
  }
  if (problems.length) throw new Error(`Docs content problems:\n${problems.join("\n")}`);
  return pages;
}

function checkLinks(pages: Page[]) {
  const anchors = new Map(pages.map((page) => [page.url, new Set(page.headings.map((h) => h.id))]));
  anchors.set("/docs", new Set());
  const broken: string[] = [];
  for (const page of pages) {
    for (const [, target, hash] of page.html.matchAll(/href="((?:\/docs)[^"#]*)?(?:#([^"]*))?"/g)) {
      const path = (target ?? page.url).replace(/\/$/, "");
      const ids = anchors.get(path);
      if (!ids) broken.push(`${page.file}: ${target}${hash ? `#${hash}` : ""} is not a docs page`);
      else if (hash && !ids.has(hash) && !(target === undefined && page.headings.some((h) => h.id === hash)))
        broken.push(`${page.file}: ${path}#${hash} has no matching heading`);
    }
  }
  if (broken.length) throw new Error(`Broken docs links:\n${broken.join("\n")}`);
}

const footer = `<footer class="docs-footer"><div class="docs-footer-inner"><p><strong>Experimental. Unofficial.</strong> Pecu, Aero and evmSDK are early software built with AI coding agents. Transactions on Base are real, and a wrong amount, address or approval can lose funds for good. Start with reads, keep amounts small and check every preview yourself.</p><p>This is an independent project and is not affiliated with, endorsed by, sponsored by, or maintained by Aerodrome Finance, Velodrome Finance, Dromos Labs, or Mellow Protocol. References to their names and protocols describe compatibility or source attribution only. All trademarks belong to their respective owners. Third-party code remains subject to its applicable licenses.</p><nav aria-label="Footer"><a href="/">Pecu home</a><a href="/agent">Agent</a><a href="/design">Design</a><a href="https://github.com/OxFrancesco/UNOFFICIAL-Aero-SDK">Aero SDK on GitHub ↗</a><a href="https://github.com/OxFrancesco/evmSDK">evmSDK on GitHub ↗</a><a href="mailto:info@pecu.app">info@pecu.app</a></nav></div></footer>`;

function productSwitch(current?: ProductId) {
  return `<nav class="product-switch" aria-label="Products">${products
    .map((product) => `<a href="/docs/${product.id}"${product.id === current ? ' aria-current="true"' : ""}>${product.name}</a>`)
    .join("")}</nav>`;
}

function header(current: ProductId | undefined, navigation: boolean) {
  return `<header class="docs-header"><div class="docs-header-inner">${navigation ? `<button class="icon-button docs-menu" type="button" aria-label="Open navigation" aria-controls="docs-nav" aria-expanded="false">${icons.menu}</button>` : ""}<div class="docs-brand"><a class="wordmark" href="/" aria-label="Pecu home">pecu</a><span aria-hidden="true">/</span><a class="docs-home" href="/docs">docs</a></div>${productSwitch(current)}<button class="docs-search-trigger" type="button" aria-haspopup="dialog" aria-controls="docs-search">${icons.search}<span>Search</span><kbd>/</kbd></button></div></header>`;
}

const searchDialog = `<dialog id="docs-search" class="docs-search" aria-label="Search docs"><div class="search-field">${icons.search}<label class="sr-only" for="docs-search-input">Search docs</label><input id="docs-search-input" type="search" placeholder="Search docs" autocomplete="off" spellcheck="false" role="combobox" aria-expanded="false" aria-controls="docs-search-results" aria-autocomplete="list"><button class="icon-button search-close" type="button" aria-label="Close search">${icons.close}</button></div><ul id="docs-search-results" class="search-results" role="listbox" aria-label="Results"></ul><p class="search-empty" role="status" aria-live="polite"></p></dialog><div class="docs-live sr-only" role="status" aria-live="polite"></div>`;

function renderDocument({ title, description, url, body, current, scripts = [] }: { title: string; description: string; url: string; body: string; current?: ProductId; scripts?: string[] }) {
  return `<!doctype html><html lang="en" class="pecu-theme"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><meta name="theme-color" content="#ffffff"><meta name="darkreader-lock"><title>${escape(title)}</title><meta name="description" content="${escape(description)}"><link rel="canonical" href="https://pecu.app${url}"><meta property="og:type" content="website"><meta property="og:url" content="https://pecu.app${url}"><meta property="og:title" content="${escape(title)}"><meta property="og:description" content="${escape(description)}"><meta property="og:image" content="https://pecu.app/pecu-assets/og-reveal.jpg"><meta name="twitter:card" content="summary_large_image"><link rel="icon" href="/favicon.ico" sizes="48x48"><link rel="icon" href="/pecu-assets/icon-192.png" type="image/png" sizes="192x192"><link rel="apple-touch-icon" href="/apple-touch-icon.png" sizes="180x180"><link rel="stylesheet" href="/pecu-assets/style.css"><link rel="stylesheet" href="/pecu-assets/docs.css"><script defer src="/pecu-assets/docs.js"></script>${scripts.map((src) => `<script defer src="${src}"></script>`).join("")}</head><body class="docs-page"><script type="module" src="/pecu-assets/analytics.js"></script><a class="skip-link" href="#content">Skip to content</a>${header(current, body.includes('id="docs-nav"'))}${body}${footer}${searchDialog}</body></html>`;
}

function sidebar(pages: Page[], current: Page) {
  const groups = new Map<string, Page[]>();
  for (const page of pages) groups.set(page.group, [...(groups.get(page.group) ?? []), page]);
  return `<aside class="docs-sidebar" id="docs-nav" aria-label="Docs navigation"><div class="drawer-head"><div class="docs-brand"><a class="wordmark" href="/" aria-label="Pecu home">pecu</a><span aria-hidden="true">/</span><a class="docs-home" href="/docs">docs</a></div><button class="icon-button docs-menu-close" type="button" aria-label="Close navigation">${icons.close}</button></div>${productSwitch(current.product.id)}<nav aria-label="${escape(current.product.name)} pages">${[...groups]
    .map(([group, items]) => `<div class="nav-group"><p class="nav-group-title">${escape(group)}</p><ul>${items
      .map((page) => `<li><a href="${page.url}"${page === current ? ' aria-current="page"' : ""}>${escape(page.title)}</a></li>`)
      .join("")}</ul></div>`)
    .join("")}</nav>${current.product.source ? `<a class="nav-source" href="${current.product.source.href}">${escape(current.product.source.label)} ↗</a>` : ""}</aside><div class="docs-scrim"></div>`;
}

function toc(headings: Heading[]) {
  return `<ul>${headings.map((h) => `<li class="toc-h${h.level}"><a href="#${h.id}">${escape(h.text)}</a></li>`).join("")}</ul>`;
}

function pager(previous?: Page, next?: Page) {
  if (!previous && !next) return "";
  const card = (page: Page, direction: "previous" | "next") =>
    `<a class="pager-card pager-${direction}" href="${page.url}" rel="${direction === "previous" ? "prev" : "next"}"><span class="pager-label">${direction === "previous" ? `${icons.previous}Previous` : `Next${icons.next}`}</span><span class="pager-title">${escape(page.title)}</span></a>`;
  return `<nav class="docs-pager" aria-label="Previous and next pages">${previous ? card(previous, "previous") : "<span></span>"}${next ? card(next, "next") : ""}</nav>`;
}

function renderPage(page: Page, siblings: Page[]) {
  const index = siblings.indexOf(page);
  const outline = page.headings.length > 1;
  const body = `<div class="docs-layout${outline ? "" : " no-outline"}">${sidebar(siblings, page)}<main id="content" class="docs-main" tabindex="-1"><article class="docs-article"><h1>${escape(page.slug === "overview" ? page.product.name : page.title)}</h1><p class="docs-lead">${escape(page.description)}</p>${outline ? `<details class="toc-inline"><summary>On this page${icons.chevron}</summary><nav aria-label="On this page">${toc(page.headings)}</nav></details>` : ""}<div class="prose">${page.html}</div>${pager(siblings[index - 1], siblings[index + 1])}</article></main>${outline ? `<aside class="docs-toc"><nav aria-label="On this page">${toc(page.headings)}</nav></aside>` : ""}</div>`;
  const title = page.slug === "overview" ? `${page.product.name} docs | Pecu` : `${page.title} | ${page.product.name} docs`;
  return renderDocument({ title, description: page.description, url: page.url, body, current: page.product.id });
}

type Tile = { product: ProductId; subtitle?: string; text: string; visual: string; className: string; links: string[] };
const tiles: Tile[] = [
  {
    product: "pecu",
    className: "agent",
    text: "Message Pecu on X or use it at pecu.app/agent. Your first message creates a Base smart wallet for your X account. Reads answer at once. Anything that moves money comes back as a preview you confirm.",
    visual: `<div class="tile-visual" aria-hidden="true"><div class="snail"><img class="snail-still" src="/pecu-assets/mascot/idle.webp" width="960" height="720" alt=""></div><div class="chat"><div class="bubble you">/swap 0.01 ETH to USDC</div><div class="bubble bot"><b>Swap preview</b><span>0.01 ETH → at least <b class="num">24.61 USDC</b></span><span class="meta">Base · expires in 10 min</span><span class="code">Reply <em>confirm</em> or <em>/confirm K7Q2ZM</em></span></div></div></div>`,
    links: ["quickstart", "commands", "confirmations", "security"],
  },
  {
    product: "aero",
    subtitle: "SDK, CLI and TUI",
    className: "aero",
    text: "Aerodrome on Base from TypeScript or a terminal. The SDK returns reads and unsigned transactions. The CLI and TUI sign with a browser wallet, WalletConnect or an encrypted local wallet.",
    visual: `<div class="aero-screen" aria-hidden="true"><div class="aero-mark"><canvas></canvas></div><code class="cmd"><span>$</span>aero pools --pool-type cl --limit 5</code></div>`,
    links: ["install", "sdk-client", "cli-reference", "tui"],
  },
  {
    product: "evm",
    subtitle: "SDK, CLI, TUI and MCP",
    className: "evm",
    text: "Reads, unsigned plans and recoverable execution for Ethereum, Base and other EVM chains. The SDK, the evm CLI, the TUI and the MCP server share one command catalog.",
    visual: `<div class="tile-visual" aria-hidden="true"><div class="inspect"><span class="addr">evm discover</span><span class="line"><em>read</em> balance</span><span class="line"><em>plan</em> transfer</span><span class="line"><em>execute</em> <b class="num">--yolo</b></span></div></div>`,
    links: ["install", "conventions", "commands", "mcp"],
  },
];

function renderLanding(pages: Page[]) {
  const cards = tiles
    .map((tile, i) => {
      const product = products.find((p) => p.id === tile.product)!;
      const links = tile.links
        .map((slug) => pages.find((page) => page.product.id === tile.product && page.slug === slug))
        .filter((page): page is Page => Boolean(page))
        .map((page) => `<li><a href="${page.url}">${escape(page.title)}${icons.next}</a></li>`)
        .join("");
      return `<article class="card bento arriving docs-tile ${tile.className}" style="--i:${i}">${tile.visual}<div class="tile-copy"><h2><a href="/docs/${product.id}">${product.name}</a>${tile.subtitle ? ` <small>${tile.subtitle}</small>` : ""}</h2><p>${tile.text}</p>${links ? `<ul class="tile-links">${links}</ul>` : ""}</div></article>`;
    })
    .join("");
  const body = `<main id="content" class="docs-landing" tabindex="-1"><h1>Docs</h1><div class="docs-tiles">${cards}</div></main>`;
  return renderDocument({
    title: "Docs | Pecu",
    description: "Guides and references for Pecu, the Aero SDK, CLI and TUI, and evmSDK.",
    url: "/docs",
    body,
    scripts: ["/pecu-assets/aero-mark.js"],
  });
}

function renderNotFound() {
  const body = `<main id="content" class="docs-landing docs-missing" tabindex="-1"><h1>Page not found</h1><p>This docs page does not exist or has moved.</p><div class="actions"><a class="button primary" href="/docs">Go to the docs</a><button class="button" type="button" data-open-search>Search docs</button></div></main>`;
  return renderDocument({ title: "Page not found | Pecu docs", description: "This docs page does not exist.", url: "/docs", body });
}

function searchIndex(pages: Page[]) {
  const entries: { p: string; t: string; h: string; u: string; x: string }[] = [];
  for (const page of pages) {
    const parts = page.html.split(/(?=<h[23] id=")/);
    for (const part of parts) {
      const id = part.match(/^<h[23] id="([^"]+)"/)?.[1];
      const heading = id ? page.headings.find((h) => h.id === id)?.text ?? "" : "";
      const body = part.replace(/^<h[23][^>]*>[\s\S]*?<\/h[23]>/, "").replace(/<p class="callout-title">[\s\S]*?<\/p>/g, "").replace(/<\/?(p|li|td|th|tr|pre|div|aside|h[23])\b[^>]*>/g, " ");
      const text = stripTags(body).replace(/\s+/g, " ").trim();
      entries.push({ p: page.product.name, t: page.title, h: heading, u: id ? `${page.url}#${id}` : page.url, x: (id ? text : `${page.description} ${text}`).slice(0, 420) });
    }
  }
  return entries;
}

export async function buildDocsSite({ source = resolve(site, "docs"), output = resolve(site, "public/docs") } = {}) {
  const pages = await loadPages(source);
  checkLinks(pages);
  await rm(output, { recursive: true, force: true });
  const writes: Promise<number>[] = [];
  const write = (path: string, content: string) => writes.push(Bun.write(resolve(output, path), content));
  for (const product of products) {
    const siblings = pages.filter((page) => page.product === product);
    for (const page of siblings) write(`${page.url.slice("/docs/".length)}/index.html`, renderPage(page, siblings));
  }
  write("index.html", renderLanding(pages));
  write("404.html", renderNotFound());
  write("search.json", JSON.stringify(searchIndex(pages)));
  await Promise.all(writes);
  console.log(`Built ${pages.length} docs pages`);
}

if (import.meta.main) await buildDocsSite();
