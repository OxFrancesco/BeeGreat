import { useUser } from "@clerk/tanstack-react-start";
import { CheckIcon, LinkIcon, LogOutIcon, QrCodeIcon, WalletIcon } from "lucide-react";
import { Popover } from "radix-ui";
import { useState, useSyncExternalStore } from "react";
import { connectBrowserWallet, connectWalletConnect, currentWallet, disconnectBrowserWallet, useBrowserWallets, walletConnectInfo, type BrowserWallet, type ConnectedWallet } from "@/lib/browser-wallet";
import { linkConnectedWallet, useLinkedWallets, walletLabel } from "@/lib/linked-wallets";
import { errorText, shortAddress } from "@/lib/profile";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "../ui/dialog";

type Request = Readonly<{ reason: string | null; link: boolean }>;
let request: Request | null = null;
const listeners = new Set<() => void>();
const setRequest = (next: Request | null) => {
  request = next;
  for (const listener of listeners) listener();
};

/** Open the wallet picker. With `link`, the chosen wallet is linked to the account right after it connects. */
export function openConnectWallet(options: Partial<Request> = {}) {
  setRequest({ reason: options.reason ?? null, link: options.link ?? false });
}

function useConnectRequest() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => request,
    () => null,
  );
}

function WalletMark({ wallet }: { wallet: BrowserWallet }) {
  if (wallet.info.rdns === walletConnectInfo.rdns) return <QrCodeIcon className="size-4" aria-hidden="true" />;
  return wallet.info.icon.startsWith("data:image/") ? <img alt="" className="pecu-wallet-mark" src={wallet.info.icon} /> : <WalletIcon className="size-4" aria-hidden="true" />;
}

function LinkState({ connected }: { connected: ConnectedWallet }) {
  const { isSignedIn } = useUser();
  const { wallets } = useLinkedWallets(Boolean(isSignedIn));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!isSignedIn || wallets === null) return null;
  const linked = walletLabel(connected.address, wallets);
  if (linked) {
    return (
      <p className="pecu-profile-popover-state">
        <CheckIcon className="size-4" aria-hidden="true" />
        Linked as {linked}
      </p>
    );
  }
  return (
    <>
      <button
        className="pecu-button pecu-button-primary pecu-profile-popover-action"
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            await linkConnectedWallet(connected);
          } catch (reason) {
            setError(errorText(reason));
          } finally {
            setBusy(false);
          }
        }}
      >
        <LinkIcon className="size-4" aria-hidden="true" />
        {busy ? "Check your wallet…" : "Link to your account"}
      </button>
      {error ? <p className="pecu-error" role="alert">{error}</p> : null}
    </>
  );
}

/** The connected-wallet chip and the shared wallet picker. Without `chip`, only the picker is mounted. */
export function ConnectWallet({ chip = true }: Readonly<{ chip?: boolean }>) {
  const { wallets, connected } = useBrowserWallets();
  const pending = useConnectRequest();
  const [chosen, setChosen] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const open = pending !== null;
  const choose = async (key: string, connect: () => Promise<`0x${string}`>, ownModal = false) => {
    const asked = pending;
    setChosen(key);
    setError(null);
    // WalletConnect draws its own modal; ours would block its focus and pointer events.
    if (ownModal) setRequest(null);
    try {
      await connect();
      const current = currentWallet();
      if (asked?.link && current) await linkConnectedWallet(current);
      setRequest(null);
    } catch (reason) {
      setRequest(asked ?? { reason: null, link: false });
      setError(errorText(reason));
    } finally {
      setChosen(null);
    }
  };
  return (
    <>
      {!chip ? null : connected ? (
        <Popover.Root>
          <Popover.Trigger asChild>
            <button className="pecu-chip pecu-connected-wallet" type="button" aria-label={`Connected wallet ${connected.address}`}>
              <WalletMark wallet={connected.wallet} />
              <span className="mono">{shortAddress(connected.address)}</span>
            </button>
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content className="pecu pecu-profile-popover" side="bottom" align="end" sideOffset={8} collisionPadding={12}>
              <p className="pecu-profile-popover-title">{connected.wallet.info.name}</p>
              <p className="mono pecu-profile-popover-address">{connected.address}</p>
              <LinkState connected={connected} />
              <button className="pecu-button pecu-button-quiet pecu-profile-popover-action" type="button" onClick={disconnectBrowserWallet}>
                <LogOutIcon className="size-4" aria-hidden="true" />
                Disconnect
              </button>
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
      ) : (
        <button className="pecu-chip" type="button" onClick={() => openConnectWallet()}>
          <WalletIcon className="size-4" aria-hidden="true" />
          <span>Connect wallet</span>
        </button>
      )}
      <Dialog open={open} onOpenChange={(next) => { if (!next && chosen === null) { setRequest(null); setError(null); } }}>
        <DialogContent className="pecu pecu-profile-dialog">
          <DialogTitle className="pecu-profile-dialog-title">{pending?.link ? "Link a wallet" : "Connect a wallet"}</DialogTitle>
          <DialogDescription className="pecu-profile-dialog-description">
            {pending?.reason ?? (pending?.link
              ? "Choose the wallet, then sign a free message to prove it's yours. Pecu never sees its keys."
              : "Use a wallet you control to sign. Pecu never sees its keys.")}
          </DialogDescription>
          <ul className="pecu-wallet-options">
            {wallets.map((wallet) => (
              <li key={wallet.info.uuid}>
                <button className="pecu-wallet-option" type="button" disabled={chosen !== null} onClick={() => void choose(wallet.info.uuid, () => connectBrowserWallet(wallet))}>
                  <WalletMark wallet={wallet} />
                  <span>{wallet.info.name}</span>
                  {chosen === wallet.info.uuid ? <span className="pecu-wallet-option-state">Check your wallet…</span> : null}
                </button>
              </li>
            ))}
            <li>
              <button className="pecu-wallet-option" type="button" disabled={chosen !== null} onClick={() => void choose(walletConnectInfo.uuid, connectWalletConnect, true)}>
                <QrCodeIcon className="size-4" aria-hidden="true" />
                <span>{walletConnectInfo.name}</span>
              </button>
            </li>
          </ul>
          {!wallets.length ? <p className="pecu-profile-note">No browser wallet found. Use WalletConnect to scan with a phone wallet, or install a wallet extension such as Rabby.</p> : null}
          {error ? <p className="pecu-error" role="alert">{error}</p> : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
