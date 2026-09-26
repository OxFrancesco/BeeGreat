import { WalletIcon } from "lucide-react";
import { useState } from "react";
import type { LinkedWallet } from "../../../../src/linked-wallet-contract";
import { chooseThreadWallet, walletOptionLabel } from "@/lib/linked-wallets";
import { errorText } from "@/lib/profile";

/** Chooses which wallet this chat thread reads and prepares transactions for. */
export function ThreadWallet({ threadId, signer, wallets, disabled, onChanged, onError }: Readonly<{
  threadId: string | null;
  signer: string | null;
  wallets: readonly LinkedWallet[];
  disabled: boolean;
  onChanged: () => void;
  onError: (message: string) => void;
}>) {
  const [busy, setBusy] = useState(false);
  const selected = wallets.find((wallet) => wallet.address.toLowerCase() === signer?.toLowerCase())?.address ?? "";
  return (
    <label className="pecu-thread-wallet">
      <WalletIcon className="size-3.5" aria-hidden="true" />
      <span className="sr-only">Wallet for this thread</span>
      <select
        value={selected}
        disabled={disabled || busy}
        onChange={async (event) => {
          const address = wallets.find((wallet) => wallet.address === event.currentTarget.value)?.address ?? null;
          setBusy(true);
          try {
            await chooseThreadWallet(threadId, address);
            onChanged();
          } catch (reason) {
            onError(errorText(reason));
          } finally {
            setBusy(false);
          }
        }}
      >
        <option value="">Pecu wallet</option>
        {wallets.map((wallet) => <option key={wallet.address} value={wallet.address}>{walletOptionLabel(wallet)}</option>)}
      </select>
    </label>
  );
}
