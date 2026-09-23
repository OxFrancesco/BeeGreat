import { useSyncExternalStore } from "react";
import { concatHex, encodeFunctionData, getAddress, padHex, parseAbi, zeroAddress } from "viem";
import type { ProfileProposal } from "../../../../src/safe-profile-contract";

type Address = `0x${string}`;
export type Eip1193Provider = {
  request(args: { method: string; params?: readonly unknown[] }): Promise<unknown>;
  on?(event: string, listener: (...args: unknown[]) => void): void;
  removeListener?(event: string, listener: (...args: unknown[]) => void): void;
};
export type BrowserWalletInfo = Readonly<{ uuid: string; name: string; icon: string; rdns: string }>;
export type BrowserWallet = Readonly<{ info: BrowserWalletInfo; provider: Eip1193Provider }>;
type Snapshot = Readonly<{ wallets: readonly BrowserWallet[]; connected: Readonly<{ wallet: BrowserWallet; address: Address }> | null }>;

const baseChainId = "0x2105";
const storageKey = "pecu-browser-wallet";
const executeAbi = parseAbi([
  "function execTransaction(address to,uint256 value,bytes data,uint8 operation,uint256 safeTxGas,uint256 baseGas,uint256 gasPrice,address gasToken,address refundReceiver,bytes signatures) payable returns (bool success)",
]);

let snapshot: Snapshot = { wallets: [], connected: null };
const listeners = new Set<() => void>();
let started = false;
let detach: (() => void) | undefined;

function publish(next: Partial<Snapshot>) {
  snapshot = { ...snapshot, ...next };
  for (const listener of listeners) listener();
}

function isProvider(value: unknown): value is Eip1193Provider {
  return typeof value === "object" && value !== null && "request" in value && typeof value.request === "function";
}

function announce(event: Event) {
  const detail: unknown = "detail" in event ? event.detail : undefined;
  if (typeof detail !== "object" || detail === null || !("info" in detail) || !("provider" in detail)) return;
  const { info, provider } = detail;
  if (!isProvider(provider) || typeof info !== "object" || info === null) return;
  const read = (key: string) => (key in info && typeof Reflect.get(info, key) === "string" ? String(Reflect.get(info, key)) : "");
  const wallet: BrowserWallet = { info: { uuid: read("uuid"), name: read("name") || "Browser wallet", icon: read("icon"), rdns: read("rdns") }, provider };
  if (!wallet.info.uuid || snapshot.wallets.some((known) => known.info.uuid === wallet.info.uuid)) return;
  publish({ wallets: [...snapshot.wallets, wallet] });
  void restore(wallet);
}

function start() {
  if (started || typeof window === "undefined") return;
  started = true;
  window.addEventListener("eip6963:announceProvider", announce);
  window.dispatchEvent(new Event("eip6963:requestProvider"));
  window.setTimeout(() => {
    const injected: unknown = Reflect.get(window, "ethereum");
    if (!snapshot.wallets.length && isProvider(injected)) {
      const wallet: BrowserWallet = { info: { uuid: "injected", name: "Browser wallet", icon: "", rdns: "injected" }, provider: injected };
      publish({ wallets: [wallet] });
      void restore(wallet);
    }
  }, 400);
}

function accounts(value: unknown): Address[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && /^0x[0-9a-fA-F]{40}$/.test(item)).map((item) => getAddress(item)) : [];
}

function watch(wallet: BrowserWallet) {
  detach?.();
  const changed = (value: unknown) => {
    const [address] = accounts(value);
    if (!address) return disconnectBrowserWallet();
    publish({ connected: { wallet, address } });
    localStorage.setItem(storageKey, JSON.stringify({ rdns: wallet.info.rdns, address }));
  };
  wallet.provider.on?.("accountsChanged", changed);
  detach = () => wallet.provider.removeListener?.("accountsChanged", changed);
}

async function restore(wallet: BrowserWallet) {
  if (snapshot.connected) return;
  const saved: unknown = JSON.parse(localStorage.getItem(storageKey) ?? "null");
  if (typeof saved !== "object" || saved === null || Reflect.get(saved, "rdns") !== wallet.info.rdns) return;
  try {
    const [address] = accounts(await wallet.provider.request({ method: "eth_accounts" }));
    if (!address) return;
    publish({ connected: { wallet, address } });
    watch(wallet);
  } catch {
    localStorage.removeItem(storageKey);
  }
}

export async function connectBrowserWallet(wallet: BrowserWallet): Promise<Address> {
  const [address] = accounts(await wallet.provider.request({ method: "eth_requestAccounts" }));
  if (!address) throw new Error("The wallet didn't share an account.");
  publish({ connected: { wallet, address } });
  localStorage.setItem(storageKey, JSON.stringify({ rdns: wallet.info.rdns, address }));
  watch(wallet);
  return address;
}

export function disconnectBrowserWallet() {
  detach?.();
  detach = undefined;
  localStorage.removeItem(storageKey);
  publish({ connected: null });
}

export function useBrowserWallets(): Snapshot {
  return useSyncExternalStore(
    (listener) => {
      start();
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => snapshot,
    () => snapshot,
  );
}

function walletError(error: unknown): Error {
  const code = typeof error === "object" && error !== null ? Reflect.get(error, "code") : undefined;
  if (code === 4001) return new Error("You declined the request in your wallet.");
  const message = typeof error === "object" && error !== null ? Reflect.get(error, "message") : undefined;
  return new Error(typeof message === "string" && message.length < 200 ? message : "Your wallet couldn't complete the request.");
}

async function ensureBase(provider: Eip1193Provider) {
  if (String(await provider.request({ method: "eth_chainId" })).toLowerCase() === baseChainId) return;
  try {
    await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: baseChainId }] });
  } catch (error) {
    if (typeof error !== "object" || error === null || Reflect.get(error, "code") !== 4902) throw error;
    await provider.request({
      method: "wallet_addEthereumChain",
      params: [{ chainId: baseChainId, chainName: "Base", nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 }, rpcUrls: ["https://mainnet.base.org"], blockExplorerUrls: ["https://basescan.org"] }],
    });
  }
}

export async function signSafeTransaction(wallet: BrowserWallet, address: Address, transaction: ProfileProposal["transaction"]): Promise<Address> {
  try {
    await ensureBase(wallet.provider);
    const typedData = {
      types: {
        EIP712Domain: [{ name: "chainId", type: "uint256" }, { name: "verifyingContract", type: "address" }],
        SafeTx: [
          { name: "to", type: "address" }, { name: "value", type: "uint256" }, { name: "data", type: "bytes" }, { name: "operation", type: "uint8" },
          { name: "safeTxGas", type: "uint256" }, { name: "baseGas", type: "uint256" }, { name: "gasPrice", type: "uint256" },
          { name: "gasToken", type: "address" }, { name: "refundReceiver", type: "address" }, { name: "nonce", type: "uint256" },
        ],
      },
      domain: { chainId: 8453, verifyingContract: transaction.safe },
      primaryType: "SafeTx",
      message: {
        to: transaction.to, value: transaction.value, data: transaction.data, operation: transaction.operation ?? 0,
        safeTxGas: "0", baseGas: "0", gasPrice: "0", gasToken: zeroAddress, refundReceiver: zeroAddress, nonce: transaction.nonce,
      },
    };
    const signature: unknown = await wallet.provider.request({ method: "eth_signTypedData_v4", params: [address, JSON.stringify(typedData)] });
    if (typeof signature !== "string" || !/^0x[0-9a-fA-F]{130}$/.test(signature)) throw new Error("The wallet returned an unsupported signature.");
    return signature as Address;
  } catch (error) {
    throw walletError(error);
  }
}

const approvedHash = (owner: Address): Address => concatHex([padHex(owner, { size: 32 }), padHex("0x", { size: 32 }), "0x01"]);

export function executionSignatures(proposal: ProfileProposal, owners: readonly Address[], threshold: number, executor: Address | null): Address | null {
  const chosen = new Map<string, { owner: Address; data: Address }>();
  const add = (owner: Address, data: Address) => {
    if (chosen.size < threshold && !chosen.has(owner.toLowerCase()) && owners.some((candidate) => candidate.toLowerCase() === owner.toLowerCase())) chosen.set(owner.toLowerCase(), { owner, data });
  };
  if (executor) add(executor, approvedHash(executor));
  for (const approval of proposal.approvals) if (approval.via === "chain") add(approval.owner, approvedHash(approval.owner));
  for (const signature of proposal.signatures) add(signature.owner, signature.data as Address);
  if (chosen.size < threshold) return null;
  return concatHex([...chosen.values()].sort((a, b) => (BigInt(a.owner) < BigInt(b.owner) ? -1 : 1)).map((entry) => entry.data));
}

export async function executeSafeTransaction(wallet: BrowserWallet, address: Address, transaction: ProfileProposal["transaction"], signatures: Address): Promise<Address> {
  try {
    await ensureBase(wallet.provider);
    const data = encodeFunctionData({
      abi: executeAbi,
      functionName: "execTransaction",
      args: [transaction.to, BigInt(transaction.value), transaction.data as Address, transaction.operation ?? 0, 0n, 0n, 0n, zeroAddress, zeroAddress, signatures],
    });
    const hash: unknown = await wallet.provider.request({ method: "eth_sendTransaction", params: [{ from: address, to: transaction.safe, data, value: "0x0" }] });
    if (typeof hash !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(hash)) throw new Error("The wallet didn't return a transaction hash.");
    return hash as Address;
  } catch (error) {
    throw walletError(error);
  }
}
