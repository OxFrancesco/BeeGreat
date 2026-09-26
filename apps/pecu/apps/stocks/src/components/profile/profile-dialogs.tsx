import { PlusIcon, XIcon } from "lucide-react";
import { useEffect, useId, useState, type FormEvent, type ReactNode } from "react";
import type { ProfileIntent, ProfileOrg } from "../../../../../src/safe-profile-contract";
import { useLinkedWallets } from "@/lib/linked-wallets";
import { errorText, newRequestId, profileAction, sameAddress, shortAddress } from "@/lib/profile";
import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "../ui/dialog";

export function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: (id: string) => ReactNode }) {
  const id = useId();
  return (
    <div className="pecu-field">
      <label htmlFor={id}>{label}</label>
      {children(id)}
      {hint ? <p className="pecu-field-hint">{hint}</p> : null}
    </div>
  );
}

export function ProfileDialog({ open, title, description, onClose, busy = false, children }: { open: boolean; title: string; description?: ReactNode; onClose: () => void; busy?: boolean; children: ReactNode }) {
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next && !busy) onClose(); }}>
      <DialogContent className="pecu pecu-profile-dialog">
        <DialogTitle className="pecu-profile-dialog-title">{title}</DialogTitle>
        {description ? <DialogDescription className="pecu-profile-dialog-description">{description}</DialogDescription> : <DialogDescription className="sr-only">{title}</DialogDescription>}
        {children}
      </DialogContent>
    </Dialog>
  );
}

export function useSubmit<T>(run: () => Promise<T>, onDone: (value: T) => void) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async (event?: FormEvent) => {
    event?.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      onDone(await run());
    } catch (reason) {
      setError(errorText(reason));
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, submit, reset: () => setError(null) };
}

export function FormActions({ busy, label, onCancel, error, danger = false }: { busy: boolean; label: string; onCancel: () => void; error: string | null; danger?: boolean }) {
  return (
    <>
      {error ? <p className="pecu-error" role="alert">{error}</p> : null}
      <div className="pecu-profile-form-actions">
        <Button className={danger ? "pecu-button pecu-button-danger" : "pecu-button pecu-button-primary"} type="submit" disabled={busy}>
          {busy ? "Working…" : label}
        </Button>
        <Button className="pecu-button pecu-button-quiet" type="button" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
      </div>
    </>
  );
}

export function NameDialog({ open, title, label, initial = "", submitLabel, onSave, onClose, extra }: {
  open: boolean; title: string; label: string; initial?: string; submitLabel: string;
  onSave: (name: string) => Promise<void>; onClose: () => void; extra?: ReactNode;
}) {
  const [name, setName] = useState(initial);
  useEffect(() => { if (open) setName(initial); }, [open, initial]);
  const { busy, error, submit, reset } = useSubmit(() => onSave(name.trim()), onClose);
  return (
    <ProfileDialog open={open} title={title} onClose={() => { reset(); onClose(); }} busy={busy}>
      <form className="pecu-profile-form" onSubmit={submit}>
        <Field label={label}>
          {(id) => <input id={id} className="pecu-input" value={name} maxLength={40} required autoFocus onChange={(event) => setName(event.currentTarget.value)} />}
        </Field>
        {extra}
        <FormActions busy={busy} label={submitLabel} onCancel={onClose} error={error} />
      </form>
    </ProfileDialog>
  );
}

export function ConfirmDialog({ open, title, body, confirmLabel, onConfirm, onClose }: { open: boolean; title: string; body: ReactNode; confirmLabel: string; onConfirm: () => Promise<void>; onClose: () => void }) {
  const { busy, error, submit, reset } = useSubmit(onConfirm, onClose);
  return (
    <ProfileDialog open={open} title={title} description={body} onClose={() => { reset(); onClose(); }} busy={busy}>
      <form className="pecu-profile-form" onSubmit={submit}>
        <FormActions busy={busy} label={confirmLabel} onCancel={onClose} error={error} danger />
      </form>
    </ProfileDialog>
  );
}

type OwnerDraft = { key: string; address: string; name: string };

const blankOwner = (): OwnerDraft => ({ key: crypto.randomUUID(), address: "", name: "" });

export function AddSafeDialog({ org, wallet, open, onClose, onCreated, onAdded }: {
  org: ProfileOrg | null; wallet: string | null; open: boolean; onClose: () => void;
  onCreated: (intent: ProfileIntent, safe: string) => void; onAdded: (safe: string) => void;
}) {
  const linkedWallets = useLinkedWallets(true).wallets;
  const linked = (linkedWallets ?? []).filter((item) => !sameAddress(item.address, wallet));
  const [mode, setMode] = useState<"create" | "existing">("create");
  const [name, setName] = useState("");
  const [existing, setExisting] = useState("");
  const [includeWallet, setIncludeWallet] = useState(true);
  const [excluded, setExcluded] = useState<ReadonlySet<string>>(new Set());
  const [others, setOthers] = useState<OwnerDraft[]>([blankOwner()]);
  const [threshold, setThreshold] = useState(2);
  useEffect(() => {
    if (!open) return;
    setMode("create");
    setName("");
    setExisting("");
    setIncludeWallet(Boolean(wallet));
    setExcluded(new Set());
    setOthers([blankOwner()]);
    setThreshold(2);
  }, [open, wallet]);
  const owners = [
    ...(wallet && includeWallet ? [wallet] : []),
    ...linked.filter((item) => !excluded.has(item.address)).map((item) => item.address),
    ...others.map((owner) => owner.address.trim()).filter(Boolean),
  ];
  const count = Math.max(owners.length, 1);
  const required = Math.min(Math.max(threshold, 1), count);
  const create = useSubmit(async () => {
    if (!org) throw new Error("Choose an organization first.");
    if (!name.trim()) throw new Error("Give the Safe a name.");
    if (!owners.length) throw new Error("Add at least one owner.");
    for (const owner of others) {
      if (owner.address.trim() && owner.name.trim()) await profileAction({ op: "contact-save", orgId: org.id, address: owner.address.trim(), name: owner.name.trim() });
    }
    const result = await profileAction({ op: "safe-create", requestId: newRequestId(), orgId: org.id, name: name.trim(), owners, threshold: required });
    if (!result.intent || !result.safe) throw new Error(result.message ?? "Pecu couldn't prepare the Safe. Try again.");
    return { intent: result.intent, safe: result.safe };
  }, ({ intent, safe }) => onCreated(intent, safe));
  const add = useSubmit(async () => {
    if (!org) throw new Error("Choose an organization first.");
    const result = await profileAction({ op: "safe-add", orgId: org.id, safe: existing.trim(), name: name.trim() });
    return result.safe ?? existing.trim();
  }, onAdded);
  const busy = create.busy || add.busy;
  return (
    <ProfileDialog
      open={open}
      title={org ? `Add a Safe to ${org.name}` : "Add a Safe"}
      onClose={() => { create.reset(); add.reset(); onClose(); }}
      busy={busy}
    >
      <div className="pecu-segmented" role="group" aria-label="How to add the Safe">
        <button type="button" aria-pressed={mode === "create"} onClick={() => setMode("create")}>Create new</button>
        <button type="button" aria-pressed={mode === "existing"} onClick={() => setMode("existing")}>Add existing</button>
      </div>
      {mode === "create" ? (
        <form className="pecu-profile-form" onSubmit={create.submit}>
          <Field label="Name">
            {(id) => <input id={id} className="pecu-input" value={name} maxLength={40} placeholder="Treasury" onChange={(event) => setName(event.currentTarget.value)} />}
          </Field>
          <fieldset className="pecu-owner-fieldset">
            <legend>Owners</legend>
            {wallet ? (
              <label className="pecu-owner-check">
                <input type="checkbox" checked={includeWallet} onChange={(event) => setIncludeWallet(event.currentTarget.checked)} />
                <span>Your Pecu wallet</span>
                <span className="mono">{shortAddress(wallet)}</span>
              </label>
            ) : null}
            {linked.map((item) => (
              <label className="pecu-owner-check" key={item.address}>
                <input
                  type="checkbox"
                  checked={!excluded.has(item.address)}
                  onChange={(event) => {
                    const include = event.currentTarget.checked;
                    setExcluded((current) => {
                      const next = new Set(current);
                      if (include) next.delete(item.address);
                      else next.add(item.address);
                      return next;
                    });
                  }}
                />
                <span>{item.name ?? "Your wallet"}</span>
                <span className="mono">{shortAddress(item.address)}</span>
              </label>
            ))}
            {others.map((owner, index) => (
              <div className="pecu-owner-draft" key={owner.key}>
                <input
                  className="pecu-input mono"
                  aria-label={`Owner ${index + 1} address`}
                  placeholder="0x… owner address"
                  value={owner.address}
                  spellCheck={false}
                  onChange={(event) => { const address = event.currentTarget.value; setOthers((list) => list.map((item) => item.key === owner.key ? { ...item, address } : item)); }}
                />
                <input
                  className="pecu-input"
                  aria-label={`Owner ${index + 1} name`}
                  placeholder="Name (optional)"
                  maxLength={40}
                  value={owner.name}
                  onChange={(event) => { const value = event.currentTarget.value; setOthers((list) => list.map((item) => item.key === owner.key ? { ...item, name: value } : item)); }}
                />
                <button className="pecu-icon-button" type="button" aria-label={`Remove owner ${index + 1}`} onClick={() => setOthers((list) => list.filter((item) => item.key !== owner.key))}>
                  <XIcon className="size-4" />
                </button>
              </div>
            ))}
            <Button className="pecu-button pecu-button-quiet pecu-owner-add" type="button" onClick={() => setOthers((list) => [...list, blankOwner()])} disabled={owners.length >= 32}>
              <PlusIcon className="size-4" />
              Add owner
            </Button>
          </fieldset>
          <Field label="Required approvals" hint={`Any ${required} of ${count} ${count === 1 ? "owner" : "owners"} must approve each transaction.`}>
            {(id) => (
              <select id={id} className="pecu-input" value={required} onChange={(event) => setThreshold(Number(event.currentTarget.value))}>
                {Array.from({ length: count }, (_, index) => index + 1).map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
            )}
          </Field>
          <p className="pecu-profile-note">Your Pecu wallet pays the network fee to create the Safe. You review it before anything is sent.</p>
          <FormActions busy={create.busy} label="Review Safe" onCancel={onClose} error={create.error} />
        </form>
      ) : (
        <form className="pecu-profile-form" onSubmit={add.submit}>
          <Field label="Safe address" hint="Pecu supports Safe 1.4.1 wallets on Base.">
            {(id) => <input id={id} className="pecu-input mono" value={existing} placeholder="0x…" spellCheck={false} required onChange={(event) => setExisting(event.currentTarget.value)} />}
          </Field>
          <Field label="Name">
            {(id) => <input id={id} className="pecu-input" value={name} maxLength={40} required placeholder="Treasury" onChange={(event) => setName(event.currentTarget.value)} />}
          </Field>
          <FormActions busy={add.busy} label="Add Safe" onCancel={onClose} error={add.error} />
        </form>
      )}
    </ProfileDialog>
  );
}
