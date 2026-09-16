import { CheckIcon, CopyIcon, XIcon } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { Popover } from "radix-ui";
import { useEffect, useRef, useState } from "react";

export function WalletChip({ address }: { address: string }) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<"idle" | "copied" | "error">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const feedback = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pinned = useRef(false);
  const cancel = () => clearTimeout(timer.current);
  const reveal = () => {
    cancel();
    timer.current = setTimeout(() => setOpen(true), 1_000);
  };
  const dismiss = () => {
    cancel();
    if (pinned.current) return;
    timer.current = setTimeout(() => setOpen(false), 150);
  };
  useEffect(
    () => () => {
      clearTimeout(timer.current);
      clearTimeout(feedback.current);
    },
    [],
  );
  const copy = async () => {
    cancel();
    pinned.current = true;
    setOpen(true);
    clearTimeout(feedback.current);
    try {
      await navigator.clipboard.writeText(address);
      setStatus("copied");
      feedback.current = setTimeout(() => setStatus("idle"), 2_000);
    } catch {
      setStatus("error");
    }
  };

  return (
    <div className="pecu-chip pecu-wallet">
      <a
        className="pecu-wallet-address mono"
        href={`https://basescan.org/address/${address}`}
        target="_blank"
        rel="noreferrer"
        title={address}
      >
        {address.slice(0, 6)}…{address.slice(-4)}
      </a>
      <Popover.Root
        open={open}
        onOpenChange={(value) => {
          cancel();
          if (!value) pinned.current = false;
          setOpen(value);
        }}
      >
        <Popover.Trigger asChild>
          <button
            aria-label="Copy wallet address"
            aria-haspopup="dialog"
            aria-expanded={open}
            className="pecu-wallet-copy"
            type="button"
            onPointerEnter={(event) => {
              if (event.pointerType !== "touch") reveal();
            }}
            onPointerLeave={(event) => {
              if (event.pointerType !== "touch") dismiss();
            }}
            onFocus={reveal}
            onBlur={cancel}
            onClick={(event) => {
              event.preventDefault();
              void copy();
            }}
          >
            {status === "copied" ? <CheckIcon size={16} /> : <CopyIcon size={16} />}
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            className="pecu pecu-wallet-qr"
            aria-label="Wallet QR code"
            side="bottom"
            align="end"
            sideOffset={8}
            collisionPadding={12}
            onOpenAutoFocus={(event) => event.preventDefault()}
            onCloseAutoFocus={(event) => event.preventDefault()}
            onPointerEnter={cancel}
            onPointerLeave={(event) => {
              if (event.pointerType !== "touch") dismiss();
            }}
          >
            <Popover.Close className="pecu-wallet-qr-close" aria-label="Close wallet QR code">
              <XIcon size={16} />
            </Popover.Close>
            <QRCodeSVG value={address} size={208} marginSize={4} level="M" role="img" aria-label="Scan wallet address" />
            <div className="mono pecu-wallet-full-address">{address}</div>
            {status === "error" ? <p role="alert">Couldn't copy. Select the address above to copy it.</p> : null}
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
      <span className="sr-only" role="status">{status === "copied" ? "Wallet address copied" : ""}</span>
    </div>
  );
}
