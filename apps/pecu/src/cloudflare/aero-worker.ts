import { z } from "zod";
import { createSugarCacheStore, createSugarClient, executeSugarAction, toSugarJson, type SugarJson } from "@beegreat/sugar";
import { aeroRequestSchema, type AeroRequest } from "./aero-protocol";
import { liquidityPlan } from "../liquidity";
import { stockBasketPlan, stockSnapshot } from "../stocks";

const cacheStore = createSugarCacheStore({ ttlMs: 10 * 60_000 });
const settings = { requestConcurrency: 4, quoteMaxPaths: 128, quoteBatchSize: 16 };
const walletSchema = z.templateLiteral(["0x", z.string().regex(/^[0-9a-fA-F]{40}$/)]);
let pending: Promise<void> = Promise.resolve();

type Env = { ALCHEMY_RPC_URL: string };

function client(rpcUrl: string, wallet: `0x${string}`) {
  return createSugarClient(8453, { rpcUrl, account: wallet, cacheStore, settings });
}

async function dispatch(request: AeroRequest, env: Env): Promise<SugarJson> {
  if (request.action === "liquidity_budget") {
    const options = { rpcUrl: env.ALCHEMY_RPC_URL, cacheStore: createSugarCacheStore(), settings };
    return toSugarJson(await liquidityPlan(createSugarClient(8453, { ...options, account: request.wallet }),
      (action, parameters) => executeSugarAction(action, parameters, options),
      request.wallet, request.request));
  }
  if (request.action === "stock_basket") {
    return toSugarJson(await stockBasketPlan(client(env.ALCHEMY_RPC_URL, request.wallet), request.wallet, request.trades, request.slippage));
  }
  const { action, parameters } = request;
  const wallet = walletSchema.safeParse(parameters.wallet).data;
  if (action === "stocks" && wallet) {
    return toSugarJson(await stockSnapshot(client(env.ALCHEMY_RPC_URL, wallet), wallet));
  }
  const trade = z.object({ stock: z.string(), amount: z.string() }).safeParse(parameters);
  if ((action === "stock_buy" || action === "stock_sell") && wallet && trade.success) {
    const side = action === "stock_buy" ? "buy" : "sell";
    const plan = await stockBasketPlan(
      client(env.ALCHEMY_RPC_URL, wallet),
      wallet,
      [{ side, stock: trade.data.stock, amount: trade.data.amount }],
      Number(parameters.slippage ?? 0.01),
    );
    return toSugarJson(plan);
  }
  return executeSugarAction(action, parameters, { rpcUrl: env.ALCHEMY_RPC_URL, cacheStore, settings });
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
      const result = pending.then(() => dispatch(body, env));
      pending = result.then(() => undefined, () => undefined);
      return Response.json(await result);
    } catch (error) {
      return Response.json({ error: error instanceof Error ? error.message : "Aero request failed" }, { status: 502 });
    }
  },
};
