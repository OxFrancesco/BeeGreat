import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AddressLine } from "../../stocks/src/components/profile/address-line";
import { WalletOptions } from "../../stocks/src/components/wallet-switch";
import type { LinkedWallet } from "../../../src/linked-wallet-contract";

const noop = () => {};
const wallets: LinkedWallet[] = [
  { address: "0x5151515151515151515151515151515151515151", name: "Rabby", linkedAt: 1 },
  { address: "0x7A7a7a7A7a7a7a7A7a7a7a7A7A7a7A7a7a7A7a7a", name: null, linkedAt: 2 },
];

const rows = wallets
  .map((wallet) => `<li>${renderToStaticMarkup(createElement(AddressLine, { address: wallet.address, label: wallet.name ?? "Your wallet", explorer: true }))}</li>`)
  .join("");
const picker = renderToStaticMarkup(createElement(WalletOptions, { pecuWallet: "0x1234567890123456789012345678901234567890", signer: wallets[0]?.address ?? null, wallets, onChoose: noop }));

export const linkedWalletSpecimen = `<div class="pecu linked-wallet-specimen"><ul class="pecu-owner-list">${rows}</ul><div class="pecu pecu-profile-popover">${picker}</div></div>`;
