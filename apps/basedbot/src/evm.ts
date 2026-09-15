import { KNOWN_TOKENS } from "@beegreat/sugar";
import { z } from "zod";
import type { EvmCommand } from "./cloudflare/evm-protocol";
import { BASE_CHAIN_ID, type PlannedCall } from "./domain";
import { log } from "./logger";

export type EvmExecutor = (command: EvmCommand, input: Record<string, unknown>) => Promise<unknown>;

export const EVM_TX_ACTIONS = ["transfer", "approve", "revoke", "contract_call"] as const;
export type EvmTxAction = (typeof EVM_TX_ACTIONS)[number];
export function isEvmTxAction(value: string): value is EvmTxAction {
  return EVM_TX_ACTIONS.some((action) => action === value);
}

type Address = `0x${string}`;
const addressPattern = /^0x[0-9a-fA-F]{40}$/;
const address = z.string().regex(addressPattern).transform((value) => value as Address);
const hex = z.string().regex(/^0x(?:[0-9a-fA-F]{2})*$/).transform((value) => value as Address);
const uint = z.string().regex(/^(0|[1-9]\d*)$/);
const decimalAmount = z.string().regex(/^(?:0|[1-9]\d*)(?:\.\d+)?$/, "amount must be a decimal number");
const tokenReference = z.string().min(1).max(256);
const functionSignature = z.string().min(1).max(2_000).regex(/^function\s+[A-Za-z_$][\w$]*\s*\(/, "signature must start with function NAME(");

export const evmTxParameterSchemas = {
  transfer: z.strictObject({ to: address, amount: decimalAmount, token: tokenReference.optional() }),
  approve: z.strictObject({ token: tokenReference, spender: address, amount: decimalAmount }),
  revoke: z.strictObject({ token: tokenReference, spender: address }),
  contract_call: z.strictObject({
    address,
    signature: functionSignature,
    args: z.array(z.unknown()).max(32).optional(),
    value: decimalAmount.optional(),
  }),
} as const;
export type EvmTxParameters<A extends EvmTxAction = EvmTxAction> = z.infer<(typeof evmTxParameterSchemas)[A]>;

export function validateEvmRequest<A extends EvmTxAction>(action: A, raw: unknown): EvmTxParameters<A> {
  const parsed = evmTxParameterSchemas[action].safeParse(raw);
  if (!parsed.success) throw new Error(parsed.error.issues.map((issue) => `${issue.path.join(".") || action}: ${issue.message}`).join("; "));
  return parsed.data as EvmTxParameters<A>;
}

const tokenView = z.object({ token: address, symbol: z.string(), decimals: z.number().int().min(0).max(255), amount: uint, block: uint });
const balanceView = z.object({ balanceWei: uint, block: uint });
const allowanceView = z.object({ amount: uint, block: uint });
const readView = z.object({ block: uint, value: z.unknown() });
const inspectView = z.object({ address, implementation: address.nullable(), abi: z.array(z.unknown()), source: z.string(), block: uint });
const decodeView = z.object({ source: z.string(), result: z.unknown() });
const operationView = z.object({
  plan: z.object({
    chainId: z.literal(BASE_CHAIN_ID),
    account: address,
    to: address,
    data: hex,
    value: uint,
    fingerprint: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
    expiresAt: z.number(),
    simulationBlock: uint,
    gas: uint,
    gasPrice: uint,
    l1FeeEstimate: uint.optional(),
  }),
  state: z.object({ _tag: z.literal("prepared") }),
});

export type EvmReadResult = Readonly<{ kind: "read"; command: EvmCommand; output: unknown }>;
export type EvmPlanResult = Readonly<{
  kind: "transaction";
  action: EvmTxAction;
  parameters: EvmTxParameters;
  summary: string;
  context: Readonly<Record<string, unknown>>;
  calls: readonly PlannedCall[];
}>;

type ResolvedToken = Readonly<{ kind: "native"; symbol: "ETH"; decimals: 18 }> | Readonly<{ kind: "erc20"; address: Address }>;

const knownTokens = new Map<string, ResolvedToken>(
  Object.values(KNOWN_TOKENS[BASE_CHAIN_ID]).map((token) => [
    token.symbol.toLowerCase(),
    token.tokenAddress === "ETH" ? { kind: "native", symbol: "ETH", decimals: 18 } : { kind: "erc20", address: token.tokenAddress as Address },
  ]),
);

export function resolveToken(reference: string | undefined): ResolvedToken {
  if (reference === undefined) return { kind: "native", symbol: "ETH", decimals: 18 };
  const known = knownTokens.get(reference.toLowerCase());
  if (known) return known;
  if (addressPattern.test(reference)) return { kind: "erc20", address: reference as Address };
  throw new Error(`Unknown token "${reference}". Use ETH, USDC, AERO, or a public 0x token address.`);
}

/** Convert a human decimal amount to integer base units without floating point. */
export function parseUnits(amount: string, decimals: number): bigint {
  if (!decimalAmount.safeParse(amount).success) throw new Error("amount must be a decimal number");
  const [whole = "0", fraction = ""] = amount.split(".");
  if (fraction.length > decimals) throw new Error(`amount has more than ${decimals} decimal places`);
  return BigInt(whole) * 10n ** BigInt(decimals) + BigInt(fraction.padEnd(decimals, "0") || "0");
}

export function formatUnits(value: bigint | string, decimals: number): string {
  const units = BigInt(value);
  const base = 10n ** BigInt(decimals);
  const whole = units / base;
  const fraction = (units % base).toString().padStart(decimals, "0").replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole.toString();
}

export class EvmService {
  constructor(private readonly executor: EvmExecutor) {}

  private async call<T>(command: EvmCommand, input: Record<string, unknown>, schema: z.ZodType<T>): Promise<T> {
    const startedAt = Date.now();
    log("info", "evm_command_started", { command });
    const output = await this.executor(command, { ...input, chainId: BASE_CHAIN_ID });
    log("info", "evm_command_completed", { command, durationMs: Date.now() - startedAt });
    const parsed = schema.safeParse(output);
    if (!parsed.success) throw new Error(`evm ${command} returned an unexpected result`);
    return parsed.data;
  }

  async tokenBalance(wallet: Address, reference: string): Promise<EvmReadResult> {
    const token = resolveToken(reference);
    if (token.kind === "native") {
      const balance = await this.call("balance", { address: wallet }, balanceView);
      return { kind: "read", command: "balance", output: { token: "ETH", address: wallet, amount: formatUnits(balance.balanceWei, 18), amount_wei: balance.balanceWei, block: balance.block } };
    }
    const view = await this.call("token", { address: wallet, token: token.address }, tokenView);
    return { kind: "read", command: "token", output: { token: view.symbol, token_address: view.token, address: wallet, amount: formatUnits(view.amount, view.decimals), amount_base_units: view.amount, decimals: view.decimals, block: view.block } };
  }

  async allowance(wallet: Address, reference: string, spender: Address): Promise<EvmReadResult> {
    const token = resolveToken(reference);
    if (token.kind === "native") throw new Error("ETH has no allowances");
    const [view, meta] = await Promise.all([
      this.call("allowance", { account: wallet, token: token.address, spender }, allowanceView),
      this.call("token", { address: wallet, token: token.address }, tokenView),
    ]);
    return { kind: "read", command: "allowance", output: { token: meta.symbol, token_address: token.address, owner: wallet, spender, amount: formatUnits(view.amount, meta.decimals), amount_base_units: view.amount, block: view.block } };
  }

  async read(input: { address: Address; signatures?: readonly string[]; abi?: readonly unknown[]; functionName: string; args?: readonly unknown[]; block?: string }): Promise<EvmReadResult> {
    const view = await this.call("read", { ...input }, readView);
    return { kind: "read", command: "read", output: { address: input.address, function: input.functionName, block: view.block, value: view.value } };
  }

  async inspect(input: { address: Address; signatures?: readonly string[] }): Promise<EvmReadResult> {
    const view = await this.call("inspect", { ...input }, inspectView);
    return { kind: "read", command: "inspect", output: view };
  }

  async decode(input: { address: Address; data: Address; topics?: readonly Address[]; kind: "call" | "error" | "event"; signatures?: readonly string[] }): Promise<EvmReadResult> {
    const view = await this.call("decode", { ...input }, decodeView);
    return { kind: "read", command: "decode", output: { address: input.address, kind: input.kind, ...view } };
  }

  async propose(wallet: Address, action: EvmTxAction, rawParameters: unknown): Promise<EvmPlanResult> {
    const key = `basedbot-${crypto.randomUUID()}`;
    switch (action) {
      case "transfer": {
        const parameters = validateEvmRequest("transfer", rawParameters);
        const token = resolveToken(parameters.token);
        if (parameters.to.toLowerCase() === wallet.toLowerCase()) throw new Error("Cannot transfer to your own wallet");
        if (token.kind === "native") {
          const amount = parseUnits(parameters.amount, 18);
          if (amount <= 0n) throw new Error("amount must be greater than zero");
          const balance = await this.call("balance", { address: wallet }, balanceView);
          if (BigInt(balance.balanceWei) < amount) throw new Error(`Insufficient ETH: balance ${formatUnits(balance.balanceWei, 18)}, requested ${parameters.amount}`);
          const operation = await this.call("transfer", { account: wallet, to: parameters.to, amount: amount.toString(), key }, operationView);
          return this.planResult(wallet, action, parameters, `Send ${parameters.amount} ETH to ${parameters.to}`, { token: "ETH" }, operation);
        }
        const meta = await this.call("token", { address: wallet, token: token.address }, tokenView);
        const amount = parseUnits(parameters.amount, meta.decimals);
        if (amount <= 0n) throw new Error("amount must be greater than zero");
        if (BigInt(meta.amount) < amount) throw new Error(`Insufficient ${meta.symbol}: balance ${formatUnits(meta.amount, meta.decimals)}, requested ${parameters.amount}`);
        const operation = await this.call("transfer", { account: wallet, token: token.address, to: parameters.to, amount: amount.toString(), key }, operationView);
        return this.planResult(wallet, action, parameters, `Send ${parameters.amount} ${meta.symbol} to ${parameters.to}`, { token: meta.symbol, token_address: token.address, decimals: meta.decimals }, operation);
      }
      case "approve": {
        const parameters = validateEvmRequest("approve", rawParameters);
        return this.allowancePlan(wallet, "approve", parameters, parameters.amount, key);
      }
      case "revoke": {
        const parameters = validateEvmRequest("revoke", rawParameters);
        return this.allowancePlan(wallet, "revoke", parameters, undefined, key);
      }
      case "contract_call": {
        const parameters = validateEvmRequest("contract_call", rawParameters);
        const functionName = /^function\s+([A-Za-z_$][\w$]*)/.exec(parameters.signature)?.[1];
        if (!functionName) throw new Error("signature must start with function NAME(");
        const value = parameters.value ? parseUnits(parameters.value, 18) : 0n;
        const operation = await this.call("prepare-call", {
          address: parameters.address,
          signatures: [parameters.signature],
          functionName,
          args: parameters.args ?? [],
          account: wallet,
          value: value.toString(),
          key,
        }, operationView);
        const summary = `Call ${functionName}(${(parameters.args ?? []).map((arg) => JSON.stringify(arg)).join(", ")}) on ${parameters.address}${value > 0n ? ` with ${parameters.value} ETH` : ""}`;
        return this.planResult(wallet, action, parameters, summary, { function: functionName }, operation);
      }
      default: {
        const _exhaustive: never = action;
        throw new Error(`Unsupported EVM action: ${String(_exhaustive)}`);
      }
    }
  }

  private async allowancePlan(
    wallet: Address,
    action: "approve" | "revoke",
    parameters: EvmTxParameters<"approve"> | EvmTxParameters<"revoke">,
    amount: string | undefined,
    key: string,
  ): Promise<EvmPlanResult> {
    const token = resolveToken(parameters.token);
    if (token.kind === "native") throw new Error("ETH cannot be approved; use an ERC-20 token");
    const meta = await this.call("token", { address: wallet, token: token.address }, tokenView);
    const baseUnits = amount === undefined ? 0n : parseUnits(amount, meta.decimals);
    const operation = action === "approve"
      ? await this.call("approve", { account: wallet, token: token.address, spender: parameters.spender, amount: baseUnits.toString(), key }, operationView)
      : await this.call("revoke", { account: wallet, token: token.address, spender: parameters.spender, key }, operationView);
    const summary = action === "approve"
      ? `Approve ${parameters.spender} to spend ${amount ?? "0"} ${meta.symbol}`
      : `Revoke ${meta.symbol} allowance for ${parameters.spender}`;
    return this.planResult(wallet, action, parameters, summary, { token: meta.symbol, token_address: token.address, decimals: meta.decimals }, operation);
  }

  private planResult(wallet: Address, action: EvmTxAction, parameters: EvmTxParameters, summary: string, context: Record<string, unknown>, operation: z.infer<typeof operationView>): EvmPlanResult {
    const plan = operation.plan;
    if (plan.account.toLowerCase() !== wallet.toLowerCase()) throw new Error("The sandbox returned a plan for a different account");
    return {
      kind: "transaction",
      action,
      parameters,
      summary,
      context: {
        ...context,
        simulation_block: plan.simulationBlock,
        gas_limit: plan.gas,
        gas_price_wei: plan.gasPrice,
        ...(plan.l1FeeEstimate ? { l1_fee_estimate_wei: plan.l1FeeEstimate } : {}),
      },
      calls: [{ role: "action", from: plan.account, to: plan.to, data: plan.data, value: plan.value }],
    };
  }
}
