interface Env {
  CLI: Fetcher;
  EVM: Fetcher;
  STOCKS: Fetcher;
  ASSETS: Fetcher;
}

const cliPath = "/un-aerosdk";
const docsPath = `${cliPath}/docs`;
const upstreamDocs = "https://github.com/OxFrancesco/UNOFFICIAL-Aero-SDK#readme";

function localLink(value: string, basePath: string): string {
  if (value === upstreamDocs) return docsPath;
  for (const [origin, prefix] of [["https://aerocli.buddytools.org", cliPath], ["https://evm.buddytools.org", "/evmsdk"]]) {
    if (value.startsWith(`${origin}/`)) return prefix + value.slice(origin.length).replace(/^\/$/, "");
  }
  if (value === "/stocks" || value.startsWith("/stocks/")) return value;
  if (value === "/aero/stocks" || value.startsWith("/aero/stocks/")) return value.slice(5);
  if (value === "/") return basePath;
  return value.startsWith("/") && !value.startsWith("//") ? basePath + value : value;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/aero/cli" || url.pathname.startsWith("/aero/cli/")) {
      url.pathname = cliPath + url.pathname.slice("/aero/cli".length);
      return Response.redirect(url, 308);
    }
    if (url.pathname === "/nansen-showcase" || url.pathname.startsWith("/nansen-showcase/")) {
      if (["/nansen-showcase/", "/nansen-showcase/index.html"].includes(url.pathname)) return Response.redirect(new URL("/nansen-showcase", url), 308);
      if (url.pathname === "/nansen-showcase") url.pathname = "/nansen-showcase/index.html";
      return env.ASSETS.fetch(new Request(url, request));
    }
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
    if (url.pathname === "/aero/stocks" || url.pathname.startsWith("/aero/stocks/")) {
      url.pathname = url.pathname.slice("/aero".length);
      return Response.redirect(url, 308);
    }
    if (
      url.pathname === "/stocks" ||
      url.pathname.startsWith("/stocks/") ||
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
    const basePath = url.pathname === "/evmsdk" || url.pathname.startsWith("/evmsdk/") ? "/evmsdk" : cliPath;
    if (url.pathname === `${basePath}/`) return Response.redirect(new URL(basePath, url), 308);
    if (url.pathname !== basePath && !url.pathname.startsWith(`${basePath}/`) && url.pathname !== "/favicon.svg") {
      return new Response("Not found", { status: 404 });
    }
    url.pathname = url.pathname === "/favicon.svg" ? "/favicon.svg" : url.pathname.slice(basePath.length) || "/";
    const service = basePath === "/evmsdk" ? env.EVM : env.CLI;
    const response = await service.fetch(new Request(url, request));
    if (response.status >= 300 && response.status < 400 && response.headers.has("Location")) {
      const headers = new Headers(response.headers);
      headers.set("Location", localLink(headers.get("Location")!, basePath));
      return new Response(response.body, { status: response.status, headers });
    }
    if (response.headers.get("Content-Type")?.includes("text/html")) {
      return new HTMLRewriter()
        .on("[href], [src], [poster], meta[property^='og:'], meta[name^='twitter:']", {
          element(element) {
            for (const attr of ["href", "src", "poster", "content"]) {
              const value = element.getAttribute(attr);
              if (value) {
                const mapped = localLink(value, basePath);
                element.setAttribute(attr, /^https:\/\/(aerocli|evm)\.buddytools\.org\//.test(value) ? new URL(mapped, request.url).href : mapped);
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
      return new Response((await response.text()).replaceAll('"/aero-scene.glb"', '"/un-aerosdk/aero-scene.glb"'), { headers });
    }
    return response;
  },
} satisfies ExportedHandler<Env>;
