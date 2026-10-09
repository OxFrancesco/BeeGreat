import aero from "../../src/cloudflare/aero-worker";
import { catalogSource, refreshCatalogs } from "../../src/cloudflare/aero-catalog-client";
import { z } from "zod";
export { AeroCatalog } from "../../src/cloudflare/aero-catalog";

/** Exposes the production cron tick and demand read over HTTP so a test can drive them in Workerd. */
export default {
  ...aero,
  async fetch(request: Request, env: AeroEnv): Promise<Response> {
    const path = new URL(request.url).pathname;
    if (path === "/tick") return Response.json(await refreshCatalogs(env));
    if (path === "/r2") return Response.json((await env.AERO_CATALOG.list({ prefix: "v1/" })).objects.map(object => object.key.split(":")[0]));
    const kind = z.enum(["pools", "tokens", "swap-topology"]).safeParse(path.replace(/^\/catalog\//, "")).data;
    if (!kind || !path.startsWith("/catalog/")) return new Response("not found", { status: 404 });
    try {
      const snapshot = await catalogSource(env.AERO_REFRESH)(kind);
      return Response.json({ entries: Array.isArray(snapshot.value) ? snapshot.value.length : -1 });
    } catch (error) {
      return Response.json({ error: error instanceof Error ? error.message : String(error) }, { status: 503 });
    }
  },
};
