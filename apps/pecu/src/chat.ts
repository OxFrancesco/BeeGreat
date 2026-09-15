import { z } from "zod";
import { isTransactionReadPermissionError } from "./wallet-errors";
import type { AeroPlanResult } from "./aerodrome";
import { formatUnits, type EvmPlanResult, type EvmReadResult } from "./evm";
import type { WhopDeposit } from "./integrations/whop";

const units = z.string().regex(/^\d+$/);
const token = z.object({ symbol: z.string(), decimals: z.number().int().min(0).max(255) });
const quoteSchema = z.object({
  from_token: token,
  to_token: token,
  amount_in: units,
  amount_out: units,
  min_amount_out: units.optional(),
});

function record(value: unknown): Record<string, unknown> {
  return z.record(z.string(), z.unknown()).safeParse(value).data ?? {};
}

export function quoteText(value: unknown, proposal = false): string | undefined {
  const data = record(value);
  const parsed = quoteSchema.safeParse(data.quote ?? value);
  if (!parsed.success) return undefined;
  const q = parsed.data;
  const input = `${formatUnits(q.amount_in, q.from_token.decimals)} ${q.from_token.symbol}`;
  const output = `${formatUnits(q.amount_out, q.to_token.decimals)} ${q.to_token.symbol}`;
  return [
    proposal ? `Swap ${input} for about ${output} on Base.` : `${input} ≈ ${output}`,
    ...(proposal && q.min_amount_out !== undefined
      ? [`Minimum received: ${formatUnits(q.min_amount_out, q.to_token.decimals)} ${q.to_token.symbol}`]
      : []),
  ].join("\n");
}

const technicalFields = new Set([
  "chain", "chain_id", "chainId", "block", "block_number", "decimals", "abi", "data", "calldata",
  "transaction_steps", "transactions", "route", "routes", "simulation_block", "gas_limit", "gas_price_wei",
  "l1_fee_estimate_wei", "amount_wei", "amount_base_units", "fingerprint", "wallet", "owner",
  "use_decimals",
]);

function label(key: string): string {
  const text = key.replace(/([a-z])([A-Z])/g, "$1 $2").replaceAll("_", " ").replace(/ decimal$/, "");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function readableResult(value: unknown): string {
  const lines: string[] = [];
  function visit(item: unknown, name: string, depth: number): void {
    if (lines.length >= 12 || depth > 3 || item === null || item === undefined) return;
    if (typeof item === "string" || typeof item === "number" || typeof item === "boolean") {
      const text = typeof item === "boolean" ? item ? "Yes" : "No" : String(item);
      lines.push(`${name ? `${name}: ` : ""}${text.slice(0, 300)}`);
      return;
    }
    if (Array.isArray(item)) {
      if (item.length === 0) lines.push(name ? `${name}: none` : "No results.");
      item.slice(0, 5).forEach((entry, index) => visit(entry, name ? `${name} ${index + 1}` : String(index + 1), depth + 1));
      return;
    }
    const entries = record(item);
    for (const [key, child] of Object.entries(entries)) {
      if (technicalFields.has(key) || `${key}_decimal` in entries) continue;
      visit(child, name ? `${name} · ${label(key)}` : label(key), depth + 1);
    }
  }
  visit(value, "", 0);
  return lines.join("\n") || "No summary is available. Send b/verbose to see the details.";
}

export function aeroReadText(action: string, output: unknown): string {
  if (action === "stocks" && Array.isArray(output)) {
    if (!output.length) return "No stock tokens are available right now.";
    return output.map((item) => {
      const stock = record(item);
      return `${stock.name ?? stock.symbol}, ${stock.symbol}\n${typeof stock.price_usdc === "string" ? `${stock.price_usdc} USDC` : "Price unavailable"}${typeof stock.balance === "string" ? ` · You hold ${stock.balance}` : ""}`;
    }).join("\n\n");
  }
  return quoteText(output) ?? (action === "positions" && Array.isArray(output) && output.length === 0
    ? "You have no liquidity positions."
    : readableResult(output));
}

export function aeroPlanText(plan: AeroPlanResult): string {
  const quote = plan.action === "swap" ? quoteText(plan.context, true) : undefined;
  const action = label(plan.action);
  const trades = z.array(z.object({ from: z.string(), to: z.string(), amount: z.string(), expected: z.string(), minimum: z.string() })).safeParse(plan.context.trades);
  if (["stock_buy", "stock_sell", "index_rebalance"].includes(plan.action) && trades.success && trades.data.length) {
    return trades.data.map((trade) => `${trade.amount} ${trade.from} → about ${trade.expected} ${trade.to}\nMinimum received: ${trade.minimum} ${trade.to}`).join("\n\n") + "\nNetwork fee: not estimated yet.";
  }
  return [
    quote ?? `${action} on Base\n${readableResult({ ...plan.parameters, ...plan.context })}`,
    "Network fee: not estimated yet.",
  ].join("\n");
}

export function evmReadText(result: EvmReadResult): string {
  const data = record(result.output);
  if (typeof data.token === "string" && typeof data.amount === "string") {
    if (result.command === "allowance" && typeof data.spender === "string") {
      return `${data.spender} can spend ${data.amount} ${data.token}.`;
    }
    return `${data.token}: ${data.amount}`;
  }
  return readableResult(result.command === "read" ? data.value : result.output);
}

export function evmPlanText(plan: EvmPlanResult): string {
  if (plan.action === "contract_call" && "signature" in plan.parameters) {
    const params = plan.parameters;
    return [
      `Call ${typeof plan.context.function === "string" ? plan.context.function : "contract"} on Base`,
      `Contract: ${params.address}`,
      ...(params.args?.length ? [readableResult({ arguments: params.args })] : []),
      ...(params.value ? [`Send: ${params.value} ETH`] : []),
      "Network fee: not estimated yet.",
    ].join("\n");
  }
  // Smart-wallet relay fees are not included in the sandbox's EOA gas estimate.
  return `${plan.summary}\nNetwork fee: not estimated yet.`;
}

export function depositInstructionsText(deposit: WhopDeposit, walletAddress: string, maxUsd: number): string {
  const lines = ["Add funds to your Pecu wallet"];
  if (deposit.hosted_url) lines.push(`Funding page: ${deposit.hosted_url}`);
  for (const currency of (deposit.methods.bank?.currencies ?? []).slice(0, 2)) {
    const details = [
      currency.deposit_bank_name,
      currency.account_number ? `account ${currency.account_number}` : undefined,
      currency.routing_number ? `routing ${currency.routing_number}` : undefined,
      currency.swift_bic ? `SWIFT ${currency.swift_bic}` : undefined,
      currency.deposit_beneficiary_name ? `beneficiary ${currency.deposit_beneficiary_name}` : undefined,
      currency.deposit_reference ? `reference ${currency.deposit_reference}` : undefined,
    ].filter((part): part is string => part !== undefined);
    lines.push(`Bank transfer (${[currency.currency.toUpperCase(), ...currency.rails].join(", ")}): ${details.join(", ")}`);
  }
  for (const network of (deposit.methods.crypto ?? []).filter((entry) => entry.deposit_address !== null && entry.name !== "Base").slice(0, 4)) {
    lines.push(`${network.name}: ${network.deposit_address} (${network.supported_currencies.map((token) => token.name).join(", ")})`);
  }
  lines.push(`Skip Whop for Base: send USDC or ETH on Base straight to your Pecu wallet ${walletAddress}.`);
  lines.push(`When Whop confirms a deposit, Pecu sends the same dollar amount in USDC to your Base wallet (automatic up to $${maxUsd} per deposit; larger deposits are reviewed manually). Crypto deposits need at least $10.`);
  lines.push("Send /deposit status to check progress.");
  return lines.join("\n");
}

export function verbosePage(json: string | undefined, page: number): string {
  if (!json) return "No technical details yet. Ask for a balance, quote, or transaction preview first.";
  const size = 2_800;
  const pages = Math.ceil(json.length / size);
  if (page > pages) return `There are ${pages} pages. Send b/verbose 1 to start.`;
  const part = json.slice((page - 1) * size, page * size);
  return pages === 1 ? part : `${part}\n\nPage ${page} of ${pages}.${page < pages ? ` Next: b/verbose ${page + 1}` : ""}`;
}

export function chatError(error: unknown): string {
  if (isTransactionReadPermissionError(error)) return "A wallet permission is missing. The bot administrator needs to fix it before I can check transaction status. Don't repeat the transaction request.";
  if (error instanceof z.ZodError) {
    return `Please check your request: ${error.issues.map((issue) => `${issue.path.join(" ") || "input"}: ${issue.message}`).slice(0, 3).join("; ")}`;
  }
  const message = error instanceof Error ? error.message : String(error);
  if (/illegal invocation/i.test(message)) return "The service is temporarily unavailable. Please try again shortly.";
  if (/sandbox|shell exited/i.test(message)) return "The wallet service is temporarily unavailable. Please try again shortly.";
  if (/[\{\}\[\]\n]/.test(message) || message.length > 350) return "I couldn't complete that request. Please try again.";
  return `Could not process that command: ${message}`;
}
