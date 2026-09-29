import type { PlannedCall } from "./domain";
import { BASE_USDC_ADDRESS } from "./domain";
import { requiresExplicitConfirmation } from "./policy";
import type { IntentAction } from "./state";
import { grantActive, type Grant, type GrantScope } from "./task-contract";
import { planOutflows, type Outflow } from "./transaction-plan";

const tradeActions = new Set(["swap", "stock_buy", "stock_sell", "index_rebalance", "stock_basket"]);
const liquidityActions = new Set(["deposit", "withdraw", "stake", "unstake", "claim_fees", "claim_emissions", "liquidity_budget"]);

/**
 * The grant scope an intent belongs to. Transfers, approvals, generic contract
 * calls, Aave, Safe actions, vote locks and deposit relays have none, so no
 * grant can ever run them unattended.
 */
export function grantScopeFor(intent: IntentAction): GrantScope | undefined {
  if (requiresExplicitConfirmation(intent)) return undefined;
  if (intent.family === "stocks" || (intent.family === "aero" && tradeActions.has(intent.action))) return "trade";
  if (intent.family === "liquidity" || (intent.family === "aero" && liquidityActions.has(intent.action))) return "liquidity";
  return undefined;
}

/** USD value of `amount` raw units of a token, or undefined when no price is available. */
export type Pricer = (outflow: Outflow) => Promise<number | undefined>;

const usdc = BASE_USDC_ADDRESS.toLowerCase();

export async function outflowUsd(outflows: readonly Outflow[], price: Pricer): Promise<number | undefined> {
  let total = 0;
  for (const outflow of outflows) {
    if (outflow.amount === 0n) continue;
    const value = !outflow.native && outflow.token === usdc ? Number(outflow.amount) / 1e6 : await price(outflow);
    if (value === undefined || !Number.isFinite(value) || value < 0) return undefined;
    total += value;
  }
  return total;
}

export type GrantDecision =
  | Readonly<{ execute: true; usd: number }>
  | Readonly<{ execute: false; reason: string }>;

/**
 * Whether one proposal inside an automated run may execute without the user.
 * Every condition must hold; the first failing one becomes the reason shown
 * with the approval request.
 */
export async function grantDecision(input: Readonly<{
  intent: IntentAction;
  calls: readonly PlannedCall[];
  grant: Grant | null;
  yolo: boolean;
  executionEnabled: boolean;
  linked: boolean;
  spentUsd: number;
  now: number;
  price: Pricer;
}>): Promise<GrantDecision> {
  if (!input.executionEnabled) return { execute: false, reason: "Transactions are paused on Pecu." };
  if (input.linked) return { execute: false, reason: "Your linked wallet signs this itself." };
  if (!input.yolo) return { execute: false, reason: "YOLO is off in this chat." };
  if (!input.grant) return { execute: false, reason: "This automation has no spending allowance." };
  if (input.grant.state === "requested") return { execute: false, reason: "Its spending allowance is waiting for your approval." };
  if (!grantActive(input.grant, input.now)) return { execute: false, reason: input.grant.state === "revoked" ? "Its spending allowance was revoked." : "Its spending allowance expired." };
  const scope = grantScopeFor(input.intent);
  if (!scope) return { execute: false, reason: "This kind of transaction always needs your confirmation." };
  if (!input.grant.scopes.includes(scope)) return { execute: false, reason: `The allowance does not cover ${scope === "trade" ? "trades" : "liquidity changes"}.` };
  const outflows = planOutflows(input.calls);
  if (!outflows) return { execute: false, reason: "Pecu could not measure how much this moves." };
  let usd: number | undefined;
  try { usd = await outflowUsd(outflows, input.price); } catch { usd = undefined; }
  if (usd === undefined) return { execute: false, reason: "Pecu could not price this transaction." };
  if (input.spentUsd + usd > input.grant.maxUsdPerRun) {
    return { execute: false, reason: `It moves about $${(input.spentUsd + usd).toFixed(2)}, above the $${input.grant.maxUsdPerRun} allowance per run.` };
  }
  return { execute: true, usd };
}
