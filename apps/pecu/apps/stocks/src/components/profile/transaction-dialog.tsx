import { useEffect, useId, useState } from "react";
import type { JsonFields } from "../../../../../src/json-contract";
import type { ProfileIntent, ProfileSafeDetail } from "../../../../../src/safe-profile-contract";
import { useBrowserWallets } from "@/lib/browser-wallet";
import { useLinkedWallets, walletOptionLabel } from "@/lib/linked-wallets";
import { addressLabel, newRequestId, profileAction, sameAddress, shortAddress, type Address } from "@/lib/profile";
import { Field, FormActions, ProfileDialog, useSubmit } from "./profile-dialogs";

export type TransactionMode =
  | Readonly<{ kind: "send"; token?: string }>
  | Readonly<{ kind: "owner-add" }>
  | Readonly<{ kind: "owner-remove"; owner: Address }>
  | Readonly<{ kind: "owner-replace"; owner: Address }>
  | Readonly<{ kind: "threshold" }>
  | Readonly<{ kind: "reject" }>
  | Readonly<{ kind: "budget-set" }>
  | Readonly<{ kind: "budget-revoke"; delegate: Address; token: Address; symbol: string }>
  | Readonly<{ kind: "spend"; token: Address; symbol: string; remaining: string }>;

const resets = [
  { minutes: 0, label: "One time" },
  { minutes: 1440, label: "Every day" },
  { minutes: 10080, label: "Every week" },
  { minutes: 43200, label: "Every 30 days" },
];

const titles = {
  send: "Send from this Safe",
  "owner-add": "Add an owner",
  "owner-remove": "Remove an owner",
  "owner-replace": "Replace an owner",
  threshold: "Change required approvals",
  reject: "Reject pending transactions",
  "budget-set": "New spending limit",
  "budget-revoke": "Remove spending limit",
  spend: "Spend from your limit",
} satisfies Record<TransactionMode["kind"], string>;

function ApprovalsSelect({ id, max, value, onChange }: { id: string; max: number; value: number; onChange: (value: number) => void }) {
  return (
    <select id={id} className="pecu-input" value={Math.min(value, max)} onChange={(event) => onChange(Number(event.currentTarget.value))}>
      {Array.from({ length: Math.max(max, 1) }, (_, index) => index + 1).map((option) => <option key={option} value={option}>{option}</option>)}
    </select>
  );
}

function TokenPicker({ detail, token, custom, onToken, onCustom }: { detail: ProfileSafeDetail; token: string; custom: string; onToken: (value: string) => void; onCustom: (value: string) => void }) {
  const balance = detail.balances.find((item) => (item.token ?? "ETH") === token);
  return (
    <>
      <Field label="Asset" hint={balance ? `Safe balance: ${balance.amount} ${balance.symbol}` : undefined}>
        {(id) => (
          <select id={id} className="pecu-input" value={token} onChange={(event) => onToken(event.currentTarget.value)}>
            {detail.balances.map((item) => <option key={item.symbol} value={item.token ?? "ETH"}>{item.symbol}</option>)}
            <option value="other">Other token</option>
          </select>
        )}
      </Field>
      {token === "other" ? (
        <Field label="Token address">
          {(id) => <input id={id} className="pecu-input mono" value={custom} placeholder="0x…" spellCheck={false} required onChange={(event) => onCustom(event.currentTarget.value)} />}
        </Field>
      ) : null}
    </>
  );
}

function AddressInput({ id, value, onChange, detail, placeholder = "0x…" }: { id: string; value: string; onChange: (value: string) => void; detail: ProfileSafeDetail; placeholder?: string }) {
  const listId = useId();
  const { connected } = useBrowserWallets();
  const linked = useLinkedWallets(true).wallets ?? [];
  const known = [
    ...detail.contacts,
    ...(detail.wallet ? [{ address: detail.wallet, name: "Your Pecu wallet" }] : []),
    ...linked.map((item) => ({ address: item.address, name: item.name ?? "Your wallet" })),
    ...(connected && !linked.some((item) => sameAddress(item.address, connected.address)) ? [{ address: connected.address, name: "Your connected wallet" }] : []),
  ];
  return (
    <>
      <input id={id} className="pecu-input mono" list={listId} value={value} placeholder={placeholder} spellCheck={false} autoComplete="off" required onChange={(event) => onChange(event.currentTarget.value)} />
      <datalist id={listId}>
        {known.map((item) => <option key={`${item.address}:${item.name}`} value={item.address}>{item.name}</option>)}
      </datalist>
    </>
  );
}

export function TransactionDialog({ detail, mode, onClose, onQueued, onIntent }: {
  detail: ProfileSafeDetail; mode: TransactionMode | null; onClose: () => void;
  onQueued: (message: string) => void; onIntent: (intent: ProfileIntent) => void;
}) {
  const linked = useLinkedWallets(true).wallets;
  const [token, setToken] = useState("ETH");
  const [custom, setCustom] = useState("");
  const [amount, setAmount] = useState("");
  const [address, setAddress] = useState("");
  const [name, setName] = useState("");
  const [threshold, setThreshold] = useState(detail.threshold);
  const [reset, setReset] = useState(0);
  const [spender, setSpender] = useState<string>("wallet");
  useEffect(() => {
    if (!mode) return;
    setToken(mode.kind === "send" && mode.token ? mode.token : "ETH");
    setCustom("");
    setAmount("");
    setAddress("");
    setName("");
    setReset(0);
    setSpender(detail.wallet ? "wallet" : "other");
    setThreshold(mode.kind === "owner-remove" ? Math.min(detail.threshold, Math.max(detail.owners.length - 1, 1)) : detail.threshold);
  }, [mode, detail.threshold, detail.owners.length, detail.wallet]);
  const label = (value: string) => addressLabel(value, { contacts: detail.contacts, wallet: detail.wallet, linked }) ?? shortAddress(value);
  const selectedToken = token === "other" ? custom.trim() : token;
  const submit = useSubmit(async () => {
    if (!mode) return null;
    if (mode.kind === "spend") {
      const result = await profileAction({ op: "budget-spend", requestId: newRequestId(), safe: detail.address, token: mode.token, to: address.trim(), amount: amount.trim() });
      if (!result.intent) throw new Error(result.message ?? "Pecu couldn't prepare this payment.");
      return { intent: result.intent };
    }
    let action: JsonFields;
    switch (mode.kind) {
      case "send": action = { kind: "send", token: selectedToken, to: address.trim(), amount: amount.trim() }; break;
      case "owner-add": action = { kind: "owner-add", owner: address.trim(), threshold }; break;
      case "owner-remove": action = { kind: "owner-remove", owner: mode.owner, threshold }; break;
      case "owner-replace": action = { kind: "owner-replace", owner: mode.owner, replacement: address.trim() }; break;
      case "threshold": action = { kind: "threshold", threshold }; break;
      case "reject": action = { kind: "reject" }; break;
      case "budget-set": {
        const delegate = spender === "wallet" ? detail.wallet : spender === "other" ? address.trim() : spender;
        if (!delegate) throw new Error("Choose who can spend.");
        action = { kind: "budget-set", delegate, token: selectedToken, amount: amount.trim(), resetMinutes: reset };
        break;
      }
      case "budget-revoke": action = { kind: "budget-revoke", delegate: mode.delegate, token: mode.token }; break;
    }
    if ((mode.kind === "owner-add" || mode.kind === "owner-replace") && name.trim() && address.trim()) {
      await profileAction({ op: "contact-save", orgId: detail.org.id, address: address.trim(), name: name.trim() });
    }
    await profileAction({ op: "proposal-create", safe: detail.address, action });
    return null;
  }, (result) => {
    if (result?.intent) onIntent(result.intent);
    else onQueued("Added to the queue. Owners can review and approve it now.");
    onClose();
  });
  if (!mode) return <ProfileDialog open={false} title="" onClose={onClose}>{null}</ProfileDialog>;
  const owners = detail.owners.length;
  const approvalsHint = (value: number, total: number) => `Any ${Math.min(value, total)} of ${total} ${total === 1 ? "owner" : "owners"} will need to approve.`;
  return (
    <ProfileDialog
      open
      title={titles[mode.kind]}
      description={mode.kind === "spend" ? `You can spend up to ${mode.remaining} ${mode.symbol} without owner approvals.` : mode.kind === "reject" ? "This creates an empty transaction at the same position in the queue. If owners approve and execute it first, the pending transactions can no longer run." : "Owners approve this like any other Safe transaction before it takes effect."}
      onClose={() => { submit.reset(); onClose(); }}
      busy={submit.busy}
    >
      <form className="pecu-profile-form" onSubmit={submit.submit}>
        {mode.kind === "send" ? (
          <>
            <TokenPicker detail={detail} token={token} custom={custom} onToken={setToken} onCustom={setCustom} />
            <Field label="Amount">
              {(id) => (
                <div className="pecu-input-row">
                  <input id={id} className="pecu-input mono" inputMode="decimal" value={amount} placeholder="0.00" required onChange={(event) => setAmount(event.currentTarget.value)} />
                  {detail.balances.find((item) => (item.token ?? "ETH") === token) ? (
                    <button className="pecu-button pecu-button-quiet" type="button" onClick={() => setAmount(detail.balances.find((item) => (item.token ?? "ETH") === token)!.amount)}>Max</button>
                  ) : null}
                </div>
              )}
            </Field>
            <Field label="Recipient">{(id) => <AddressInput id={id} value={address} onChange={setAddress} detail={detail} />}</Field>
          </>
        ) : null}
        {mode.kind === "owner-add" ? (
          <>
            <Field label="Owner address">{(id) => <AddressInput id={id} value={address} onChange={setAddress} detail={detail} />}</Field>
            <Field label="Name (optional)">{(id) => <input id={id} className="pecu-input" value={name} maxLength={40} onChange={(event) => setName(event.currentTarget.value)} />}</Field>
            <Field label="Required approvals" hint={approvalsHint(threshold, owners + 1)}>{(id) => <ApprovalsSelect id={id} max={owners + 1} value={threshold} onChange={setThreshold} />}</Field>
          </>
        ) : null}
        {mode.kind === "owner-remove" ? (
          <>
            <p className="pecu-profile-note">Remove <strong>{label(mode.owner)}</strong> <span className="mono">{shortAddress(mode.owner)}</span> from the owners.</p>
            <Field label="Required approvals" hint={approvalsHint(threshold, owners - 1)}>{(id) => <ApprovalsSelect id={id} max={owners - 1} value={threshold} onChange={setThreshold} />}</Field>
          </>
        ) : null}
        {mode.kind === "owner-replace" ? (
          <>
            <p className="pecu-profile-note">Replace <strong>{label(mode.owner)}</strong> <span className="mono">{shortAddress(mode.owner)}</span>. The Safe address, funds and required approvals stay the same.</p>
            <Field label="New owner address">{(id) => <AddressInput id={id} value={address} onChange={setAddress} detail={detail} />}</Field>
            <Field label="Name (optional)">{(id) => <input id={id} className="pecu-input" value={name} maxLength={40} onChange={(event) => setName(event.currentTarget.value)} />}</Field>
          </>
        ) : null}
        {mode.kind === "threshold" ? (
          <Field label="Required approvals" hint={approvalsHint(threshold, owners)}>{(id) => <ApprovalsSelect id={id} max={owners} value={threshold} onChange={setThreshold} />}</Field>
        ) : null}
        {mode.kind === "budget-set" ? (
          <>
            <Field label="Who can spend">
              {(id) => (
                <select id={id} className="pecu-input" value={spender} onChange={(event) => setSpender(event.currentTarget.value)}>
                  {detail.wallet ? <option value="wallet">Your Pecu wallet</option> : null}
                  {(linked ?? []).filter((item) => !sameAddress(item.address, detail.wallet)).map((item) => <option key={item.address} value={item.address}>{walletOptionLabel(item)}</option>)}
                  <option value="other">Another address</option>
                </select>
              )}
            </Field>
            {spender === "other" ? <Field label="Spender address">{(id) => <AddressInput id={id} value={address} onChange={setAddress} detail={detail} />}</Field> : null}
            <TokenPicker detail={detail} token={token} custom={custom} onToken={setToken} onCustom={setCustom} />
            <Field label="Limit">{(id) => <input id={id} className="pecu-input mono" inputMode="decimal" value={amount} placeholder="0.00" required onChange={(event) => setAmount(event.currentTarget.value)} />}</Field>
            <Field label="Refills" hint="A limit caps how much can be spent. It doesn't restrict recipients.">
              {(id) => (
                <select id={id} className="pecu-input" value={reset} onChange={(event) => setReset(Number(event.currentTarget.value))}>
                  {resets.map((option) => <option key={option.minutes} value={option.minutes}>{option.label}</option>)}
                </select>
              )}
            </Field>
          </>
        ) : null}
        {mode.kind === "budget-revoke" ? (
          <p className="pecu-profile-note">Stop <strong>{label(mode.delegate)}</strong> from spending {mode.symbol} from this Safe.</p>
        ) : null}
        {mode.kind === "spend" ? (
          <>
            <Field label={`Amount (${mode.symbol})`}>{(id) => <input id={id} className="pecu-input mono" inputMode="decimal" value={amount} placeholder="0.00" required onChange={(event) => setAmount(event.currentTarget.value)} />}</Field>
            <Field label="Recipient">{(id) => <AddressInput id={id} value={address} onChange={setAddress} detail={detail} />}</Field>
          </>
        ) : null}
        <FormActions busy={submit.busy} label={mode.kind === "spend" ? "Review payment" : "Add to queue"} onCancel={onClose} error={submit.error} />
      </form>
    </ProfileDialog>
  );
}
