import { PencilIcon, PlusIcon } from "lucide-react";
import { useState } from "react";
import type { ProfileSafeDetail } from "../../../../../src/safe-profile-contract";
import { useBrowserWallets } from "@/lib/browser-wallet";
import { addressLabel, errorText, profileAction, resetLabel, sameAddress, type Address } from "@/lib/profile";
import { Button } from "../ui/button";
import { AddressLine } from "./address-line";
import { NameDialog } from "./profile-dialogs";
import type { TransactionMode } from "./transaction-dialog";

type Open = (mode: TransactionMode) => void;

export function SafeOwners({ detail, onOpen, onChanged }: { detail: ProfileSafeDetail; onOpen: Open; onChanged: (message?: string) => void }) {
  const { connected } = useBrowserWallets();
  const [naming, setNaming] = useState<Address | null>(null);
  const contact = naming ? detail.contacts.find((item) => sameAddress(item.address, naming)) : undefined;
  return (
    <div className="pecu-profile-stack">
      <section className="pecu-profile-section" aria-labelledby="safe-owners">
        <div className="pecu-profile-section-head">
          <h2 id="safe-owners">Owners</h2>
          <div className="pecu-owner-actions">
            <Button className="pecu-button pecu-button-quiet" onClick={() => onOpen({ kind: "threshold" })}>Change required approvals</Button>
            <Button className="pecu-button" onClick={() => onOpen({ kind: "owner-add" })}><PlusIcon className="size-4" />Add owner</Button>
          </div>
        </div>
        <ul className="pecu-owner-list">
          {detail.owners.map((owner) => {
            const label = addressLabel(owner, { contacts: detail.contacts, wallet: detail.wallet, browser: connected?.address });
            return (
              <li key={owner}>
                <AddressLine address={owner} label={label} full explorer />
                <div className="pecu-owner-actions">
                  <Button className="pecu-button pecu-button-quiet" aria-label={`Name ${owner}`} onClick={() => setNaming(owner)}><PencilIcon className="size-4" /></Button>
                  <Button className="pecu-button pecu-button-quiet" onClick={() => onOpen({ kind: "owner-replace", owner: owner })}>Replace</Button>
                  <Button className="pecu-button pecu-button-quiet" disabled={detail.owners.length === 1} onClick={() => onOpen({ kind: "owner-remove", owner: owner })}>Remove</Button>
                </div>
              </li>
            );
          })}
        </ul>
        <p className="pecu-profile-note">Owners must control their own keys for approvals to be independent. Pecu wallets are all signed by Pecu's server.</p>
      </section>
      <NameDialog
        open={naming !== null}
        title="Name this owner"
        label="Name"
        initial={contact?.name ?? ""}
        submitLabel="Save name"
        onClose={() => setNaming(null)}
        onSave={async (name) => {
          if (!naming) return;
          await profileAction({ op: "contact-save", orgId: detail.org.id, address: naming, name });
          onChanged();
        }}
        extra={contact ? (
          <Button className="pecu-button pecu-button-quiet" type="button" onClick={() => void profileAction({ op: "contact-delete", orgId: detail.org.id, address: contact.address }).then(
            () => { setNaming(null); onChanged(); },
            (error) => onChanged(errorText(error)),
          )}>Remove name</Button>
        ) : null}
      />
    </div>
  );
}

export function SafeSettings({ detail, onOpen, onRemove }: { detail: ProfileSafeDetail; onOpen: Open; onRemove: () => void }) {
  const { connected } = useBrowserWallets();
  const label = (address: string) => addressLabel(address, { contacts: detail.contacts, wallet: detail.wallet, browser: connected?.address });
  return (
    <div className="pecu-profile-stack">
      <section className="pecu-profile-section" aria-labelledby="safe-limits">
        <div className="pecu-profile-section-head">
          <h2 id="safe-limits">Spending limits</h2>
          <Button className="pecu-button" onClick={() => onOpen({ kind: "budget-set" })}><PlusIcon className="size-4" />New limit</Button>
        </div>
        {detail.budgets.length ? (
          <ul className="pecu-limit-list">
            {detail.budgets.map((budget) => (
              <li key={`${budget.delegate}:${budget.token}`}>
                <div className="pecu-limit-main">
                  <AddressLine address={budget.delegate} label={label(budget.delegate)} />
                  <p className="pecu-limit-amount"><span className="mono">{budget.remaining}</span> of <span className="mono">{budget.amount}</span> {budget.symbol} left · {resetLabel(budget.resetMinutes)}</p>
                </div>
                <div className="pecu-owner-actions">
                  {sameAddress(budget.delegate, detail.wallet) && budget.remaining !== "0" ? (
                    <Button className="pecu-button" onClick={() => onOpen({ kind: "spend", token: budget.token, symbol: budget.symbol, remaining: budget.remaining })}>Spend</Button>
                  ) : null}
                  <Button className="pecu-button pecu-button-quiet" onClick={() => onOpen({ kind: "budget-revoke", delegate: budget.delegate, token: budget.token, symbol: budget.symbol })}>Remove</Button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="pecu-profile-empty">No spending limits. A limit lets one address spend a set amount without asking the other owners each time.</p>
        )}
      </section>
      {detail.modules.length ? (
        <section className="pecu-profile-section" aria-labelledby="safe-modules">
          <h2 id="safe-modules">Enabled modules</h2>
          <ul className="pecu-owner-list">
            {detail.modules.map((module) => <li key={module.address}><AddressLine address={module.address} label={module.name} explorer /></li>)}
          </ul>
        </section>
      ) : null}
      <section className="pecu-profile-section" aria-labelledby="safe-general">
        <h2 id="safe-general">Remove from profile</h2>
        <div className="pecu-profile-row">
          <p>Remove it from your profile. The Safe and its funds stay on Base, and you can add it again.</p>
          <Button className="pecu-button pecu-button-quiet" onClick={onRemove}>Remove</Button>
        </div>
      </section>
    </div>
  );
}
