import { PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";
import type { LinkedWallet } from "../../../../../src/linked-wallet-contract";
import { useBrowserWallets } from "@/lib/browser-wallet";
import { refreshLinkedWallets, renameWallet, unlinkWallet, useLinkedWallets } from "@/lib/linked-wallets";
import { sameAddress } from "@/lib/profile";
import { Button } from "../ui/button";
import { AddressLine } from "./address-line";
import { openConnectWallet } from "./connect-wallet";
import { ConfirmDialog, NameDialog } from "./profile-dialogs";

export function LinkedWallets() {
  const { wallets, error } = useLinkedWallets(true);
  const { connected } = useBrowserWallets();
  const [renaming, setRenaming] = useState<LinkedWallet | null>(null);
  const [removing, setRemoving] = useState<LinkedWallet | null>(null);
  const label = (wallet: LinkedWallet | null) => wallet?.name ?? "this wallet";
  return (
    <div className="pecu-profile-wallet">
      <div className="pecu-profile-section-head">
        <h2 id="pecu-linked-wallets">Your wallets</h2>
        <Button className="pecu-button" onClick={() => openConnectWallet({ link: true })}>
          <PlusIcon className="size-4" />
          Link a wallet
        </Button>
      </div>
      {wallets === null ? (
        error ? (
          <div className="pecu-error" role="alert">
            <span>{error}</span>
            <Button className="pecu-inline-link" variant="link" size="sm" onClick={() => void refreshLinkedWallets()}>Try again</Button>
          </div>
        ) : null
      ) : wallets.length ? (
        <ul className="pecu-owner-list" aria-labelledby="pecu-linked-wallets">
          {wallets.map((wallet) => (
            <li key={wallet.address}>
              <AddressLine address={wallet.address} label={wallet.name ?? "Your wallet"} explorer />
              <div className="pecu-owner-actions">
                {sameAddress(connected?.address, wallet.address) ? <span className="pecu-linked-state">Connected</span> : null}
                <Button className="pecu-button pecu-button-quiet" aria-label={`Rename ${label(wallet)}`} onClick={() => setRenaming(wallet)}><PencilIcon className="size-4" /></Button>
                <Button className="pecu-button pecu-button-quiet" aria-label={`Unlink ${label(wallet)}`} onClick={() => setRemoving(wallet)}><Trash2Icon className="size-4" /></Button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="pecu-profile-note">Link wallets you control to sign with them in chat and add them as Safe owners.</p>
      )}
      <NameDialog
        open={renaming !== null}
        title="Name this wallet"
        label="Name"
        initial={renaming?.name ?? ""}
        submitLabel="Save"
        onClose={() => setRenaming(null)}
        onSave={async (name) => {
          if (renaming) await renameWallet(renaming.address, name);
        }}
      />
      <ConfirmDialog
        open={removing !== null}
        title={`Unlink ${label(removing)}?`}
        body="Pecu stops offering it in chat and Safe forms. Transactions it already sent stay on Base, and it stays an owner of any Safe until the owners remove it."
        confirmLabel="Unlink wallet"
        onClose={() => setRemoving(null)}
        onConfirm={async () => {
          if (removing) await unlinkWallet(removing.address);
        }}
      />
    </div>
  );
}
