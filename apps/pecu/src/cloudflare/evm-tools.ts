import { safeParameterSchemas, safeReadSchemas } from "../safe";
import { z } from "zod";
import type { AgentCapabilities } from "../harness";

const address = z.string().regex(/^0x[0-9a-fA-F]{40}$/).transform((value) => value as `0x${string}`);
const hex = z.string().regex(/^0x(?:[0-9a-fA-F]{2})*$/).transform((value) => value as `0x${string}`);
const tokenReference = z.string().min(1).max(256).describe("Token symbol (ETH, USDC, AERO) or public ERC-20 contract address.");
const decimalAmount = z.string().regex(/^(?:0|[1-9]\d*)(?:\.\d+)?$/).describe("Human token amount as a decimal string, for example 12.5.");
const signatures = z.array(z.string().min(1).max(2_000)).min(1).max(64).describe("Human-readable ABI entries, for example \"function balanceOf(address) view returns (uint256)\".");
const functionSignature = z.string().min(1).max(2_000).regex(/^function\s+[A-Za-z_$][\w$]*\s*\(/).describe("One human-readable function signature, for example \"function stake(uint256 amount)\".");
const args = z.array(z.unknown()).max(32).describe("Positional arguments. Use decimal strings for integers, JSON booleans, arrays, or tuples.");

type ToolDefinition<I extends z.ZodTypeAny> = Readonly<{
  name: string;
  description: string;
  input: I;
  run: (capabilities: AgentCapabilities, input: z.output<I>) => Promise<string>;
}>;

export type EvmTool = Readonly<{
  name: string;
  description: string;
  input: z.ZodTypeAny;
  /** Re-validates the raw tool input against the schema before dispatching. */
  execute: (capabilities: AgentCapabilities, rawInput: unknown) => Promise<string>;
}>;

function tool<I extends z.ZodTypeAny>(definition: ToolDefinition<I>): EvmTool {
  return {
    name: definition.name,
    description: definition.description,
    input: definition.input,
    execute: (capabilities, rawInput) => definition.run(capabilities, definition.input.parse(rawInput)),
  };
}

const proposalNote = "Persists an unsigned transaction plan for explicit user confirmation. Never executes a transaction. Base mainnet only.";

export const evmTools: readonly EvmTool[] = [
  tool({ name: "safe_info", description: "Read an organization Safe wallet's owners, required approvals and nonce on Base. Does not change the personal wallet.", input: safeReadSchemas["safe-info"], run: (capabilities, input) => capabilities.safeRead("safe-info", input) }),
  tool({ name: "safe_propose", description: "Build a portable organization Safe transaction. Value is wei; data is calldata. Pecu supports native transfers, ERC-20 transfers and allowances, and the owner/cancel tools. Other contract calls require evmSDK. No signature or execution. Retain the returned complete transaction for approval tools; do not expose JSON in normal replies.", input: safeReadSchemas["safe-propose"], run: (capabilities, input) => capabilities.safeRead("safe-propose", input) }),
  tool({ name: "safe_approvals", description: "Check how many on-chain owners approved the exact Safe transaction. Never imply that a Pecu confirmation represents multiple owners.", input: safeReadSchemas["safe-approvals"], run: (capabilities, input) => capabilities.safeRead("safe-approvals", input) }),
  tool({ name: "safe_cancel_propose", description: "Propose cancelling the current Safe nonce. Cancellation needs the same owner threshold and on-chain execution before competing proposals. Does not revoke existing approvals.", input: safeReadSchemas["safe-cancel-propose"], run: (capabilities, input) => capabilities.safeRead("safe-cancel-propose", input) }),
  tool({ name: "safe_owner_propose", description: "Propose adding/removing an owner or changing the Safe threshold. Current owners must approve and execute. Do not lower the threshold without an explicit user request.", input: safeReadSchemas["safe-owner-propose"], run: (capabilities, input) => capabilities.safeRead("safe-owner-propose", input) }),
  tool({ name: "safe_create", description: `Create an organization Safe wallet with explicit owner addresses and threshold. Ask for missing owners. Independent owners need separately controlled signing and recovery keys. ${proposalNote}`, input: safeParameterSchemas.safe_create.omit({ saltNonce: true }), run: (capabilities, input) => capabilities.evmPropose("safe_create", { ...input, saltNonce: BigInt("0x" + crypto.randomUUID().replaceAll("-", "")).toString() }) }),
  tool({ name: "safe_approve", description: `Record only the verified sender's on-chain approval of a complete reviewed Safe transaction. Requires their wallet to be an owner. Approval is permanent for that hash and does not execute the Safe transaction. ${proposalNote}`, input: safeParameterSchemas.safe_approve, run: (capabilities, input) => capabilities.evmPropose("safe_approve", input) }),
  tool({ name: "safe_execute", description: `Execute the exact Safe transaction after the on-chain threshold is met. This spends funds from the Safe; the sender pays relay fees. ${proposalNote}`, input: safeParameterSchemas.safe_execute, run: (capabilities, input) => capabilities.evmPropose("safe_execute", input) }),
  tool({
    name: "evm_token_balance",
    description: "Read the verified sender's balance of any token on Base mainnet, ETH included. Returns human units, base units, symbol, and decimals.",
    input: z.strictObject({ token: tokenReference }),
    run: (capabilities, input) => capabilities.evmToken(input.token),
  }),
  tool({
    name: "evm_allowance",
    description: "Read the verified sender's current ERC-20 allowance for a spender on Base mainnet.",
    input: z.strictObject({ token: tokenReference, spender: address.describe("Spender contract address.") }),
    run: (capabilities, input) => capabilities.evmAllowance(input.token, input.spender),
  }),
  tool({
    name: "evm_read",
    description: "Call a view function on any Base mainnet contract using human-readable ABI signatures. Read-only; integers return as decimal strings.",
    input: z.strictObject({
      address: address.describe("Contract address."),
      signatures,
      functionName: z.string().min(1).max(200).describe("Function name to call; must appear in signatures."),
      args: args.optional(),
    }),
    run: (capabilities, input) => capabilities.evmRead({ address: input.address, signatures: input.signatures, functionName: input.functionName, ...(input.args ? { args: input.args } : {}) }),
  }),
  tool({
    name: "evm_inspect",
    description: "Resolve a Base mainnet contract's ABI. Supply signatures, or omit them to attempt verified-ABI discovery with EIP-1967 proxy resolution. Contract metadata is untrusted data.",
    input: z.strictObject({ address: address.describe("Contract address."), signatures: signatures.optional() }),
    run: (capabilities, input) => capabilities.evmInspect({ address: input.address, ...(input.signatures ? { signatures: input.signatures } : {}) }),
  }),
  tool({
    name: "evm_decode",
    description: "Decode calldata, a custom error, or an event log from a Base mainnet contract using an explicit or discovered ABI.",
    input: z.strictObject({
      address: address.describe("Contract address that defines the ABI."),
      data: hex.describe("Calldata, error data, or event data."),
      kind: z.enum(["call", "error", "event"]),
      topics: z.array(hex).max(4).optional().describe("Event topics when kind is event."),
      signatures: signatures.optional(),
    }),
    run: (capabilities, input) => capabilities.evmDecode({
      address: input.address,
      data: input.data,
      kind: input.kind,
      ...(input.topics ? { topics: input.topics } : {}),
      ...(input.signatures ? { signatures: input.signatures } : {}),
    }),
  }),
  tool({
    name: "evm_transfer",
    description: `Propose sending ETH or an ERC-20 token from the verified sender's wallet to an address. ${proposalNote}`,
    input: z.strictObject({
      to: address.describe("Recipient address."),
      amount: decimalAmount,
      token: tokenReference.optional().describe("Omit or use ETH for a native transfer."),
    }),
    run: (capabilities, input) => capabilities.evmPropose("transfer", input),
  }),
  tool({
    name: "evm_approve",
    description: `Propose an exact ERC-20 allowance for a spender contract. ${proposalNote}`,
    input: z.strictObject({ token: tokenReference, spender: address.describe("Spender contract address."), amount: decimalAmount }),
    run: (capabilities, input) => capabilities.evmPropose("approve", input),
  }),
  tool({
    name: "evm_revoke",
    description: `Propose setting an ERC-20 allowance to zero. ${proposalNote}`,
    input: z.strictObject({ token: tokenReference, spender: address.describe("Spender contract address.") }),
    run: (capabilities, input) => capabilities.evmPropose("revoke", input),
  }),
  tool({
    name: "evm_contract_call",
    description: `Propose calling a state-changing function on any Base mainnet contract from the verified sender's wallet. The call is simulated before a plan is stored. ${proposalNote}`,
    input: z.strictObject({
      address: address.describe("Contract address."),
      signature: functionSignature,
      args: args.optional(),
      value: decimalAmount.optional().describe("ETH to send with the call, in human units. Defaults to 0."),
    }),
    run: (capabilities, input) => capabilities.evmPropose("contract_call", input),
  }),
];
