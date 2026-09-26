import { ArrowLeftRightIcon, CheckIcon, LogOutIcon, PlusIcon } from "lucide-react";
import { Popover } from "radix-ui";
import { useState } from "react";
import type { LinkedWallet } from "../../../../src/linked-wallet-contract";
import { disconnectBrowserWallet, useBrowserWallets } from "@/lib/browser-wallet";
import { chooseThreadWallet, useLinkedWallets } from "@/lib/linked-wallets";
import { errorText, sameAddress, shortAddress } from "@/lib/profile";
import { openConnectWallet } from "./profile/connect-wallet";

type Address = `0x${string}`;

/** The wallets a thread can use: the Pecu wallet first, then linked wallets. */
export function WalletOptions({ pecuWallet, signer, wallets, busy = false, onChoose }: Readonly<{
  pecuWallet: string;
  signer: string | null;
  wallets: readonly LinkedWallet[];
  busy?: boolean;
  onChoose: (address: Address | null) => void;
}>) {
  const options = [{ address: null, name: "Pecu wallet", shown: pecuWallet }, ...wallets.map((wallet) => ({ address: wallet.address, name: wallet.name ?? "Your wallet", shown: wallet.address }))];
  const active = wallets.find((wallet) => sameAddress(wallet.address, signer))?.address ?? null;
  return (
    <ul className="pecu-wallet-switch-list" aria-label="Wallet for this thread">
      {options.map((option) => {
        const selected = option.address === active;
        return (
          <li key={option.address ?? "pecu"}>
            <button className="pecu-wallet-switch-option" type="button" aria-pressed={selected} disabled={busy} onClick={() => onChoose(option.address)}>
              <span className="pecu-wallet-switch-name">{option.name}</span>
              <span className="mono pecu-wallet-switch-address">{shortAddress(option.shown)}</span>
              {selected ? <CheckIcon className="size-4" aria-hidden="true" /> : <span aria-hidden="true" />}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/** Switches which wallet the thread reads and prepares transactions for. */
export function WalletSwitch({ threadId, pecuWallet, signer, onChanged, onError }: Readonly<{
  threadId: string | null;
  pecuWallet: string;
  signer: string | null;
  onChanged: () => void;
  onError: (message: string) => void;
}>) {
  const { wallets } = useLinkedWallets(true);
  const { connected } = useBrowserWallets();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const current = wallets?.find((wallet) => sameAddress(wallet.address, signer))?.address ?? null;
  const choose = async (address: Address | null) => {
    if (address === current) return setOpen(false);
    setBusy(true);
    try {
      await chooseThreadWallet(threadId, address);
      setOpen(false);
      onChanged();
    } catch (reason) {
      onError(errorText(reason));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button className="pecu-wallet-copy" type="button" aria-label="Switch wallet">
          <ArrowLeftRightIcon size={16} />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content className="pecu pecu-profile-popover" side="bottom" align="end" sideOffset={8} collisionPadding={12}>
          <WalletOptions pecuWallet={pecuWallet} signer={signer} wallets={wallets ?? []} busy={busy} onChoose={(address) => void choose(address)} />
          <div className="pecu-wallet-switch-actions">
            <button
              className="pecu-button pecu-button-quiet pecu-profile-popover-action"
              type="button"
              onClick={() => {
                setOpen(false);
                openConnectWallet({ link: true });
              }}
            >
              <PlusIcon className="size-4" aria-hidden="true" />
              Link a wallet
            </button>
            {connected ? (
              <button className="pecu-button pecu-button-quiet pecu-profile-popover-action" type="button" onClick={disconnectBrowserWallet}>
                <LogOutIcon className="size-4" aria-hidden="true" />
                Disconnect {connected.wallet.info.name}
              </button>
            ) : null}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
