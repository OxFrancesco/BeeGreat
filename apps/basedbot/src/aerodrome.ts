import { createSugarCacheStore, executeSugarAction, KNOWN_TOKENS, validateSugarRequest } from "@beegreat/sugar";
import {
  isSugarTxAction,
  type SugarAction,
  type SugarParameters,
  type SugarTxAction,
} from "@beegreat/sugar/contracts";
import type { SugarJson } from "@beegreat/sugar";
import type { Config } from "./config";
import { log } from "./logger";
import { BASE_CHAIN_ID, plannedCallSchema, type PlannedCall } from "./domain";

type JsonObject = { [key: string]: SugarJson };
export type AeroExecutor = (action: SugarAction, parameters: SugarParameters) => Promise<SugarJson>;

export type AeroReadResult = Readonly<{
  kind: "read";
  action: Exclude<SugarAction, SugarTxAction>;
  parameters: SugarParameters;
  output: SugarJson;
}>;

export type AeroPlanResult = Readonly<{
  kind: "transaction";
  action: SugarTxAction;
  parameters: SugarParameters;
  context: Readonly<JsonObject>;
  calls: readonly PlannedCall[];
}>;

export type AeroUnchangedResult = Readonly<{
  kind: "unchanged";
  action: "index_rebalance";
  parameters: SugarParameters;
  context: Readonly<JsonObject>;
}>;

export type AeroResult = AeroReadResult | AeroPlanResult | AeroUnchangedResult;

function object(value: SugarJson, label: string): JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Aerodrome returned an invalid ${label}`);
  }
  return value;
}

function withoutTransactions(value: JsonObject): JsonObject {
  return Object.fromEntries(
    Object.entries(value).filter(([key]) => key !== "transactions" && key !== "transaction_steps"),
  );
}

function parseCalls(result: JsonObject): PlannedCall[] {
  if (!Array.isArray(result.transaction_steps) || result.transaction_steps.length === 0) {
    throw new Error("Aerodrome returned an empty transaction plan");
  }
  return result.transaction_steps.map((rawStep) => {
    const step = object(rawStep, "transaction step");
    const transaction = object(step.transaction, "transaction");
    return plannedCallSchema.parse({ role: step.role, ...transaction });
  });
}

const ACTIONS_WITH_SLIPPAGE = new Set<SugarTxAction>(["swap", "deposit", "withdraw", "stock_buy", "stock_sell", "index_rebalance"]);
const baseTokenReferences = new Map(Object.values(KNOWN_TOKENS[BASE_CHAIN_ID]).map((token) => [token.symbol.toLowerCase(), token.tokenAddress]));

export class AerodromeService {
  private readonly cacheStore = createSugarCacheStore();
  private pending: Promise<void> = Promise.resolve();

  constructor(
    private readonly config: Pick<Config, "baseRpcUrl" | "maxSlippageBps">,
    private readonly executor?: AeroExecutor,
  ) {}

  run(
    wallet: `0x${string}`,
    action: SugarAction,
    rawParameters: SugarParameters,
  ): Promise<AeroResult> {
    const result = this.pending.then(() => this.execute(wallet, action, rawParameters));
    this.pending = result.then(() => undefined, () => undefined);
    return result;
  }

  private async execute(
    wallet: `0x${string}`,
    action: SugarAction,
    rawParameters: SugarParameters,
  ): Promise<AeroResult> {
    const parameters = this.bindRequest(wallet, action, rawParameters);
    const startedAt = Date.now();
    log("info", "aero_action_started", { action });
    const output = this.executor ? await this.executor(action, parameters) : await executeSugarAction(action, parameters, {
      rpcUrl: this.config.baseRpcUrl,
      cacheStore: this.cacheStore,
      settings: { requestConcurrency: 1, quoteMaxPaths: 128, quoteBatchSize: 16 },
    });
    log("info", "aero_action_completed", { action, durationMs: Date.now() - startedAt });
    if (!isSugarTxAction(action)) {
      return { kind: "read", action, parameters, output };
    }
    const result = object(output, `${action} plan`);
    if (action === "index_rebalance" && [result.transactions, result.transaction_steps, result.trades].every((items) => Array.isArray(items) && items.length === 0)) {
      return { kind: "unchanged", action, parameters, context: withoutTransactions(result) };
    }
    return {
      kind: "transaction",
      action,
      parameters,
      context: withoutTransactions(result),
      calls: parseCalls(result),
    };
  }

  private bindRequest(
    wallet: `0x${string}`,
    action: SugarAction,
    rawParameters: SugarParameters,
  ): SugarParameters {
    if (rawParameters.chain !== undefined && rawParameters.chain !== BASE_CHAIN_ID) {
      throw new Error("BasedBot only operates on Base mainnet (chain 8453)");
    }
    if (rawParameters.wallet !== undefined) {
      throw new Error("--wallet is managed by BasedBot and cannot be overridden");
    }

    const parameters: SugarParameters = { ...rawParameters, chain: BASE_CHAIN_ID };
    for (const name of ["from_token", "to_token", "token0", "token1"]) {
      const reference = parameters[name];
      if (typeof reference === "string") parameters[name] = baseTokenReferences.get(reference.toLowerCase()) ?? reference;
    }
    if (isSugarTxAction(action)) {
      parameters.wallet = wallet;
      if (ACTIONS_WITH_SLIPPAGE.has(action) && parameters.slippage === undefined) {
        parameters.slippage = this.config.maxSlippageBps / 10_000;
      }
    } else if (action === "stocks" || (action === "positions" && parameters.owner === undefined)) {
      parameters.wallet = wallet;
    }

    const validated = validateSugarRequest(action, parameters);
    const slippage = validated.slippage;
    if (typeof slippage === "number" && slippage * 10_000 > this.config.maxSlippageBps) {
      throw new Error(`Slippage exceeds the configured maximum of ${this.config.maxSlippageBps / 100}%`);
    }
    return validated;
  }
}
