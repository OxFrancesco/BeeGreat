import { createSugarCacheStore, executeSugarAction } from "@beegreat/sugar";
import { SUGAR_ACTIONS } from "@beegreat/sugar/contracts";
import { z } from "zod";

const requestSchema = z.object({
  action: z.enum(SUGAR_ACTIONS),
  parameters: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])),
});
const cacheStore = createSugarCacheStore();
let pending: Promise<void> = Promise.resolve();

export default {
  async fetch(request: Request, env: { ALCHEMY_RPC_URL: string }): Promise<Response> {
    if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });
    try {
      const { action, parameters } = requestSchema.parse(await request.json());
      if (parameters.chain !== 8453) return Response.json({ error: "Only Base mainnet is supported" }, { status: 400 });
      const result = pending.then(() => executeSugarAction(action, parameters, {
        rpcUrl: env.ALCHEMY_RPC_URL,
        cacheStore,
        settings: { requestConcurrency: 1, quoteMaxPaths: 128, quoteBatchSize: 16 },
      }));
      pending = result.then(() => undefined, () => undefined);
      return Response.json(await result);
    } catch (error) {
      return Response.json({ error: error instanceof Error ? error.message : "Aero request failed" }, { status: 502 });
    }
  },
};
