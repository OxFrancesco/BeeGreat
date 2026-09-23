import { ExternalLinkIcon } from "lucide-react";
import { CopyButton } from "../copy-button";
import { shortAddress } from "@/lib/profile";

export function AddressLine({ address, label, full = false, explorer = false }: { address: string; label?: string | null; full?: boolean; explorer?: boolean }) {
  return (
    <span className="pecu-address-line">
      {label ? <span className="pecu-address-label">{label}</span> : null}
      <span className="mono pecu-address-value" title={address}>
        {full ? address : shortAddress(address)}
      </span>
      <CopyButton text={address} label={`Copy ${label ?? "address"}`} className="pecu-address-copy" />
      {explorer ? (
        <a className="pecu-address-explorer" href={`https://basescan.org/address/${address}`} target="_blank" rel="noreferrer" aria-label="View on Basescan">
          <ExternalLinkIcon className="size-3.5" />
        </a>
      ) : null}
    </span>
  );
}
