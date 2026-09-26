import { z } from "zod";
import { toSugarJson, type SugarJson, type SugarPoolLocatorStore, type SugarPoolLocatorKey, type SugarRpcObserver } from "@beegreat/sugar";
import { poolIndexSchema, indexPools } from "../pool-discovery";
import type { CatalogKind } from "./catalog-refresh";
import { canonicalToken } from "../token-reference";
import { cacheDeadline } from "./cache-deadline";

export type CatalogSource = (kind: CatalogKind) => Promise<{ value: unknown; expiresAt: number }>;

export interface SharedCatalog {
  get(key: string): Promise<{ text(): Promise<string> } | null>;
  put(key: string, value: string): Promise<{ key: string } | null | void>;
  delete(key: string): Promise<void>;
}

/** Only public catalog/topology data goes here. Balances, prices and plans stay fresh. */
export class AeroCache {
  constructor(private readonly cache: Pick<Cache, "match" | "put" | "delete"> | undefined, private readonly observe: SugarRpcObserver, private readonly shared?: SharedCatalog) {}
  private key(key: string) { return new Request(`https://pecu.app/__aero_cache/v2/${encodeURIComponent(key)}`); }
  private observed(key: string, tier: string, result: string, start: number) {
    this.observe({ operation: `cache.${key.split(":")[0]}.${tier}.${result}`, phase: "read", status: result === "error" ? "error" : "success", attemptCount: 1, durationMs: Date.now() - start });
  }
  async read<T>(key: string, schema: z.ZodType<T>): Promise<T | undefined> {
    let start = Date.now();
    try {
      const result = await cacheDeadline((async () => {
        const response = await this.cache?.match(this.key(key));
        return response ? schema.safeParse(await response.json()) : undefined;
      })());
      const hit = result?.success === true;
      this.observed(key, "edge", hit ? "hit" : "miss", start);
      if (hit) return result.data;
    } catch { this.observed(key, "edge", "error", start); }
    if (!this.shared) return;
    start = Date.now();
    try {
      const parsed = await cacheDeadline((async () => {
        const object = await this.shared?.get(`v1/${key}`);
        return object ? z.object({ expiresAt: z.number(), value: schema }).safeParse(JSON.parse(await object.text())) : undefined;
      })());
      if (!parsed?.success || parsed.data.expiresAt <= Date.now()) {
        this.observed(key, "r2", "miss", start);
        return;
      }
      this.observed(key, "r2", "hit", start);
      await this.writeEdge(key, toSugarJson(parsed.data.value), Math.floor((parsed.data.expiresAt - Date.now()) / 1000));
      return parsed.data.value;
    } catch { this.observed(key, "r2", "error", start); return; }
  }
  private async writeEdge(key: string, value: SugarJson, ttl: number) {
    if (!this.cache || ttl <= 0) return;
    const start = Date.now();
    try {
      await cacheDeadline(this.cache.put(this.key(key), Response.json(value, { headers: { "Cache-Control": `public, max-age=${ttl}` } })));
      this.observed(key, "edge", "write", start);
    } catch { this.observed(key, "edge", "error", start); }
  }
  async write(key: string, value: SugarJson, ttl: number) {
    const start = Date.now();
    await Promise.all([this.writeEdge(key, value, ttl), (async () => {
      if (!this.shared) return;
      try {
        await cacheDeadline(this.shared.put(`v1/${key}`, JSON.stringify({ expiresAt: start + ttl * 1000, value })));
        this.observed(key, "r2", "write", start);
      } catch { this.observed(key, "r2", "error", start); }
    })()]);
  }
  locators(): SugarPoolLocatorStore {
    const key = (k: SugarPoolLocatorKey) => `locator:${k.chainId}:${k.sugarContractAddress.toLowerCase()}:${k.poolAddress.toLowerCase()}`;
    return {
      get: k => this.read(key(k), z.object({ offset: z.number().int().nonnegative() })),
      set: async (k, v) => {
        const existing = await this.read(key(k), z.object({ offset: z.number().int().nonnegative() }));
        if (existing?.offset !== v.offset) await this.write(key(k), v, 86400);
      },
      delete: async k => { await Promise.allSettled([cacheDeadline(Promise.resolve(this.cache?.delete(this.key(key(k))))), cacheDeadline(Promise.resolve(this.shared?.delete(`v1/${key(k)}`)))]); },
    };
  }
}

export const tokenSchema = z.object({ chainId: z.literal(8453), chainName: z.string(), tokenAddress: z.string(),
  symbol: z.string(), decimals: z.number(), listed: z.boolean(), emerging: z.boolean(),
  wrappedTokenAddress: z.templateLiteral(["0x", z.string()]).optional(),
});

export function cachePublicCatalog(client: import("@beegreat/sugar").SugarClient, cache: AeroCache, source?: CatalogSource) {
  const read = async <T>(kind: CatalogKind, schema: z.ZodType<T>, ttl: number, fresh: () => Promise<T>): Promise<T> => {
    const key = `${kind}:8453:${client.settings.sugarContractAddress.toLowerCase()}`;
    const cached = await cache.read(key, schema);
    if (cached) return cached;
    const snapshot = source ? await source(kind) : { value: await fresh(), expiresAt: Date.now() + ttl * 1000 };
    const value = schema.parse(snapshot.value);
    if (snapshot.expiresAt <= Date.now()) throw new Error("Catalog refresh returned an expired snapshot");
    await cache.write(key, toSugarJson(value), Math.floor((snapshot.expiresAt - Date.now()) / 1000));
    return value;
  };
  const original = client.getAllTokens.bind(client);
  let catalog: ReturnType<typeof original> | undefined;
  client.getAllTokens = async (listedOnly = false) => {
    catalog ??= (async () => {
      return read("tokens", z.array(tokenSchema), 600, () => original(false));
    })().catch(error => { catalog = undefined; throw error; });
    const tokens = await catalog;
    return listedOnly ? tokens.filter((token, index) => index === 0 || token.listed) : tokens;
  };
  const getToken = client.getToken.bind(client);
  client.getToken = async reference => {
    const text = z.string().safeParse(reference);
    const ref = text.success ? canonicalToken(text.data) : reference;
    if (text.success && text.data.toUpperCase() !== "ETH" && !text.data.startsWith("0x") && text.data.toUpperCase() !== "WETH") {
      const tokens = await client.getAllTokens();
      const listed = new Map(tokens.filter(token => token.listed && token.symbol.toLowerCase() === text.data.toLowerCase()).map(token => [token.tokenAddress.toLowerCase(), token]));
      if (listed.size === 1) return listed.values().next().value;
    }
    return getToken(ref);
  };
  const readRaw = client.getRawPools.bind(client);
  client.getRawPools = async (forSwaps = false) => {
    if (!forSwaps) return readRaw(false);
    return read("swap-topology", z.array(z.unknown()), 180, () => readRaw(true));
  };
  let pools: Promise<z.output<typeof poolIndexSchema>> | undefined;
  return { pools: () => pools ??= read("pools", poolIndexSchema, 180, async () => indexPools(await readRaw(false))).catch(error => { pools = undefined; throw error; }) };
}
