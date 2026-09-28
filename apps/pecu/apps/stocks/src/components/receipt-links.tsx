import { ExternalLinkIcon } from "lucide-react";
import { useState } from "react";
import type { ReceiptLink } from "../lib/receipt-presentation";

export function ReceiptLinks({ links }: { links: readonly ReceiptLink[] }) {
  const [expanded, setExpanded] = useState(false);
  return <div className="pecu-receipt-links">
    {(expanded ? links : links.slice(0, 3)).map((link, index) => {
      const label = link.label === "View transaction" && links.length > 1 ? `View transaction ${index + 1}` : link.label;
      return <a key={`${link.hash}:${link.label}`} href={link.url} target="_blank" rel="noreferrer" className="pecu-button pecu-receipt-link" aria-label={`${label} on Basescan, ${link.hash}`}>
        <span>{label}</span><ExternalLinkIcon size={16} aria-hidden="true" />
      </a>;
    })}
    {links.length > 3 ? <button type="button" className="pecu-inline-link" onClick={() => setExpanded(!expanded)} aria-expanded={expanded}>{expanded ? "Show fewer transactions" : "Show all transactions"}</button> : null}
  </div>;
}
