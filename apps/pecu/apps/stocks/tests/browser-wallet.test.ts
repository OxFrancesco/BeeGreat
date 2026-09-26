import { afterAll, afterEach, expect, test } from "bun:test";
import { Window } from "happy-dom";
import { createWalletClient, custom, stringToHex } from "viem";
import { connectBrowserWallet, disconnectBrowserWallet, executeSafeTransaction, sendWalletTransaction, signSafeTransaction, signWalletLink, WalletDeclinedError, WalletNotReadyError, type BrowserWallet } from "../src/lib/browser-wallet";
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

test("linking signs the exact message with the connected account and rejects contract signatures", async () => {
  const message = "pecu.app wants you to sign in with your Ethereum account:\nLink this wallet";
  const signature = `0x${"22".repeat(65)}`;
  const provider = wallet(async ({ method, params }) => {
    expect(method).toBe("personal_sign");
    expect(params?.[0]).toBe(stringToHex(message));
    expect(params?.[1]).toBe(pecuWallet);
    return signature;
  });
  expect(await signWalletLink(provider, pecuWallet, message)).toBe(signature);
  await expect(signWalletLink(wallet(async () => `0x${"22".repeat(200)}`), pecuWallet, message)).rejects.toThrow("sign with their own key");
  await expect(signWalletLink(wallet(async () => { throw { code: 4001, message: "User rejected" }; }), pecuWallet, message)).rejects.toBeInstanceOf(WalletDeclinedError);
  await expect(signWalletLink(wallet(async () => { throw new Error("Failed to publish custom payload, please try again. id:1790414672597791488 tag:undefined"); }), pecuWallet, message)).rejects.toThrow("WalletConnect couldn't connect from this site. Try again later, or use a browser wallet.");
});

test("wallet transactions keep the exact server call and refuse the wrong account before sending", async () => {
  const call = { from: pecuWallet, to: treasuryDetail.address, data: "0x12345678", value: "1000" } as const;
  const sent: unknown[] = [];
  const hash = `0x${"ab".repeat(32)}`;
  const provider = (account: string) => wallet(async ({ method, params }) => {
    if (method === "eth_chainId") return "0x2105";
    if (method === "eth_accounts") return [account];
    expect(method).toBe("eth_sendTransaction");
    sent.push(params?.[0]);
    return hash;
  });
  expect(await sendWalletTransaction(provider(pecuWallet), pecuWallet, call)).toBe(hash);
  expect(sent).toEqual([{ from: pecuWallet, to: treasuryDetail.address, data: "0x12345678", value: "0x3e8" }]);
  await expect(sendWalletTransaction(provider("0x9999999999999999999999999999999999999999"), pecuWallet, call)).rejects.toBeInstanceOf(WalletNotReadyError);
  expect(sent).toHaveLength(1);
  const declined = wallet(async ({ method }) => {
    if (method === "eth_chainId") return "0x2105";
    if (method === "eth_accounts") return [pecuWallet];
    throw { code: 4001, message: "User rejected the request." };
  });
  await expect(sendWalletTransaction(declined, pecuWallet, call)).rejects.toBeInstanceOf(WalletDeclinedError);
});
