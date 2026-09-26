import { z } from "zod";
import { createSugarCacheStore, createSugarClient, executeSugarAction, validateSugarRequest, toSugarJson, type SugarRpcObserver, type SugarJson } from "@beegreat/sugar";
import { aeroRequestSchema, type AeroRequest } from "./aero-protocol";
import { liquidityPlan } from "../liquidity";
import { AeroCache, cachePublicCatalog } from "./aero-cache";
import { canonicalToken, focusedPools } from "./aero-pools";
import { log } from "../logger";
import { stockBasketPlan, stockSnapshot } from "../stocks";

const settings = { requestConcurrency: 4, quoteMaxPaths: 128, quoteBatchSize: 16 };
const walletSchema = z.templateLiteral(["0x", z.string().regex(/^[0-9a-fA-F]{40}$/)]);

type Env = { ALCHEMY_RPC_URL: string; AERO_CATALOG?: R2Bucket };

async function dispatch(request: AeroRequest, env: Env, observe: SugarRpcObserver): Promise<SugarJson> {
  const cache = new AeroCache(globalThis.caches ? await caches.open("pecu-aero-public-v1") : undefined, observe, env.AERO_CATALOG);
  const poolLocatorStore = cache.locators();
  const options = { rpcUrl: env.ALCHEMY_RPC_URL, cacheStore: createSugarCacheStore(), settings, poolLocatorStore, onRpcEvent: observe };
  const wallet = request.action === "liquidity_budget" || request.action === "stock_basket" ? request.wallet : walletSchema.safeParse(request.parameters.wallet).data;
  const sdk = createSugarClient(8453, { ...options, account: wallet });
  cachePublicCatalog(sdk, cache);
  const executeOptions = { ...options, clientFactory: () => sdk };
  if (request.action === "liquidity_budget") {
    return toSugarJson(await liquidityPlan(sdk,
      (action, parameters) => executeSugarAction(action, parameters, executeOptions),
      request.wallet, request.request));
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
  if (action === "pools" && parameters.full === true) return focusedPools(sdk, parameters, cache, poolLocatorStore);
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
  async fetch(request: Request, env: Env): Promise<Response> {
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
