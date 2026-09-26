import { z } from "zod";
import { toSugarJson, type SugarJson, type SugarPoolLocatorStore, type SugarPoolLocatorKey, type SugarRpcObserver } from "@beegreat/sugar";

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
      const response = await this.cache?.match(this.key(key));
      const result = response ? schema.safeParse(await response.json()) : undefined;
      const hit = result?.success === true;
      this.observed(key, "edge", hit ? "hit" : "miss", start);
      if (hit) return result.data;
    } catch { this.observed(key, "edge", "error", start); }
    if (!this.shared) return;
    start = Date.now();
    try {
      const object = await this.shared.get(`v1/${key}`);
      const parsed = object ? z.object({ expiresAt: z.number(), value: schema }).safeParse(JSON.parse(await object.text())) : undefined;
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
      await this.cache.put(this.key(key), Response.json(value, { headers: { "Cache-Control": `public, max-age=${ttl}` } }));
      this.observed(key, "edge", "write", start);
    } catch { this.observed(key, "edge", "error", start); }
  }
  async write(key: string, value: SugarJson, ttl: number) {
    const start = Date.now();
    await Promise.all([this.writeEdge(key, value, ttl), (async () => {
      if (!this.shared) return;
      try {
        await this.shared.put(`v1/${key}`, JSON.stringify({ expiresAt: start + ttl * 1000, value }));
        this.observed(key, "r2", "write", start);
      } catch { this.observed(key, "r2", "error", start); }
    })()]);
  }
  locators(): SugarPoolLocatorStore {
    const key = (k: SugarPoolLocatorKey) => `locator:${k.chainId}:${k.sugarContractAddress.toLowerCase()}:${k.poolAddress.toLowerCase()}`;
    return {
      get: k => this.read(key(k), z.object({ offset: z.number().int().nonnegative() })),
      set: (k, v) => this.write(key(k), v, 86400),
      delete: async k => { await Promise.allSettled([this.cache?.delete(this.key(key(k))), this.shared?.delete(`v1/${key(k)}`)]); },
    };
  }
}

const tokenSchema = z.object({ chainId: z.literal(8453), chainName: z.string(), tokenAddress: z.string(),
  symbol: z.string(), decimals: z.number(), listed: z.boolean(), emerging: z.boolean(),
  wrappedTokenAddress: z.templateLiteral(["0x", z.string()]).optional(),
});

export function cachePublicCatalog(client: import("@beegreat/sugar").SugarClient, cache: AeroCache) {
  const original = client.getAllTokens.bind(client);
  let catalog: ReturnType<typeof original> | undefined;
  client.getAllTokens = async (listedOnly = false) => {
    catalog ??= (async () => {
      const key = `tokens:8453:${client.settings.sugarContractAddress.toLowerCase()}`;
      const cached = await cache.read(key, z.array(tokenSchema));
      if (cached) return cached;
      const tokens = await original(false);
      await cache.write(key, tokens, 600);
      return tokens;
    })().catch(error => { catalog = undefined; throw error; });
    const tokens = await catalog;
    return listedOnly ? tokens.filter((token, index) => index === 0 || token.listed) : tokens;
  };
  const readRaw = client.getRawPools.bind(client);
  client.getRawPools = async (forSwaps = false) => {
    if (!forSwaps) return readRaw(false);
    const key = `swap-topology:${client.settings.sugarContractAddress}`;
    const cached = await cache.read(key, z.array(z.unknown()));
    if (cached) return cached;
    const result = await readRaw(true);
    // Tuple adapters accept integer strings. Only route topology is cached, never pool reserves.
    await cache.write(key, toSugarJson(result), 60);
    return result;
  };
}
