import { DurableObject } from "cloudflare:workers";
import { createSugarClient, createSugarCacheStore, toSugarJson, type SugarJson } from "@beegreat/sugar";
import { z } from "zod";
import { indexPools, poolIndexSchema } from "../pool-discovery";
import { tokenSchema } from "./aero-cache";
import { CatalogRefresh, type CatalogKind } from "./catalog-refresh";
import { log } from "../logger";
import { cacheDeadline } from "./cache-deadline";

const kindSchema = z.enum(["tokens", "pools", "swap-topology"]);
const snapshotSchema = z.object({ expiresAt: z.number(), value: z.unknown() });

export class AeroCatalog extends DurableObject<AeroEnv> {
  private readonly refresh = new CatalogRefresh<SugarJson>((kind, force) => this.load(kind, force));

  private async load(kind: CatalogKind, force: boolean) {
    const startedAt = Date.now();
    const client = createSugarClient(8453, { rpcUrl: this.env.ALCHEMY_RPC_URL, cacheStore: createSugarCacheStore(), settings: { requestConcurrency: 4 } });
    const key = `v1/${kind}:8453:${client.settings.sugarContractAddress.toLowerCase()}`;
    const schema = kind === "tokens" ? z.array(tokenSchema) : kind === "pools" ? poolIndexSchema : z.array(z.unknown());
    if (!force) {
      try {
        const parsed = await cacheDeadline((async () => {
          const object = await this.env.AERO_CATALOG.get(key);
          return object ? snapshotSchema.safeParse(JSON.parse(await object.text())) : undefined;
        })());
        if (parsed?.success && parsed.data.expiresAt > Date.now()) {
          const data = schema.safeParse(parsed.data.value);
          if (data.success) return { expiresAt: parsed.data.expiresAt, value: toSugarJson(data.data) };
        }
      } catch { log("warn", "aero_catalog_read_failed", { kind }); }
    }
    const data = kind === "tokens" ? await client.getAllTokens(false)
      : kind === "pools" ? indexPools(await client.getRawPools(false)) : await client.getRawPools(true);
    const snapshot = { expiresAt: Date.now() + (kind === "tokens" ? 600_000 : 180_000), value: toSugarJson(schema.parse(data)) };
    try { await cacheDeadline(this.env.AERO_CATALOG.put(key, JSON.stringify(snapshot))); }
    catch { log("warn", "aero_catalog_write_failed", { kind }); }
    log("info", "aero_catalog_refreshed", { kind, duration_ms: Date.now() - startedAt, entries: data.length, expires_at: snapshot.expiresAt });
    return snapshot;
  }

  override async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const kind = kindSchema.safeParse(url.pathname.slice(1));
    if (!kind.success) return new Response("Unknown catalog", { status: 400 });
    try {
      return Response.json(await this.refresh.get(kind.data, request.method === "POST"));
    } catch {
      log("error", "aero_catalog_refresh_failed", { kind: kind.data });
      return new Response("Catalog refresh failed; please retry", { status: 503 });
    }
  }
}
