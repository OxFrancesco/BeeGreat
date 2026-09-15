import { describe, expect, test } from "bun:test";
import { awaitUserOperation, jsonRpcClient, UserOperationMismatchError, verifyUserOperation, type JsonRpc } from "../src/receipt";

const entryPoint = "0x0000000071727De22E5E9d8BAf0edAc6f37da032";
const topic = "0x49628fd1471006c1482da88028e9ce4dbb080b815c9b0344d39e5a8e6ec1419f";
const sender = "0x1111111111111111111111111111111111111111";
const paymaster = "0x2222222222222222222222222222222222222222";
const userOpHash = `0x${"ab".repeat(32)}`;
const txHash = `0x${"cd".repeat(32)}`;
const blockHash = `0x${"ef".repeat(32)}`;
const pad = (value: string) => `0x${value.slice(2).toLowerCase().padStart(64, "0")}`;
const word = (value: bigint) => value.toString(16).padStart(64, "0");

function eventLog(success: boolean, address = entryPoint, hash = userOpHash, from = sender) {
  return {
    address,
    topics: [topic, hash, pad(from), pad(paymaster)],
    data: `0x${word(7n)}${word(success ? 1n : 0n)}${word(123n)}${word(45_000n)}`,
  };
}

function rpcWith(receipt: unknown, block: unknown = { hash: blockHash }): { rpc: JsonRpc; calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    rpc: async (method) => {
      calls.push(method);
      if (method === "eth_getTransactionReceipt") return receipt;
      if (method === "eth_getBlockByNumber") return block;
      throw new Error(`unexpected ${method}`);
    },
  };
}

const receipt = (logs: unknown[], status = "0x1") => ({ transactionHash: txHash, blockNumber: "0x10", blockHash, status, gasUsed: "0x5208", logs });
const reference = { hash: txHash, sender, userOperationHash: userOpHash };

describe("user operation receipt verification", () => {
  test("confirms when the EntryPoint event matches sender, hash, and inner success", async () => {
    const { rpc } = rpcWith(receipt([eventLog(true)]));
    expect(await verifyUserOperation(rpc, reference)).toEqual({ status: "confirmed", hash: txHash, block: "16", gasUsed: "45000" });
  });

  test("reports reverted when the bundler transaction succeeded but the user operation did not", async () => {
    const { rpc } = rpcWith(receipt([eventLog(false)]));
    expect(await verifyUserOperation(rpc, reference)).toMatchObject({ status: "reverted" });
  });

  test("stays pending without a receipt or when the block was reorganized", async () => {
    expect(await verifyUserOperation(rpcWith(null).rpc, reference)).toEqual({ status: "pending" });
    expect(await verifyUserOperation(rpcWith(receipt([eventLog(true)]), { hash: `0x${"00".repeat(32)}` }).rpc, reference)).toEqual({ status: "pending" });
  });

  test("rejects receipts whose event belongs to another sender, hash, or contract", async () => {
    await expect(verifyUserOperation(rpcWith(receipt([eventLog(true, entryPoint, userOpHash, paymaster)])).rpc, reference)).rejects.toBeInstanceOf(UserOperationMismatchError);
    await expect(verifyUserOperation(rpcWith(receipt([eventLog(true, entryPoint, `0x${"00".repeat(32)}`)])).rpc, reference)).rejects.toBeInstanceOf(UserOperationMismatchError);
    await expect(verifyUserOperation(rpcWith(receipt([eventLog(true, paymaster)])).rpc, reference)).rejects.toBeInstanceOf(UserOperationMismatchError);
    await expect(verifyUserOperation(rpcWith(receipt([])).rpc, reference)).rejects.toThrow("UserOperation event");
  });

  test("polls until the operation is included", async () => {
    let attempt = 0;
    const rpc: JsonRpc = async (method) => {
      if (method === "eth_getTransactionReceipt") return ++attempt < 3 ? null : receipt([eventLog(true)]);
      return { hash: blockHash };
    };
    const outcome = await awaitUserOperation(rpc, reference, { attempts: 5, intervalMs: 0, sleep: async () => {} });
    expect(outcome.status).toBe("confirmed");
    expect(attempt).toBe(3);
  });

  test("gives up as pending after the attempt budget", async () => {
    const outcome = await awaitUserOperation(rpcWith(null).rpc, reference, { attempts: 2, intervalMs: 0, sleep: async () => {} });
    expect(outcome).toEqual({ status: "pending" });
  });

  test("the JSON-RPC client surfaces provider errors", async () => {
    const rpc = jsonRpcClient("https://rpc.example", async () => Response.json({ jsonrpc: "2.0", id: 1, error: { code: -32000, message: "rate limited" } }));
    await expect(rpc("eth_getTransactionReceipt", [txHash])).rejects.toThrow("rate limited");
    const failing = jsonRpcClient("https://rpc.example", async () => new Response(null, { status: 502 }));
    await expect(failing("eth_blockNumber", [])).rejects.toThrow("HTTP 502");
  });
});
