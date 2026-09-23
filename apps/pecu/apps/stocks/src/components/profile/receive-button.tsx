import { QrCodeIcon, XIcon } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { Popover } from "radix-ui";
import { CopyButton } from "../copy-button";

export function ReceiveButton({ address }: { address: string }) {
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button className="pecu-button pecu-safe-receive" type="button">
          <QrCodeIcon className="size-4" aria-hidden="true" />
          Receive
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content className="pecu pecu-wallet-qr" aria-label="Receive to this Safe" side="bottom" align="end" sideOffset={8} collisionPadding={12}>
          <Popover.Close className="pecu-wallet-qr-close" aria-label="Close">
            <XIcon size={16} />
          </Popover.Close>
          <QRCodeSVG value={address} size={208} marginSize={4} level="M" role="img" aria-label="Scan the Safe address" />
          <div className="pecu-receive-copy">
            <span className="mono pecu-wallet-full-address">{address}</span>
            <CopyButton text={address} label="Copy Safe address" className="pecu-address-copy" />
          </div>
          <p>Send only assets on Base to this address.</p>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
