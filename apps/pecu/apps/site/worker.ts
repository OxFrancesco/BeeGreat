import { breadcrumbs, breadcrumbSchema, canonicalPath, jsonLd, origin } from "./seo";

interface Env {
  CLI: Pick<Fetcher, "fetch">;
  EVM: Pick<Fetcher, "fetch">;
  STOCKS: Pick<Fetcher, "fetch">;
  ASSETS: Pick<Fetcher, "fetch">;
  WAITLIST: Pick<Fetcher, "fetch">;
}

async function waitlist(request: Request, url: URL, env: Env): Promise<Response> {
  const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
  if (["GET", "HEAD"].includes(request.method)) return Response.redirect(new URL("/#waitlist", url), 302);
  if (request.method !== "POST") return Response.json({ error: "method not allowed" }, { status: 405, headers: { ...headers, Allow: "GET, HEAD, POST" } });
  if (request.headers.get("Origin") !== url.origin || !request.headers.get("Content-Type")?.startsWith("application/json")) {
    return Response.json({ error: "Submit the form on pecu.app." }, { status: 403, headers });
  }
  const body = await request.text();
  if (body.length > 1024) return Response.json({ error: "Request too large" }, { status: 413, headers });
  return env.WAITLIST.fetch(new Request("https://pecu.internal/waitlist", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Pecu-Client": request.headers.get("CF-Connecting-IP") ?? "" },
    body,
  }));
}

const cliPath = "/un-aerosdk";
const legacyDocsPath = `${cliPath}/docs`;
const upstreamDocs = new Map([
  ["https://github.com/OxFrancesco/UNOFFICIAL-Aero-SDK#readme", "/docs/aero"],
  ["https://github.com/OxFrancesco/evmSDK#readme", "/docs/evm"],
]);

async function docs(request: Request, url: URL, env: Env): Promise<Response> {
  if (url.pathname === "/docs/search.json") return env.ASSETS.fetch(request);
  const clean = url.pathname.replace(/\/index\.html$/, "").replace(/\/+$/, "") || "/docs";
  if (clean !== url.pathname) {
    url.pathname = clean;
    return Response.redirect(url, 308);
  }
  if (/^\/docs(\/[a-z0-9-]+){0,2}$/.test(clean)) {
    url.pathname = `${clean}/index.html`;
    const page = await env.ASSETS.fetch(new Request(url, request));
    if (page.status !== 404) return page;
  }
  url.pathname = "/docs/404.html";
  const missing = await env.ASSETS.fetch(new Request(url, request));
  return new Response(missing.body, { status: 404, headers: missing.headers });
}

function localLink(value: string, basePath: string): string {
  const docsPage = upstreamDocs.get(value);
  if (docsPage) return docsPage;
  for (const [origin, prefix] of [["https://aerocli.buddytools.org", cliPath], ["https://evm.buddytools.org", "/evmsdk"]]) {
    if (value.startsWith(`${origin}/`)) return prefix + value.slice(origin.length).replace(/^\/$/, "");
  }
  if (value === "/stocks" || value.startsWith("/stocks/")) return value;
  if (value === "/aero/stocks" || value.startsWith("/aero/stocks/")) return value.slice(5);
  if (value === "/") return basePath;
  return value.startsWith("/") && !value.startsWith("//") ? basePath + value : value;
}

function appMetadata(response: Response, path: string) {
  if (!response.ok || !response.headers.get("Content-Type")?.includes("text/html")) return response;
  const description = "View tokenized stock holdings on Base, preview buys and sells, and save a basket with target weights using your Pecu wallet.";
  return new HTMLRewriter()
    .on('link[rel="canonical"]', { element(element) { element.remove(); } })
    .on('link[rel="stylesheet"]', { element(element) {
      const href = element.getAttribute("href");
      if (!href?.startsWith("/assets/")) return;
      const url = new URL(href, origin);
      url.searchParams.set("pecu-fonts", "1");
      element.setAttribute("href", url.pathname + url.search);
    } })
    .on("img", { element(element) {
      if (element.getAttribute("src")?.startsWith("/assets/idle-")) {
        element.setAttribute("width", "960");
        element.setAttribute("height", "720");
      }
    } })
    .on('meta[name="description"]', { element(element) { if (path === "/stocks") element.remove(); } })
    .on("head", { element(element) {
      element.append(`<link rel="canonical" href="${origin}${path}">${path === "/stocks" ? `<meta name="description" content="${description}">` : ""}`, { html: true });
    } })
    .transform(response);
}

async function appFonts(response: Response): Promise<Response> {
  if (!response.ok || !response.headers.get("Content-Type")?.includes("text/css")) return response;
  const css = (await response.text())
    .replace(/url\([^)]*inter-[^)]*\.ttf\)format\([^)]+\)/g, 'url("/pecu-assets/fonts/inter.woff2")format("woff2")')
    .replace(/url\([^)]*jetbrains-mono-[^)]*\.ttf\)format\([^)]+\)/g, 'url("/pecu-assets/fonts/jetbrains-mono.woff2")format("woff2")')
    .replaceAll("font-display:swap", "font-display:optional");
  const headers = new Headers(response.headers);
  headers.delete("Content-Length");
  headers.delete("ETag");
  return new Response(css, { status: response.status, headers });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const isPage = ["GET", "HEAD"].includes(request.method) && !url.pathname.includes("/api/");
    const legacy = /^\/(aero\/(cli|stocks)|chat)(\/|$)/.test(url.pathname) || (url.pathname === legacyDocsPath || url.pathname.startsWith(`${legacyDocsPath}/`));
    const clean = isPage || legacy ? canonicalPath(url.pathname) : url.pathname;
    if (clean !== url.pathname || (url.hostname === "pecu.app" && url.protocol !== "https:")) {
      url.pathname = clean;
      if (url.hostname === "pecu.app") url.protocol = "https:";
      return Response.redirect(url, 308);
    }
    if (url.pathname === "/waitlist") return waitlist(request, url, env);
    if (["/robots.txt", "/sitemap.xml"].includes(url.pathname)) return env.ASSETS.fetch(request);
    if (url.pathname === "/about") {
      url.pathname = "/about/index.html";
      return env.ASSETS.fetch(new Request(url, request));
    }
    if (url.pathname === "/docs" || url.pathname.startsWith("/docs/")) return docs(request, url, env);
    for (const showcase of ["/nansen-showcase", "/polymarket-showcase"]) {
      if (url.pathname !== showcase && !url.pathname.startsWith(`${showcase}/`)) continue;
      if ([`${showcase}/`, `${showcase}/index.html`].includes(url.pathname)) return Response.redirect(new URL(showcase, url), 308);
      if (url.pathname === showcase) url.pathname = `${showcase}/index.html`;
      return env.ASSETS.fetch(new Request(url, request));
    }
    if (["/design", "/design/", "/design/index.html"].includes(url.pathname)) {
      if (url.pathname !== "/design") return Response.redirect(new URL("/design", url), 308);
      url.pathname = "/design/index.html";
      return env.ASSETS.fetch(new Request(url, request));
    }
    if (url.pathname === "/favicon.ico" || url.pathname === "/apple-touch-icon.png") {
      url.pathname = `/pecu-assets${url.pathname}`;
      return env.ASSETS.fetch(new Request(url, request));
    }
    if (url.pathname === "/" || url.pathname.startsWith("/pecu-assets/")) {
      if (url.pathname === "/") url.pathname = "/index.html";
      return env.ASSETS.fetch(new Request(url, request));
    }
    if (
      url.pathname === "/mcp" ||
      url.pathname === "/.well-known/oauth-protected-resource" ||
      url.pathname === "/.well-known/oauth-protected-resource/mcp" ||
      url.pathname === "/stocks" ||
      url.pathname.startsWith("/stocks/") ||
      url.pathname === "/agent" ||
      url.pathname.startsWith("/agent/") ||
      url.pathname === "/profile" ||
      url.pathname.startsWith("/profile/") ||
      url.pathname === "/researches" ||
      url.pathname.startsWith("/researches/") ||
      url.pathname.startsWith("/assets/")
    ) {
      const response = await env.STOCKS.fetch(request);
      if (url.pathname.startsWith("/assets/") && url.pathname.endsWith(".css")) return appFonts(response);
      return ["/agent", "/stocks"].includes(url.pathname) ? appMetadata(response, url.pathname) : response;
    }
    const basePath = url.pathname === "/evmsdk" || url.pathname.startsWith("/evmsdk/") ? "/evmsdk" : cliPath;
    if (url.pathname === `${basePath}/`) return Response.redirect(new URL(basePath, url), 308);
    if (url.pathname !== basePath && !url.pathname.startsWith(`${basePath}/`) && url.pathname !== "/favicon.svg") {
      return new Response("Not found", { status: 404 });
    }
    url.pathname = url.pathname === "/favicon.svg" ? "/favicon.svg" : url.pathname.slice(basePath.length) || "/";
    const service = basePath === "/evmsdk" ? env.EVM : env.CLI;
    let response = await service.fetch(new Request(url, request));
    if (response.status >= 300 && response.status < 400 && response.headers.has("Location")) {
      const headers = new Headers(response.headers);
      headers.set("Location", localLink(headers.get("Location")!, basePath));
      return new Response(response.body, { status: response.status, headers });
    }
    if (response.headers.get("Content-Type")?.includes("text/html")) {
      const crumbs = [{ name: "Pecu", path: "/" }, { name: basePath === cliPath ? "Aero CLI" : "evmSDK", path: basePath }];
      const rewriter = new HTMLRewriter()
        .on("[href], [src], [poster], meta[property^='og:'], meta[name^='twitter:']", {
          element(element) {
            for (const attr of ["href", "src", "poster", "content"]) {
              const value = element.getAttribute(attr);
              if (value) {
                const mapped = value === "/aero-blender.png" ? "/pecu-assets/aero-blender.webp" : value === "/aero-demo-poster.jpg" ? "/pecu-assets/aero-demo-poster.webp" : localLink(value, basePath);
                element.setAttribute(attr, /^https:\/\/(aerocli|evm)\.buddytools\.org\//.test(value) ? new URL(mapped, request.url).href : mapped);
              }
            }
          },
        });
      if (url.pathname === "/" && response.ok) {
        const headers = new Headers(response.headers);
        const policy = headers.get("Content-Security-Policy");
        if (policy && !policy.includes("https://eu.i.posthog.com")) {
          headers.set("Content-Security-Policy", /(?:^|;)\s*connect-src\b/.test(policy)
            ? policy.replace(/connect-src([^;]*)/, "connect-src$1 https://eu.i.posthog.com")
            : `${policy}; connect-src 'self' https://eu.i.posthog.com`);
        }
        response = new Response(response.body, { status: response.status, statusText: response.statusText, headers });
        rewriter
          .on('link[rel="canonical"]', { element(element) { element.remove(); } })
          .on("head", { element(element) { element.append(`<link rel="canonical" href="${origin}${basePath}">${jsonLd(breadcrumbSchema(crumbs))}<link rel="stylesheet" href="/pecu-assets/breadcrumbs.css"><script type="module" src="/pecu-assets/analytics.js"></script>`, { html: true }); } })
          .on(".topbar", { element(element) { element.after(breadcrumbs(crumbs), { html: true }); } })
          .on('script[src$="/scene.js"]', { element(element) {
            element.setAttribute("src", "/pecu-assets/sdk-scene.js");
            element.setAttribute("data-scene", `${basePath}/scene.js`);
            element.removeAttribute("type");
            element.setAttribute("defer", "");
          } });
      }
      return rewriter.transform(response);
    }
    if (url.pathname === "/scene.js" && response.ok) {
      const headers = new Headers(response.headers);
      headers.delete("Content-Length");
      headers.delete("ETag");
      return new Response((await response.text()).replaceAll('"/aero-scene.glb"', '"/un-aerosdk/aero-scene.glb"'), { headers });
    }
    return response;
  },
} satisfies ExportedHandler<Env>;
