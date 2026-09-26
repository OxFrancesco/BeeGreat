import { z } from "zod";
import { abis } from "@beegreat/sugar";
import { nearbyPoolOffset } from "../pool-offset";
import { createSugarCacheStore, createSugarClient, executeSugarAction, validateSugarRequest, toSugarJson, type SugarRpcObserver, type SugarJson, type SugarPoolLocatorStore } from "@beegreat/sugar";
import { aeroRequestSchema, type AeroRequest } from "./aero-protocol";
import { liquidityPlan } from "../liquidity";
import { AeroCache, cachePublicCatalog } from "./aero-cache";
import { canonicalToken, focusedPools } from "./aero-pools";
import { discoverLiquidityPool, type PoolIndex } from "../pool-discovery";
import { catalogSource, refreshCatalogs } from "./aero-catalog-client";
import { log } from "../logger";
import { stockBasketPlan, stockSnapshot } from "../stocks";

const settings = { requestConcurrency: 4, quoteMaxPaths: 128, quoteBatchSize: 16 };
const walletSchema = z.templateLiteral(["0x", z.string().regex(/^[0-9a-fA-F]{40}$/)]);

async function dispatch(request: AeroRequest, env: AeroEnv, observe: SugarRpcObserver): Promise<SugarJson> {
  const cache = new AeroCache(globalThis.caches ? await caches.open("pecu-aero-public-v2") : undefined, observe, env.AERO_CATALOG);
  const persistedLocators = cache.locators();
  let poolIndex: PoolIndex | undefined;
  const indexed = (address: string) => poolIndex?.find(pool => pool.address.toLowerCase() === address.toLowerCase());
  const verifyOffset = async (address: string, offset: number) => {
    const started = Date.now();
    const corrected = await nearbyPoolOffset(address, offset, async (limit, start) => z.array(z.unknown()).parse(await sdk.publicClient.readContract({
      address: sdk.settings.sugarContractAddress, abi: abis.sugar, functionName: "all", args: [limit, start, 0],
    })));
    observe({ operation: "pool.locator.nearby", phase: "read", status: "success", durationMs: Date.now() - started, attemptCount: 1, itemCount: 33 });
    return corrected === undefined ? undefined : { offset: corrected };
  };
  const poolLocatorStore: SugarPoolLocatorStore = {
    get: async key => {
      const entry = indexed(key.poolAddress);
      if (entry) return verifyOffset(key.poolAddress, entry.offset);
      const saved = await persistedLocators.get(key);
      if (saved) {
        const verified = await verifyOffset(key.poolAddress, saved.offset);
        if (verified) return verified;
      }
      await pools();
      const discovered = indexed(key.poolAddress);
      return discovered ? verifyOffset(key.poolAddress, discovered.offset) : undefined;
    },
    set: async (key, value) => { if (indexed(key.poolAddress)?.offset !== value.offset) await persistedLocators.set(key, value); },
    delete: async key => { poolIndex = poolIndex?.filter(pool => pool.address.toLowerCase() !== key.poolAddress.toLowerCase()); await persistedLocators.delete(key); },
  };
  const options = { rpcUrl: env.ALCHEMY_RPC_URL, cacheStore: createSugarCacheStore(), settings, poolLocatorStore, onRpcEvent: observe };
  const wallet = request.action === "liquidity_budget" || request.action === "stock_basket" ? request.wallet : walletSchema.safeParse(request.parameters.wallet).data;
  const sdk = createSugarClient(8453, { ...options, account: wallet });
  const catalog = cachePublicCatalog(sdk, cache, catalogSource(env.AERO_REFRESH));
  const pools = async () => poolIndex ??= await catalog.pools();
  const executeOptions = { ...options, clientFactory: () => sdk };
  if (request.action === "liquidity_budget") {
    return toSugarJson(await liquidityPlan(sdk,
      (action, parameters) => executeSugarAction(action, parameters, executeOptions),
      request.wallet, request.request, async pair => {
        return discoverLiquidityPool(sdk, pair, await pools());
      }));
  }
  if (request.action === "stock_basket") {
    return toSugarJson(await stockBasketPlan(sdk, request.wallet, request.trades, request.slippage));
  }
  const { action } = request;
  const parameters = { ...request.parameters };
  for (const field of ["token0", "token1", "from_token", "to_token"]) {
    const reference = z.string().safeParse(parameters[field]);
    if (reference.success) parameters[field] = canonicalToken(reference.data);
  }
  validateSugarRequest(action, parameters);
  if (action === "pools" && parameters.full === true) return focusedPools(sdk, parameters, cache, poolLocatorStore, pools);
  if (action === "stocks" && wallet) {
    return toSugarJson(await stockSnapshot(sdk, wallet));
  }
  const trade = z.object({ stock: z.string(), amount: z.string() }).safeParse(parameters);
  if ((action === "stock_buy" || action === "stock_sell") && wallet && trade.success) {
    const side = action === "stock_buy" ? "buy" : "sell";
    const plan = await stockBasketPlan(
      sdk,
      wallet,
      [{ side, stock: trade.data.stock, amount: trade.data.amount }],
      Number(parameters.slippage ?? 0.01),
    );
    return toSugarJson(plan);
  }
  return executeSugarAction(action, parameters, executeOptions);
}

export default {
  async scheduled(controller: ScheduledController, env: AeroEnv): Promise<void> {
    await refreshCatalogs(env, controller.scheduledTime);
  },
  async fetch(request: Request, env: AeroEnv): Promise<Response> {
    if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });
    let body: AeroRequest;
    try {
      body = aeroRequestSchema.parse(await request.json());
    } catch {
      return Response.json({ error: "Invalid Aero request" }, { status: 400 });
    }
    if (body.action !== "liquidity_budget" && body.action !== "stock_basket" && body.parameters.chain !== 8453) {
      return Response.json({ error: "Only Base mainnet is supported" }, { status: 400 });
    }
    try {
      const startedAt = Date.now();
      const requestId = request.headers.get("X-Pecu-Request") ?? crypto.randomUUID();
      const timings: (Parameters<SugarRpcObserver>[0] & { endedAt: number })[] = [];
      const observe: SugarRpcObserver = event => {
        if (timings.length < 64) timings.push({ ...event, endedAt: Date.now() });
        log("info", "aero_rpc", { trace_id: request.headers.get("X-Pecu-Trace") || undefined, request_id: requestId, action: body.action, ...event });
      };
      const result = await dispatch(body, env, observe);
      log("info", "aero_request_completed", { trace_id: request.headers.get("X-Pecu-Trace") || undefined, request_id: requestId, action: body.action, duration_ms: Date.now() - startedAt, queue_wait_ms: 0 });
      return Response.json(result, { headers: { "X-Pecu-Rpc": JSON.stringify(timings) } });
    } catch (error) {
      return Response.json({ error: error instanceof Error ? error.message : "Aero request failed" }, { status: 502 });
    }
  },
};
