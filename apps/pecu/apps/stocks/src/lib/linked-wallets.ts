import { useEffect, useSyncExternalStore } from "react";
import {
  linkedWalletActionSchema,
  linkedWalletResultSchema,
  linkedWalletsSchema,
  type LinkedStep,
  type LinkedWallet,
  type LinkedWalletAction,
} from "../../../../src/linked-wallet-contract";
import { sendWalletTransaction, signWalletLink, WalletDeclinedError, WalletNotReadyError, type ConnectedWallet } from "./browser-wallet";
import { errorText } from "./profile";
import { request } from "./use-account";

type Address = `0x${string}`;
type Snapshot = Readonly<{ wallets: readonly LinkedWallet[] | null; error: string | null }>;

let snapshot: Snapshot = { wallets: null, error: null };
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();

function publish(next: Partial<Snapshot>) {
  snapshot = { ...snapshot, ...next };
  for (const listener of listeners) listener();
}

export async function refreshLinkedWallets(): Promise<void> {
  loading ??= request("wallets")
    .then((raw) => publish({ wallets: linkedWalletsSchema.parse(raw).wallets, error: null }))
    .catch((error) => publish({ error: errorText(error) }))
    .finally(() => { loading = null; });
  return loading;
}

/** The signed-in account's linked wallets, shared by the profile, Safe forms and chat. */
export function useLinkedWallets(signedIn: boolean): Snapshot {
  const state = useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => snapshot,
    () => snapshot,
  );
  useEffect(() => {
    if (signedIn && snapshot.wallets === null) void refreshLinkedWallets();
    if (!signedIn && snapshot.wallets !== null) publish({ wallets: null, error: null });
  }, [signedIn]);
  return state;
}

async function walletAction(raw: LinkedWalletAction) {
  return linkedWalletResultSchema.parse(await request("wallet", linkedWalletActionSchema.parse(raw)));
}

async function walletsAction(raw: LinkedWalletAction): Promise<readonly LinkedWallet[]> {
  const result = await walletAction(raw);
  if (result.kind !== "wallets") throw new Error("Pecu returned an unexpected wallet response.");
  publish({ wallets: result.wallets, error: null });
  return result.wallets;
}

async function stepAction(raw: LinkedWalletAction): Promise<LinkedStep> {
  const result = await walletAction(raw);
  if (result.kind !== "step") throw new Error("Pecu returned an unexpected wallet response.");
  return result.step;
}

/** Prove control of the connected wallet with a free signature, then add it to the account. */
export async function linkConnectedWallet({ wallet, address }: ConnectedWallet): Promise<readonly LinkedWallet[]> {
  const challenge = await walletAction({ op: "challenge", address });
  if (challenge.kind !== "challenge") throw new Error("Pecu returned an unexpected wallet response.");
  const signature = await signWalletLink(wallet, address, challenge.message);
  return walletsAction({ op: "link", challenge: challenge.challenge, signature });
}

export const unlinkWallet = (address: Address) => walletsAction({ op: "unlink", address });
export const renameWallet = (address: Address, name: string) => walletsAction({ op: "rename", address, name });
export const chooseThreadWallet = (threadId: string | null, address: Address | null) => walletsAction({ op: "use", threadId, address });

export function walletLabel(address: string | null | undefined, wallets: readonly LinkedWallet[] | null): string | null {
  const wallet = address ? wallets?.find((item) => item.address.toLowerCase() === address.toLowerCase()) : undefined;
  return wallet ? wallet.name ?? "Your wallet" : null;
}

export const walletOptionLabel = (wallet: LinkedWallet) => `${wallet.name ?? "Your wallet"} · ${wallet.address.slice(0, 6)}…${wallet.address.slice(-4)}`;

const pause = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));

/**
 * Drive a chat preview that a linked wallet signs. Pecu hands out one exact
 * call at a time; the wallet sends it and Pecu settles it from Base before
 * handing out the next. Returns when the preview settles, needs attention, or
 * is still waiting for Base after a couple of minutes.
 */
export async function confirmWithWallet({ code, threadId, connected, resend = false }: Readonly<{ code: string; threadId: string | null; connected: ConnectedWallet; resend?: boolean }>): Promise<LinkedStep> {
  let again = resend;
  let last: LinkedStep | null = null;
  for (let round = 0; round < 60; round += 1) {
    const step = await stepAction({ op: "step", threadId, code, resend: again });
    again = false;
    last = step;
    if (step.kind === "status" || step.kind === "unreported") return step;
    if (step.kind === "waiting") {
      await pause(2_500);
      continue;
    }
    let hash: Address;
    try {
      hash = await sendWalletTransaction(connected.wallet, connected.address, step.transaction);
    } catch (error) {
      if (error instanceof WalletDeclinedError || error instanceof WalletNotReadyError) {
        const released = await stepAction({ op: "declined", threadId, code, position: step.position });
        if (error instanceof WalletNotReadyError) throw error;
        return released;
      }
      throw error;
    }
    last = await stepAction({ op: "submitted", threadId, code, position: step.position, hash });
  }
  return last ?? { kind: "status", state: "executing", message: "Waiting for Base to include the transaction." };
}
