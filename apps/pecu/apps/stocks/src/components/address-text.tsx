import { shortAddress } from "../lib/profile";

/** Keep full addresses available to keyboard, pointer and touch users. */
export function AddressText({ text }: { text: string }) {
  return text.split(/(0x[\da-fA-F]{40})(?![\da-fA-F])/g).map((part, index) =>
    /^0x[\da-fA-F]{40}$/.test(part) ? (
      <span className="pecu-expand-address mono" tabIndex={0} aria-label={part} key={index}>
        <span className="pecu-address-short" aria-hidden="true">{shortAddress(part)}</span>
        <span className="pecu-address-expanded" aria-hidden="true">{part}</span>
      </span>
    ) : part,
  );
}
