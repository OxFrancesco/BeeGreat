import { jsonValueSchema, type JsonValue } from "./json-contract";
import { z } from "zod";

/**
 * Verify that a Crossmint smart-wallet submission actually executed on Base.
 * Ported from evmSDK's reconcileSmart: the receipt must be canonical for its
 * block and must contain a UserOperationEvent from a known EntryPoint whose
 * userOpHash and sender match the approved operation. The event's inner
 * success flag decides whether the user's call succeeded, because a bundler
 * transaction can succeed while the wrapped user operation reverts.
 */

const USER_OPERATION_EVENT_TOPIC = "0x49628fd1471006c1482da88028e9ce4dbb080b815c9b0344d39e5a8e6ec1419f";
const ENTRY_POINTS = new Set([
  "0x5ff137d4b0fdcd49dca30c7cf57e578a026d2789",
  "0x0000000071727de22e5e9d8baf0edac6f37da032",
  "0x4337084d9e255ff0702461cf8895ce9e3b5ff108",
]);

const hexQuantity = z.string().regex(/^0x[0-9a-fA-F]+$/);
const hash32 = z.string().regex(/^0x[0-9a-fA-F]{64}$/);
const receiptSchema = z.object({
  transactionHash: hash32,
  blockNumber: hexQuantity,
  blockHash: hash32,
  status: z.enum(["0x0", "0x1"]),
  gasUsed: hexQuantity,
  logs: z.array(z.object({
    address: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
    topics: z.array(hash32),
    data: z.string().regex(/^0x(?:[0-9a-fA-F]{2})*$/),
  })),
}).nullable();
const blockSchema = z.object({ hash: hash32 }).nullable();

export type JsonRpc = (method: string, params: readonly JsonValue[]) => Promise<JsonValue>;

type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

export function jsonRpcClient(url: string, fetchImpl: FetchLike = fetch): JsonRpc {
  return async (method, params) => {
    const response = await fetchImpl(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    });
    if (!response.ok) throw new Error(`RPC ${method} failed with HTTP ${response.status}`);
    const payload = z.object({ result: jsonValueSchema.optional(), error: z.object({ message: z.string() }).optional() }).parse(await response.json());
    if (payload.error) throw new Error(`RPC ${method} failed: ${payload.error.message}`);
    return payload.result ?? null;
  };
}

export type UserOperationOutcome =
  | Readonly<{ status: "pending" }>
  | Readonly<{ status: "confirmed" | "reverted"; hash: string; block: string; gasUsed: string }>;

export type UserOperationReference = Readonly<{
  hash: string;
  sender: string;
  userOperationHash: string;
}>;

export class UserOperationMismatchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UserOperationMismatchError";
  }
}

function pad32(address: string): string {
  return `0x${address.slice(2).toLowerCase().padStart(64, "0")}`;
}

function word(data: string, index: number): bigint {
  const start = 2 + index * 64;
  const slice = data.slice(start, start + 64);
  if (slice.length !== 64) throw new UserOperationMismatchError("UserOperationEvent data is truncated");
  return BigInt(`0x${slice}`);
}

export async function verifyUserOperation(rpc: JsonRpc, reference: UserOperationReference): Promise<UserOperationOutcome> {
  const receipt = receiptSchema.parse(await rpc("eth_getTransactionReceipt", [reference.hash]));
  if (!receipt) return { status: "pending" };
  const block = blockSchema.parse(await rpc("eth_getBlockByNumber", [receipt.blockNumber, false]));
  if (!block || block.hash.toLowerCase() !== receipt.blockHash.toLowerCase()) return { status: "pending" };

  const userOpHash = reference.userOperationHash.toLowerCase();
  const sender = pad32(reference.sender);
  const event = receipt.logs.find((entry) =>
    ENTRY_POINTS.has(entry.address.toLowerCase())
    && entry.topics[0]?.toLowerCase() === USER_OPERATION_EVENT_TOPIC
    && entry.topics[1]?.toLowerCase() === userOpHash
    && entry.topics[2]?.toLowerCase() === sender,
  );
  if (!event) throw new UserOperationMismatchError("Receipt does not contain the expected smart-wallet UserOperation event");
  const success = word(event.data, 1) !== 0n;
  const actualGasUsed = word(event.data, 3);
  return {
    status: receipt.status === "0x1" && success ? "confirmed" : "reverted",
    hash: receipt.transactionHash,
    block: BigInt(receipt.blockNumber).toString(),
    gasUsed: actualGasUsed.toString(),
  };
}

/** Poll until the user operation is included or the deadline passes. */
export async function awaitUserOperation(
  rpc: JsonRpc,
  reference: UserOperationReference,
  options: { attempts?: number; intervalMs?: number; sleep?: (ms: number) => Promise<void> } = {},
): Promise<UserOperationOutcome> {
  const attempts = options.attempts ?? 20;
  const intervalMs = options.intervalMs ?? 1_500;
  const sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const outcome = await verifyUserOperation(rpc, reference);
    if (outcome.status !== "pending") return outcome;
    await sleep(intervalMs);
  }
  return { status: "pending" };
}
