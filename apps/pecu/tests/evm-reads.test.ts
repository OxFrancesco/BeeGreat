import { expect, test } from "bun:test";
import { createPublicClient, custom, encodeAbiParameters } from "viem";
import { base } from "viem/chains";
import { runEvmRead } from "../src/cloudflare/evm-reads";

const wallet = "0x1111111111111111111111111111111111111111";
const usdc = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const word = (value: bigint) => encodeAbiParameters([{ type: "uint256" }], [value]);

test("Base reads use one fresh block and known tokens need no metadata calls", async () => {
  const requests: { method: string; params?: unknown }[] = [];
  const client = createPublicClient({ chain: base, transport: custom({ request: async (request) => {
    requests.push(request);
    return request.method === "eth_chainId" ? "0x2105" : request.method === "eth_blockNumber" ? "0x64" : request.method === "eth_getBalance" ? "0x10" : word(10000n);
  } }) });
  expect(await runEvmRead(client, { command: "token", input: { chainId: 8453, address: wallet, token: usdc } })).toMatchObject({ ok: true, result: { symbol: "USDC", decimals: 6, amount: "10000", block: "100" } });
  expect(requests.map((r) => r.method)).toEqual(["eth_chainId", "eth_blockNumber", "eth_call"]);
  expect(requests[2]?.params).toMatchObject([{ to: usdc }, "0x64"]);
  expect(await runEvmRead(client, { command: "allowance", input: { chainId: 8453, account: wallet, token: usdc, spender: wallet } })).toMatchObject({ ok: true, result: { amount: "10000", block: "100" } });
  expect(await runEvmRead(client, { command: "balance", input: { chainId: 8453, address: wallet } })).toMatchObject({ ok: true, result: { balanceWei: "16", block: "100" } });
});

test("invalid inputs, other chains and plans never trigger a direct RPC read", async () => {
  let calls = 0;
  const client = createPublicClient({ chain: base, transport: custom({ request: async () => { calls++; throw new Error("unexpected RPC"); } }) });
  expect(await runEvmRead(client, { command: "balance", input: { chainId: 1, address: wallet } })).toMatchObject({ ok: false, error: { code: "ChainMismatch" } });
  expect(await runEvmRead(client, { command: "token", input: { chainId: 8453, address: "bad", token: usdc } })).toMatchObject({ ok: false, error: { code: "InvalidInput" } });
  expect(await runEvmRead(client, { command: "transfer", input: {} })).toBeUndefined();
  expect(calls).toBe(0);
});

test("RPC failures never expose provider URLs or credentials", async () => {
  const client = createPublicClient({ chain: base, transport: custom({ request: async () => { throw new Error("https://rpc.example/secret-key private request"); } }, { retryCount: 0 }) });
  const result = await runEvmRead(client, { command: "balance", input: { chainId: 8453, address: wallet } });
  expect(result).toMatchObject({ ok: false, error: { code: "RpcReadFailed", retryable: true } });
  expect(JSON.stringify(result)).not.toContain("secret-key");
});
