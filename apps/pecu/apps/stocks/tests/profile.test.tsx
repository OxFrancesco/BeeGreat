import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { SafeTransactions } from "../src/components/profile/safe-transactions";
import { executionSignatures } from "../src/lib/browser-wallet";
import { confirmationLabel } from "../src/lib/preview";
import { addressLabel, profileAction } from "../src/lib/profile";
import { alice, bob, pecuWallet, pendingOwner, pendingSend, treasuryDetail } from "./fixtures/safe-profile";

const approved = (owner: string) => `${owner.slice(2).toLowerCase().padStart(64, "0")}${"0".repeat(64)}01`;

test("browser execution uses the executor's own approval plus collected signatures, sorted by owner", () => {
  const owners = treasuryDetail.owners;
  const signatures = executionSignatures(pendingSend, owners, 2, bob)?.toLowerCase();
  expect(signatures).toBe(`0x${[pendingSend.signatures[0]!.data.slice(2), approved(bob)].join("")}`);
  expect(executionSignatures(pendingSend, owners, 2, "0x9999999999999999999999999999999999999999")).toBeNull();
  expect(executionSignatures({ ...pendingSend, approvals: [...pendingSend.approvals, { owner: pecuWallet, via: "chain" }] }, owners, 2, null)?.toLowerCase())
    .toBe(`0x${[approved(pecuWallet), pendingSend.signatures[0]!.data.slice(2)].join("")}`);
});

test("the queue shows who approved, what is missing and only the actions this viewer can take", () => {
  const html = renderToStaticMarkup(<SafeTransactions detail={treasuryDetail} onChanged={() => {}} onIntent={() => {}} onReject={() => {}} />);
  expect(html).toContain("Send 2500 USDC");
  expect(html).toContain("Signed");
  expect(html).toContain("Alice");
  expect(html).toContain("Your Pecu wallet");
  expect(html).toContain("Needs 1 more approval. Executing from an owner wallet counts as its approval.");
  expect(html).toContain("Execute with Pecu wallet");
  expect(html).toContain("Approve with Pecu wallet");
  expect(html).toContain("These share one position");
  expect(html).toContain("Remove from queue");
  expect(html).not.toContain("Sign with");
  expect(html).toContain("Replaced by another transaction");
  expect(html).toContain(`href="https://basescan.org/tx/0x${"d".repeat(64)}"`);
  const outsider = renderToStaticMarkup(<SafeTransactions detail={{ ...treasuryDetail, wallet: null, queue: [pendingOwner] }} onChanged={() => {}} onIntent={() => {}} onReject={() => {}} />);
  expect(outsider).not.toContain("Execute with");
  expect(outsider).toContain("Connect a wallet that owns this Safe");
  expect(outsider).not.toContain("These share one position");
  const pending = renderToStaticMarkup(<SafeTransactions detail={{ ...treasuryDetail, queue: [{ ...pendingSend, intents: [{ requestId: crypto.randomUUID(), kind: "approve", preview: { code: "K7PX2M", title: "Approve Safe transaction", text: "", state: "pending", expiresAt: Date.now() + 60_000 } }] }] }} onChanged={() => {}} onIntent={() => {}} onReject={() => {}} />);
  expect(pending).toContain("Approve Safe transaction is waiting for your confirmation.");
  expect(pending).not.toContain("Execute with Pecu wallet");
});

test("Safe confirmations use specific labels and the client explains invalid input before sending", async () => {
  expect(confirmationLabel("Create Safe")).toBe("Confirm creation");
  expect(confirmationLabel("Execute Safe transaction")).toBe("Confirm execution");
  expect(confirmationLabel("Approve Safe transaction")).toBe("Confirm approval");
  expect(confirmationLabel("Spend from Safe limit")).toBe("Confirm payment");
  await expect(profileAction({ op: "proposal-create", safe: treasuryDetail.address, action: { kind: "send", token: "ETH", to: "0x123", amount: "1" } })).rejects.toThrow("Check the recipient address and try again.");
  await expect(profileAction({ op: "proposal-create", safe: treasuryDetail.address, action: { kind: "send", token: "ETH", to: alice, amount: "one" } })).rejects.toThrow("Enter an amount such as 12.5");
  await expect(profileAction({ op: "org-create", name: "   " })).rejects.toThrow("Enter a name");
});

test("linked wallets name Safe owners before contacts and the connected wallet", () => {
  const linked = [{ address: bob, name: "Ledger", linkedAt: 1 }, { address: alice, name: null, linkedAt: 2 }];
  expect(addressLabel(bob, { linked, browser: bob, contacts: [{ address: bob, name: "Bob" }] })).toBe("Ledger");
  expect(addressLabel(alice, { linked })).toBe("Your wallet");
  expect(addressLabel(pecuWallet, { linked, wallet: pecuWallet })).toBe("Your Pecu wallet");
});
