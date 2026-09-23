import { LogOutIcon, WalletIcon } from "lucide-react";
import { Popover } from "radix-ui";
import { useState } from "react";
import { connectBrowserWallet, disconnectBrowserWallet, useBrowserWallets, type BrowserWallet } from "@/lib/browser-wallet";
import { errorText, shortAddress } from "@/lib/profile";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "../ui/dialog";

function WalletMark({ wallet }: { wallet: BrowserWallet }) {
  return wallet.info.icon.startsWith("data:image/") ? <img alt="" className="pecu-wallet-mark" src={wallet.info.icon} /> : <WalletIcon className="size-4" aria-hidden="true" />;
}

export function ConnectWallet() {
  const { wallets, connected } = useBrowserWallets();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (connected) {
    return (
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
            <button className="pecu-button pecu-button-quiet pecu-profile-popover-action" type="button" onClick={disconnectBrowserWallet}>
              <LogOutIcon className="size-4" aria-hidden="true" />
              Disconnect
            </button>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    );
  }
  return (
    <Dialog open={open} onOpenChange={(next) => { setOpen(next); setError(null); }}>
      <button className="pecu-chip" type="button" onClick={() => setOpen(true)}>
        <WalletIcon className="size-4" aria-hidden="true" />
        <span>Connect wallet</span>
      </button>
      <DialogContent className="pecu pecu-profile-dialog">
        <DialogTitle className="pecu-profile-dialog-title">Connect a wallet</DialogTitle>
        <DialogDescription className="pecu-profile-dialog-description">
          Use a wallet you control to sign and execute Safe transactions. Pecu never sees its keys.
        </DialogDescription>
        {wallets.length ? (
          <ul className="pecu-wallet-options">
            {wallets.map((wallet) => (
              <li key={wallet.info.uuid}>
                <button
                  className="pecu-wallet-option"
                  type="button"
                  disabled={pending !== null}
                  onClick={async () => {
                    setPending(wallet.info.uuid);
                    setError(null);
                    try {
                      await connectBrowserWallet(wallet);
                      setOpen(false);
                    } catch (reason) {
                      setError(errorText(reason));
                    } finally {
                      setPending(null);
                    }
                  }}
                >
                  <WalletMark wallet={wallet} />
                  <span>{wallet.info.name}</span>
                  {pending === wallet.info.uuid ? <span className="pecu-wallet-option-state">Check your wallet…</span> : null}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="pecu-profile-note">No browser wallet found. Install a wallet extension such as Rabby or MetaMask, then reload this page.</p>
        )}
        {error ? <p className="pecu-error" role="alert">{error}</p> : null}
      </DialogContent>
    </Dialog>
  );
}
