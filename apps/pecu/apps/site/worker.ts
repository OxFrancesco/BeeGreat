interface Env {
  CLI: Fetcher;
  STOCKS: Fetcher;
  ASSETS: Fetcher;
}

const cliPath = "/aero/cli";
const docsPath = `${cliPath}/docs`;
const upstreamDocs = "https://github.com/OxFrancesco/UNOFFICIAL-Aero-SDK#readme";

function localLink(value: string): string {
  if (value === upstreamDocs) return docsPath;
  if (value.startsWith("https://aerocli.buddytools.org/")) {
    value = value.slice("https://aerocli.buddytools.org".length);
  }
  if (value === "/stocks" || value.startsWith("/stocks/")) return `/aero${value}`;
  if (value === "/") return cliPath;
  return value.startsWith("/") && !value.startsWith("//") ? cliPath + value : value;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (["/design", "/design/", "/design/index.html"].includes(url.pathname)) {
      if (url.pathname !== "/design") return Response.redirect(new URL("/design", url), 308);
      url.pathname = "/design/index.html";
      return env.ASSETS.fetch(new Request(url, request));
    }
    if (url.pathname === "/index.html") return Response.redirect(new URL("/", url), 308);
    if (url.pathname === "/favicon.ico" || url.pathname === "/apple-touch-icon.png") {
      url.pathname = `/pecu-assets${url.pathname}`;
      return env.ASSETS.fetch(new Request(url, request));
    }
    if (url.pathname === "/" || url.pathname.startsWith("/pecu-assets/")) {
      if (url.pathname === "/") url.pathname = "/index.html";
      return env.ASSETS.fetch(new Request(url, request));
    }
    if (url.pathname === "/chat" || url.pathname.startsWith("/chat/")) {
      url.pathname = `/agent${url.pathname.slice("/chat".length)}`;
      return Response.redirect(url, 308);
    }
    if (url.pathname === "/stocks" || url.pathname.startsWith("/stocks/")) {
      url.pathname = `/aero${url.pathname}`;
      return Response.redirect(url, 308);
    }
    if (
      url.pathname === "/aero/stocks" ||
      url.pathname.startsWith("/aero/stocks/") ||
      url.pathname === "/agent" ||
      url.pathname.startsWith("/agent/") ||
      url.pathname.startsWith("/assets/")
    ) {
      return env.STOCKS.fetch(request);
    }
    if (url.pathname === docsPath || url.pathname === `${docsPath}/` || url.pathname === `${docsPath}/index.html`) {
      if (url.pathname !== docsPath) return Response.redirect(new URL(docsPath, url), 308);
      url.pathname = `${docsPath}/index.html`;
      return env.ASSETS.fetch(new Request(url, request));
    }
    if (url.pathname === `${cliPath}/`) return Response.redirect(new URL(cliPath, url), 308);
    if (url.pathname !== cliPath && !url.pathname.startsWith(`${cliPath}/`) && url.pathname !== "/favicon.svg") {
      return new Response("Not found", { status: 404 });
    }
    url.pathname = url.pathname === "/favicon.svg" ? "/favicon.svg" : url.pathname.slice(cliPath.length) || "/";
    const response = await env.CLI.fetch(new Request(url, request));
    if (response.status >= 300 && response.status < 400 && response.headers.has("Location")) {
      const headers = new Headers(response.headers);
      headers.set("Location", localLink(headers.get("Location")!));
      return new Response(response.body, { status: response.status, headers });
    }
    if (response.headers.get("Content-Type")?.includes("text/html")) {
      return new HTMLRewriter()
        .on("[href], [src], [poster], meta[property^='og:'], meta[name^='twitter:']", {
          element(element) {
            for (const attr of ["href", "src", "poster", "content"]) {
              const value = element.getAttribute(attr);
              if (value) {
                const mapped = localLink(value);
                element.setAttribute(attr, value.startsWith("https://aerocli.buddytools.org/") ? new URL(mapped, request.url).href : mapped);
              }
            }
          },
        })
        .transform(response);
    }
    if (url.pathname === "/scene.js" && response.ok) {
      const headers = new Headers(response.headers);
      headers.delete("Content-Length");
      headers.delete("ETag");
      return new Response((await response.text()).replaceAll('"/aero-scene.glb"', '"/aero/cli/aero-scene.glb"'), { headers });
    }
    return response;
  },
} satisfies ExportedHandler<Env>;
