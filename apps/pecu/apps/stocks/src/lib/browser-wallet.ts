import { z } from "zod";
import type { EIP1193Provider } from "viem";
import { useSyncExternalStore } from "react";
import { concatHex, encodeFunctionData, getAddress, numberToHex, padHex, parseAbi, stringToHex, zeroAddress } from "viem";
import type { WalletTransaction } from "../../../../src/linked-wallet-contract";
import type { ProfileProposal } from "../../../../src/safe-profile-contract";

type Address = `0x${string}`;
export type Eip1193Provider = Pick<EIP1193Provider, "request"> & Partial<Pick<EIP1193Provider, "on" | "removeListener">>;
const providerContract = z.object({ request: z.function(), on: z.function().optional(), removeListener: z.function().optional() });
const providerSchema = z.custom<Eip1193Provider>(value => providerContract.safeParse(value).success);
const walletInfoSchema = z.object({ uuid: z.string(), name: z.string().catch("Browser wallet"), icon: z.string().catch(""), rdns: z.string().catch("") });
const addressSchema = z.templateLiteral(["0x", z.string().regex(/^[0-9a-fA-F]{40}$/)]);
const bytesSchema = z.templateLiteral(["0x", z.string().regex(/^(?:[0-9a-fA-F]{2})*$/)]);
const signatureSchema = z.templateLiteral(["0x", z.string().regex(/^[0-9a-fA-F]{130}$/)]);
const transactionHashSchema = z.templateLiteral(["0x", z.string().regex(/^[0-9a-fA-F]{64}$/)]);
const providerErrorSchema = z.object({ code: z.number().optional().catch(undefined), message: z.string().optional().catch(undefined) });
export type BrowserWalletInfo = Readonly<{ uuid: string; name: string; icon: string; rdns: string }>;
export type BrowserWallet = Readonly<{ info: BrowserWalletInfo; provider: Eip1193Provider }>;
export type ConnectedWallet = Readonly<{ wallet: BrowserWallet; address: Address }>;
type Snapshot = Readonly<{ wallets: readonly BrowserWallet[]; connected: ConnectedWallet | null }>;

/** The wallet refused the request. Nothing was signed or sent. */
export class WalletDeclinedError extends Error {}
/** The wallet wasn't on the right account or network, so nothing was sent. */
export class WalletNotReadyError extends Error {}

const baseChainId = "0x2105";
const storageKey = "pecu-browser-wallet";
/** Reown (WalletConnect) project ids are public. The Reown dashboard limits which origins may use it. */
const reownProjectId = import.meta.env.VITE_REOWN_PROJECT_ID?.trim() || "cebb813303780775ef7c4a93f1daadee";
export const walletConnectInfo: BrowserWalletInfo = { uuid: "walletconnect", name: "WalletConnect", icon: "", rdns: "walletconnect" };

type WalletConnectSession = Readonly<{ wallet: BrowserWallet; connect(): Promise<void>; disconnect(): Promise<void>; accounts(): readonly string[]; connected(): boolean }>;
let walletConnect: Promise<WalletConnectSession> | undefined;
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

function announce(event: Event) {
  if (!(event instanceof CustomEvent)) return;
  const detail = z.object({ info: walletInfoSchema, provider: providerSchema }).safeParse(event.detail);
  if (!detail.success) return;
  const wallet = detail.data;
  if (!wallet.info.name) wallet.info.name = "Browser wallet";
  if (!wallet.info.uuid || snapshot.wallets.some((known) => known.info.uuid === wallet.info.uuid)) return;
  publish({ wallets: [...snapshot.wallets, wallet] });
  void restore(wallet);
}

function savedWallet(): string | null {
  try {
    return z.object({ rdns: z.string() }).safeParse(JSON.parse(localStorage.getItem(storageKey) ?? "null")).data?.rdns ?? null;
  } catch {
    return null;
  }
}

function start() {
  if (started || !("window" in globalThis)) return;
  started = true;
  window.addEventListener("eip6963:announceProvider", announce);
  window.dispatchEvent(new Event("eip6963:requestProvider"));
  if (savedWallet() === walletConnectInfo.rdns) void restoreWalletConnect();
  window.setTimeout(() => {
    const injected = z.object({ ethereum: providerSchema }).safeParse(window);
    if (!snapshot.wallets.length && injected.success) {
      const wallet: BrowserWallet = { info: { uuid: "injected", name: "Browser wallet", icon: "", rdns: "injected" }, provider: injected.data.ethereum };
      publish({ wallets: [wallet] });
      void restore(wallet);
    }
  }, 400);
}

function accounts(value: readonly string[]): Address[] {
  return z.array(z.string()).catch([]).parse(value).flatMap(item => {
    const address = addressSchema.safeParse(item);
    return address.success ? [getAddress(address.data)] : [];
  });
}

function watch(wallet: BrowserWallet) {
  detach?.();
  const changed = (value: string[]) => {
    const [address] = accounts(value);
    if (!address) return disconnectBrowserWallet();
    publish({ connected: { wallet, address } });
    localStorage.setItem(storageKey, JSON.stringify({ rdns: wallet.info.rdns, address }));
  };
  const ended = () => disconnectBrowserWallet();
  wallet.provider.on?.("accountsChanged", changed);
  wallet.provider.on?.("disconnect", ended);
  detach = () => {
    wallet.provider.removeListener?.("accountsChanged", changed);
    wallet.provider.removeListener?.("disconnect", ended);
  };
}

function use(wallet: BrowserWallet, address: Address): Address {
  publish({ connected: { wallet, address } });
  localStorage.setItem(storageKey, JSON.stringify({ rdns: wallet.info.rdns, address }));
  watch(wallet);
  return address;
}

async function restore(wallet: BrowserWallet) {
  if (snapshot.connected || savedWallet() !== wallet.info.rdns) return;
  try {
    const [address] = accounts(await wallet.provider.request({ method: "eth_accounts" }));
    if (address) use(wallet, address);
  } catch {
    localStorage.removeItem(storageKey);
  }
}

export async function connectBrowserWallet(wallet: BrowserWallet): Promise<Address> {
  const [address] = accounts(await wallet.provider.request({ method: "eth_requestAccounts" }));
  if (!address) throw new Error("The wallet didn't share an account.");
  return use(wallet, address);
}

/** Loaded on demand in the browser, so neither the server bundle nor first paint pays for WalletConnect. */
function loadWalletConnect(): Promise<WalletConnectSession> {
  if (import.meta.env.SSR) return Promise.reject(new Error("WalletConnect runs in the browser."));
  if (walletConnect) return walletConnect;
  const pending = import("@walletconnect/ethereum-provider").then(async ({ EthereumProvider }) => {
    const origin = window.location.origin;
    const provider = await EthereumProvider.init({
      projectId: reownProjectId,
      optionalChains: [8453],
      showQrModal: true,
      rpcMap: { 8453: "https://mainnet.base.org" },
      metadata: { name: "Pecu", description: "Link your wallet to Pecu on Base.", url: origin, icons: [`${origin}/pecu-assets/icon-192.png`] },
      qrModalOptions: { themeMode: "light" },
    });
    return {
      wallet: { info: walletConnectInfo, provider: providerSchema.parse(provider) },
      connect: () => provider.connect(),
      disconnect: () => provider.disconnect(),
      accounts: () => provider.accounts,
      connected: () => Boolean(provider.session),
    };
  });
  walletConnect = pending;
  pending.catch(() => {
    if (walletConnect === pending) walletConnect = undefined;
  });
  return pending;
}

async function restoreWalletConnect() {
  try {
    const session = await loadWalletConnect();
    const [address] = accounts(session.accounts());
    if (session.connected() && address && !snapshot.connected) use(session.wallet, address);
  } catch {
    localStorage.removeItem(storageKey);
  }
}

/** Opens the WalletConnect QR and mobile-wallet modal, or reuses an existing session. */
export async function connectWalletConnect(): Promise<Address> {
  const session = await loadWalletConnect();
  try {
    if (!session.connected()) await session.connect();
  } catch (error) {
    throw walletError(error);
  }
  const [address] = accounts(session.accounts());
  if (!address) throw new Error("The wallet didn't share an account.");
  return use(session.wallet, address);
}

export function disconnectBrowserWallet() {
  const wallet = snapshot.connected?.wallet;
  detach?.();
  detach = undefined;
  localStorage.removeItem(storageKey);
  publish({ connected: null });
  if (wallet?.info.rdns === walletConnectInfo.rdns) void walletConnect?.then((session) => session.disconnect()).catch(() => undefined);
}

export const currentWallet = (): ConnectedWallet | null => snapshot.connected;

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

function walletError(cause: unknown): Error {
  if (cause instanceof WalletNotReadyError || cause instanceof WalletDeclinedError) return cause;
  const details = providerErrorSchema.safeParse(cause).data;
  if (details?.code === 4001 || /user (?:rejected|denied)|rejected by user/i.test(details?.message ?? "")) return new WalletDeclinedError("You declined the request in your wallet.");
  if (/connection request reset/i.test(details?.message ?? "")) return new WalletDeclinedError("WalletConnect closed before a wallet connected.");
  if (/failed to publish|origin not allowed|socket/i.test(details?.message ?? "")) return new Error("WalletConnect couldn't connect from this site. Try again later, or use a browser wallet.");
  const message = details?.message;
  return new Error(message !== undefined && message.length < 200 ? message : "Your wallet couldn't complete the request.");
}

/** Sign Pecu's Sign-In with Ethereum link message. The server verifies it against the exact stored text. */
export async function signWalletLink(wallet: BrowserWallet, address: Address, message: string): Promise<Address> {
  try {
    const signature = signatureSchema.safeParse(await wallet.provider.request({ method: "personal_sign", params: [stringToHex(message), address] }));
    if (!signature.success) throw new Error("Pecu links wallets that sign with their own key. This wallet returned a different kind of signature.");
    return signature.data;
  } catch (error) {
    throw walletError(error);
  }
}

/** Send one exact server-built call from the connected wallet after checking the account and network. */
export async function sendWalletTransaction(wallet: BrowserWallet, address: Address, transaction: WalletTransaction): Promise<Address> {
  try {
    try {
      await ensureBase(wallet.provider);
      const [active] = accounts(await wallet.provider.request({ method: "eth_accounts" }));
      if (!active || active.toLowerCase() !== transaction.from.toLowerCase() || active.toLowerCase() !== address.toLowerCase()) {
        throw new WalletNotReadyError(`Switch your wallet to ${transaction.from.slice(0, 6)}…${transaction.from.slice(-4)} and try again.`);
      }
    } catch (error) {
      const failure = walletError(error);
      throw failure instanceof WalletDeclinedError || failure instanceof WalletNotReadyError ? failure : new WalletNotReadyError("Switch your wallet to Base and try again.");
    }
    const hash = transactionHashSchema.safeParse(await wallet.provider.request({
      method: "eth_sendTransaction",
      params: [{ from: transaction.from, to: transaction.to, data: transaction.data, value: numberToHex(BigInt(transaction.value)) }],
    }));
    if (!hash.success) throw new Error("The wallet didn't return a transaction hash.");
    return hash.data;
  } catch (error) {
    throw walletError(error);
  }
}

async function ensureBase(provider: Eip1193Provider) {
  if (String(await provider.request({ method: "eth_chainId" })).toLowerCase() === baseChainId) return;
  try {
    await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: baseChainId }] });
  } catch (error) {
    if (providerErrorSchema.safeParse(error).data?.code !== 4902) throw error;
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
    const signature = await wallet.provider.request({ method: "eth_signTypedData_v4", params: [address, JSON.stringify(typedData)] });
    const parsed = z.templateLiteral(["0x", z.string().regex(/^[0-9a-fA-F]{130}$/)]).safeParse(signature);
    if (!parsed.success) throw new Error("The wallet returned an unsupported signature.");
    return parsed.data;
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
  for (const signature of proposal.signatures) add(signature.owner, bytesSchema.parse(signature.data));
  if (chosen.size < threshold) return null;
  return concatHex([...chosen.values()].sort((a, b) => (BigInt(a.owner) < BigInt(b.owner) ? -1 : 1)).map((entry) => entry.data));
}

export async function executeSafeTransaction(wallet: BrowserWallet, address: Address, transaction: ProfileProposal["transaction"], signatures: Address): Promise<Address> {
  try {
    await ensureBase(wallet.provider);
    const data = encodeFunctionData({
      abi: executeAbi,
      functionName: "execTransaction",
      args: [transaction.to, BigInt(transaction.value), bytesSchema.parse(transaction.data), transaction.operation ?? 0, 0n, 0n, 0n, zeroAddress, zeroAddress, signatures],
    });
    const hash = await wallet.provider.request({ method: "eth_sendTransaction", params: [{ from: address, to: transaction.safe, data, value: "0x0" }] });
    const parsed = z.templateLiteral(["0x", z.string().regex(/^[0-9a-fA-F]{64}$/)]).safeParse(hash);
    if (!parsed.success) throw new Error("The wallet didn't return a transaction hash.");
    return parsed.data;
  } catch (error) {
    throw walletError(error);
  }
}
