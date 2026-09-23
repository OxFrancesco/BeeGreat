import { describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildDocsSite, lintMarkdown } from "../apps/site/scripts/build-docs-site";
import gateway from "../apps/site/worker";

const page = (title: string, body: string, group = "Start") => `---\ntitle: ${title}\ndescription: ${title} page.\ngroup: ${group}\n---\n\n${body}\n`;

async function fixture(files: Record<string, string>) {
  const root = await mkdtemp(join(tmpdir(), "pecu-docs-"));
  for (const [path, content] of Object.entries(files)) await Bun.write(join(root, "source", path), content);
  return { root, source: join(root, "source"), output: join(root, "output") };
}

describe("docs content rules", () => {
  test("accepts headings, code comments and angle brackets in inline code", () => {
    expect(lintMarkdown("## Run\n\nUse `--position-id <id>`.\n\n```sh\n# list pools\naero pools\n```\n")).toEqual([]);
  });

  test("rejects an H1, deep headings, dashes, curly quotes, HTML and unlabeled code", () => {
    const problems = lintMarkdown("# Title\n\n#### Deep\n\nA \u2014 dash and \u201cquotes\u201d.\n\n<div>html</div>\n\n```\ncode\n```\n");
    expect(problems).toHaveLength(6);
  });
});

describe("docs build", () => {
  test("renders pages, outline, callouts, highlighted code and a search index", async () => {
    const { root, source, output } = await fixture({
      "aero/01-overview.md": page("Overview", "## Run a read\n\n> [!WARNING]\n> Funds are real.\n\n```sh\naero pools --limit 5\n```\n\n| Flag | Meaning |\n| --- | --- |\n| `--limit` | Rows |\n\nNext, [install](/docs/aero/install#add-it)."),
      "aero/02-install.md": page("Install", "## Add it\n\nText."),
    });
    try {
      await buildDocsSite({ source, output });
      const overview = await Bun.file(join(output, "aero/index.html")).text();
      expect(overview).toContain('<h2 id="run-a-read">');
      expect(overview).toContain('class="callout callout-warning"');
      expect(overview).toContain('class="copy-code"');
      expect(overview).toContain("var(--shiki-token-");
      expect(overview).toContain('<div class="table-wrap"');
      expect(overview).toContain('href="/docs/aero/install" rel="next"');
      expect(await Bun.file(join(output, "aero/install/index.html")).exists()).toBe(true);
      expect(await Bun.file(join(output, "404.html")).exists()).toBe(true);
      const index = await Bun.file(join(output, "search.json")).json();
      expect(index).toContainEqual(expect.objectContaining({ p: "Aero", h: "Add it", u: "/docs/aero/install#add-it" }));
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test("fails on a broken docs link or a missing anchor", async () => {
    const { root, source, output } = await fixture({
      "evm/01-overview.md": page("Overview", "See [missing](/docs/evm/nope) and [anchor](/docs/evm#nope)."),
    });
    try {
      await expect(buildDocsSite({ source, output })).rejects.toThrow(/nope is not a docs page[\s\S]*#nope has no matching heading/);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

describe("docs routes on pecu.app", () => {
  const assets = new Map([
    ["/docs/index.html", "landing"],
    ["/docs/aero/index.html", "aero"],
    ["/docs/aero/cli/index.html", "cli"],
    ["/docs/404.html", "missing"],
    ["/docs/search.json", "[]"],
  ]);
  const unavailable = { fetch: async () => new Response("unexpected", { status: 500 }) };
  const env = {
    ASSETS: { fetch: async (request: Request) => {
      const body = assets.get(new URL(request.url).pathname);
      return body ? new Response(body) : new Response("Not found", { status: 404 });
    } },
    CLI: unavailable,
    EVM: unavailable,
    STOCKS: unavailable,
  } as never;
  const get = (path: string) => gateway.fetch(new Request(`https://pecu.app${path}`), env);

  test("serves clean docs paths from static assets", async () => {
    expect(await (await get("/docs")).text()).toBe("landing");
    expect(await (await get("/docs/aero")).text()).toBe("aero");
    expect(await (await get("/docs/aero/cli")).text()).toBe("cli");
    expect(await (await get("/docs/search.json")).text()).toBe("[]");
  });

  test("redirects trailing slashes, index files and the old Aero docs path", async () => {
    for (const [from, to] of [["/docs/", "/docs"], ["/docs/aero/", "/docs/aero"], ["/docs/aero/index.html", "/docs/aero"], ["/un-aerosdk/docs", "/docs/aero"], ["/un-aerosdk/docs/", "/docs/aero"]]) {
      const response = await get(from!);
      expect(response.status).toBe(308);
      expect(new URL(response.headers.get("Location")!).pathname).toBe(to!);
    }
  });

  test("points the SDK landing pages' README links at the docs", async () => {
    const landing = (href: string) => ({ fetch: async () => new Response(`<a href="${href}">Docs</a>`, { headers: { "Content-Type": "text/html" } }) });
    const withLandings = {
      ...(env as object),
      CLI: landing("https://github.com/OxFrancesco/UNOFFICIAL-Aero-SDK#readme"),
      EVM: landing("https://github.com/OxFrancesco/evmSDK#readme"),
    } as never;
    expect(await (await gateway.fetch(new Request("https://pecu.app/un-aerosdk"), withLandings)).text()).toContain('href="/docs/aero"');
    expect(await (await gateway.fetch(new Request("https://pecu.app/evmsdk"), withLandings)).text()).toContain('href="/docs/evm"');
  });

  test("returns the docs 404 page for unknown paths", async () => {
    for (const path of ["/docs/aero/missing", "/docs/a/b/c", "/docs/UPPER"]) {
      const response = await get(path);
      expect(response.status).toBe(404);
      expect(await response.text()).toBe("missing");
    }
  });
});
