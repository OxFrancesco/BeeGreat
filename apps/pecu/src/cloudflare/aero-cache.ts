import { z } from "zod";
import { toSugarJson, type SugarJson, type SugarPoolLocatorStore, type SugarPoolLocatorKey, type SugarRpcObserver } from "@beegreat/sugar";

/** Only public catalog/topology data goes here. Balances, prices and plans stay fresh. */
export class AeroCache {
  constructor(private readonly cache: Pick<Cache, "match" | "put" | "delete"> | undefined, private readonly observe: SugarRpcObserver) {}
  private key(key: string) { return new Request(`https://pecu.app/__aero_cache/v2/${encodeURIComponent(key)}`); }
  async read<T>(key: string, schema: z.ZodType<T>): Promise<T | undefined> {
    const start = Date.now();
    try {
      const response = await this.cache?.match(this.key(key));
      const result = response ? schema.safeParse(await response.json()) : undefined;
      const hit = result?.success === true;
      this.observe({ operation: hit ? "cache.hit" : "cache.miss", phase: "read", status: "success", attemptCount: 1, durationMs: Date.now() - start });
      return hit ? result.data : undefined;
    } catch { return undefined; }
  }
  async write(key: string, value: SugarJson, ttl: number) {
    const start = Date.now();
    try {
      await this.cache?.put(this.key(key), Response.json(value, { headers: { "Cache-Control": `public, max-age=${ttl}` } }));
      this.observe({ operation: "cache.write", phase: "read", status: "success", attemptCount: 1, durationMs: Date.now() - start });
    } catch {
      this.observe({ operation: "cache.write", phase: "read", status: "error", attemptCount: 1, durationMs: Date.now() - start });
    }
  }
  locators(): SugarPoolLocatorStore {
    const key = (k: SugarPoolLocatorKey) => `locator:${k.chainId}:${k.sugarContractAddress.toLowerCase()}:${k.poolAddress.toLowerCase()}`;
    return {
      get: k => this.read(key(k), z.object({ offset: z.number().int().nonnegative() })),
      set: (k, v) => this.write(key(k), v, 86400),
      delete: async k => { try { await this.cache?.delete(this.key(key(k))); } catch {} },
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
