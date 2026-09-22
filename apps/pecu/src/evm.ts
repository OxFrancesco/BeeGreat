import { decodeFunctionData, encodeFunctionData, erc20Abi } from "viem";
import { safeParameterSchemas, safeReadSchemas, safeCallDescription, isSafeModuleConfiguration, safeTransactionSummary, type SafeReadCommand } from "./safe";
import { KNOWN_TOKENS } from "@beegreat/sugar";
import { z } from "zod";
import type { EvmCommand } from "./cloudflare/evm-protocol";
import { BASE_CHAIN_ID, type PlannedCall } from "./domain";
import { log } from "./logger";

export type EvmExecutor = (command: EvmCommand, input: Record<string, unknown>) => Promise<unknown>;

export const EVM_TX_ACTIONS = ["transfer", "approve", "revoke", "contract_call", "safe_create", "safe_approve", "safe_execute", "safe_execute_signatures", "safe_budget_spend", "safe_role_execute", "safe_roles_deploy", "safe_passkey_deploy"] as const;
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
  ...safeParameterSchemas,
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

  async safeRead(command: SafeReadCommand, input: Record<string, unknown>): Promise<EvmReadResult> {
    const parameters = safeReadSchemas[command].parse(input);
    return { kind: "read", command, output: await this.executor(command, { ...parameters, chainId: BASE_CHAIN_ID }) };
  }

  async propose(wallet: Address, action: EvmTxAction, rawParameters: unknown): Promise<EvmPlanResult> {
    const key = `pecu-${crypto.randomUUID()}`;
    switch (action) {
      case "safe_budget_spend": {
        const p = validateEvmRequest("safe_budget_spend", rawParameters);
        const operation = await this.call("safe-budget-spend", { ...p, account: wallet, key }, operationView);
        const description = await this.safeDescription({ chainId: 8453, safe: p.safe, to: p.token === "0x0000000000000000000000000000000000000000" ? p.to : p.token, value: p.token === "0x0000000000000000000000000000000000000000" ? p.amount : "0", data: p.token === "0x0000000000000000000000000000000000000000" ? "0x" : encodeFunctionData({ abi: erc20Abi, functionName: "transfer", args: [p.to, BigInt(p.amount)] }), nonce: "0", hash: `0x${"0".repeat(64)}` });
        return this.planResult(wallet, action, p, `Use your organization budget to ${description}. No additional owner approvals are required.`, { safe: p.safe }, operation);
      }
      case "safe_role_execute": {
        const p = validateEvmRequest("safe_role_execute", rawParameters);
        const operation = await this.call("safe-role-execute", { ...p, account: wallet, key }, operationView);
        let tokenCall = false;
        try { const decoded = decodeFunctionData({ abi: erc20Abi, data: p.data as `0x${string}` }); tokenCall = decoded.functionName === "transfer" || decoded.functionName === "approve"; } catch { tokenCall = false; }
        const description = tokenCall
          ? await this.safeDescription({ chainId: 8453, safe: p.safe, to: p.to, data: p.data, value: "0", nonce: "0", hash: `0x${"0".repeat(64)}` })
          : await this.roleCallDescription(p.to, p.data);
        return this.planResult(wallet, action, p, `Use the granted organization role to ${description}. No additional owner approvals are required.`, { safe: p.safe }, operation);
      }
      case "safe_roles_deploy": {
        const p = validateEvmRequest("safe_roles_deploy", rawParameters);
        const operation = await this.call("safe-roles-deploy", { ...p, account: wallet, key }, operationView.extend({ module: address }));
        return this.planResult(wallet, action, p, `Deploy a permissions module owned by organization wallet ${p.safe}. It will have no authority until owners enable it and grant permissions.`, { module: operation.module, safe: p.safe }, operation);
      }
      case "safe_passkey_deploy": {
        const p = validateEvmRequest("safe_passkey_deploy", rawParameters);
        const operation = await this.call("safe-passkey-deploy", { ...p, account: wallet, key }, operationView.extend({ owner: address }));
        return this.planResult(wallet, action, p, `Deploy passkey signer ${operation.owner}. Owners must separately approve adding it to organization wallet ${p.safe}.`, { owner: operation.owner, safe: p.safe }, operation);
      }
      case "safe_execute_signatures": {
        const p = validateEvmRequest("safe_execute_signatures", rawParameters);
        const operation = await this.call("safe-execute-signatures", { ...p, account: wallet, key }, operationView);
        return this.planResult(wallet, action, p, safeTransactionSummary("Execute with the collected owner signatures from", p.transaction, await this.safeDescription(p.transaction)), { safe: p.transaction.safe }, operation);
      }
      case "safe_create": {
        const parameters = validateEvmRequest("safe_create", rawParameters);
        const operation = await this.call("safe-deploy", { ...parameters, account: wallet, key }, operationView.extend({ deployment: z.object({ safe: address }) }));
        return this.planResult(wallet, action, parameters,
          `Create an organization wallet requiring ${parameters.threshold} of ${parameters.owners.length} owners.\nWallet: ${operation.deployment.safe}\nOwners: ${parameters.owners.join(", ")}\nOwners must control their own keys for independent approval.`,
          { safe: operation.deployment.safe }, operation);
      }
      case "safe_approve": {
        const parameters = validateEvmRequest("safe_approve", rawParameters);
        const operation = await this.call("safe-approve", { ...parameters, account: wallet, key }, operationView);
        return this.planResult(wallet, action, parameters, safeTransactionSummary("Approve", parameters.transaction, await this.safeDescription(parameters.transaction)) + "\nThis records your approval on-chain. It does not execute the organization transaction. Approval cannot be individually revoked.", { safe: parameters.transaction.safe }, operation);
      }
      case "safe_execute": {
        const parameters = validateEvmRequest("safe_execute", rawParameters);
        const operation = await this.call("safe-execute", { ...parameters, account: wallet, key }, operationView);
        return this.planResult(wallet, action, parameters, safeTransactionSummary("Execute the approved transaction from", parameters.transaction, await this.safeDescription(parameters.transaction)), { safe: parameters.transaction.safe }, operation);
      }
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

  private async roleCallDescription(to: Address, data: string): Promise<string> {
    const decoded = await this.call("decode", { address: to, data, kind: "call" }, decodeView);
    if (decoded.source !== "etherscan") throw new Error("Role call requires a verified contract ABI");
    const call = z.object({ functionName: z.string(), args: z.array(z.union([z.string(), z.boolean(), z.number()])).optional() }).parse(decoded.result);
    const args = (call.args ?? []).map((value, index) => `argument ${index + 1}: ${String(value)}`).join(", ");
    return `call ${call.functionName} on ${to}${args ? ` with ${args}. Numeric arguments use contract base units` : ""}`;
  }

  private async safeDescription(transaction: EvmTxParameters<"safe_approve">["transaction"]): Promise<string> {
    if (transaction.operation !== 1 && transaction.to.toLowerCase() !== transaction.safe.toLowerCase() && isSafeModuleConfiguration(transaction.data as `0x${string}`)) {
      await this.call("safe-module-info", { safe: transaction.safe, module: transaction.to }, z.object({ enabled: z.boolean() }));
    }
    const description = safeCallDescription(transaction);
    if (description.kind === "batch") return (await Promise.all(description.calls.map(call => this.safeDescription({ ...transaction, ...call, operation: 0 })))).map((text, index) => `${index + 1}. ${text}`).join("\n");
    if (description.kind === "budget") {
      const meta = description.token === "0x0000000000000000000000000000000000000000" ? { decimals: 18, symbol: "ETH" } : await this.call("token", { address: transaction.safe, token: description.token }, tokenView);
      return `allow ${description.delegate} to transfer up to ${formatUnits(description.amount, meta.decimals)} ${meta.symbol} ${description.resetMinutes ? `every ${description.resetMinutes} minutes` : "once"}`;
    }
    if (description.kind === "plain") return description.text;
    const meta = await this.call("token", { address: transaction.safe, token: transaction.to }, tokenView);
    const amount = formatUnits(description.amount, meta.decimals);
    return description.action === "transfer"
      ? `send ${amount} ${meta.symbol} to ${description.recipient}`
      : `allow ${description.recipient} to spend ${amount} ${meta.symbol}`;
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
