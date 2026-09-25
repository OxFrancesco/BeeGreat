import { afterAll, afterEach, expect, test } from "bun:test";
import { Window } from "happy-dom";
import { createWalletClient, custom } from "viem";
import { connectBrowserWallet, disconnectBrowserWallet, executeSafeTransaction, signSafeTransaction, type BrowserWallet } from "../src/lib/browser-wallet";
import { treasuryDetail, pecuWallet } from "./fixtures/safe-profile";

const window = new Window();
const originalStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
Object.defineProperty(globalThis, "localStorage", { configurable: true, value: window.localStorage });
afterEach(() => disconnectBrowserWallet());

function wallet(reply: Parameters<typeof custom>[0]["request"]): BrowserWallet {
  const client = createWalletClient({ transport: custom({ request: reply }, { retryCount: 0 }) });
  return { info: { uuid: "test", name: "Test", icon: "", rdns: "test.wallet" }, provider: { request: client.request } };
}
const transaction = treasuryDetail.queue[0]!.transaction;

test("connect accepts valid accounts and refuses malformed provider responses", async () => {
  expect(await connectBrowserWallet(wallet(async () => [pecuWallet]))).toBe(pecuWallet);
  expect(JSON.parse(window.localStorage.getItem("pecu-browser-wallet")!)).toMatchObject({ rdns: "test.wallet", address: pecuWallet });
  await expect(connectBrowserWallet(wallet(async () => ["not-an-address"]))).rejects.toThrow("didn't share an account");
  await expect(connectBrowserWallet(wallet(async () => ({ address: pecuWallet })))).rejects.toThrow("didn't share an account");
});

test("signing requests Base and keeps the exact Safe transaction terms", async () => {
  const calls: string[] = [];
  const signature = `0x${"11".repeat(65)}`;
  const provider = wallet(async ({ method, params }) => {
    calls.push(method);
    if (method === "eth_chainId") return "0x1";
    if (method === "wallet_switchEthereumChain") throw { code: 4902, message: "Unknown chain" };
    if (method === "wallet_addEthereumChain") return null;
    expect(method).toBe("eth_signTypedData_v4");
    expect(params?.[0]).toBe(pecuWallet);
    expect(JSON.parse(String(params?.[1]))).toMatchObject({ domain: { chainId: 8453, verifyingContract: transaction.safe }, message: { to: transaction.to, value: transaction.value, data: transaction.data, nonce: transaction.nonce } });
    return signature;
  });
  expect(await signSafeTransaction(provider, pecuWallet, transaction)).toBe(signature);
  expect(calls).toEqual(["eth_chainId", "wallet_switchEthereumChain", "wallet_addEthereumChain", "eth_signTypedData_v4"]);
});

test("invalid signatures and transaction hashes cannot be reported as success", async () => {
  const provider = wallet(async ({ method }) => method === "eth_chainId" ? "0x2105" : "0x12");
  await expect(signSafeTransaction(provider, pecuWallet, transaction)).rejects.toThrow("unsupported signature");
  await expect(executeSafeTransaction(provider, pecuWallet, transaction, "0x")).rejects.toThrow("transaction hash");
});

test("wallet refusal remains an actionable refusal", async () => {
  const provider = wallet(async ({ method }) => {
    if (method === "eth_chainId") return "0x2105";
    throw { code: 4001, message: "User rejected request" };
  });
  await expect(signSafeTransaction(provider, pecuWallet, transaction)).rejects.toThrow("declined the request");
});

// Restore the host descriptor after this file's tests, including failed assertions.
afterAll(() => {
  if (originalStorage) Object.defineProperty(globalThis, "localStorage", originalStorage);
  else Reflect.deleteProperty(globalThis, "localStorage");
});
