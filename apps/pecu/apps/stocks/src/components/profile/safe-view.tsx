import { Link, useNavigate } from "@tanstack/react-router";
import { PencilIcon, PlusIcon } from "lucide-react";
import { Tabs as TabsPrimitive } from "radix-ui";
import { useEffect, useState } from "react";
import type { ProfileIntent } from "../../../../../src/safe-profile-contract";
import { profileAction, safeTabs, useProfile, useSafeDetail, type SafeTab } from "@/lib/profile";
import { Button } from "../ui/button";
import { AddressLine } from "./address-line";
import { IntentDialog } from "./intent-dialog";
import { ConfirmDialog, NameDialog } from "./profile-dialogs";
import { ReceiveButton } from "./receive-button";
import { SafeOwners, SafeSettings } from "./safe-sections";
import { SafeTransactions } from "./safe-transactions";
import { TransactionDialog, type TransactionMode } from "./transaction-dialog";

const tabLabels: Record<SafeTab, string> = { transactions: "Transactions", owners: "Owners", settings: "Settings" };

export function SafeView({ address, tab, onTab }: { address: string; tab: SafeTab; onTab: (tab: SafeTab) => void }) {
  const { refreshOverview } = useProfile();
  const safe = useSafeDetail(address);
  const navigate = useNavigate();
  const [mode, setMode] = useState<TransactionMode | null>(null);
  const [intent, setIntent] = useState<ProfileIntent | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [removing, setRemoving] = useState(false);
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 6000);
    return () => window.clearTimeout(timer);
  }, [notice]);
  const detail = safe.value;
  const changed = (message?: string) => {
    if (message) setNotice(message);
    void safe.refresh();
  };
  if (!detail) {
    return (
      <div className="pecu-profile-body" aria-busy={!safe.error}>
        {safe.error ? (
          <div className="pecu-error" role="alert">
            <span>{safe.error}</span>
            <Button className="pecu-inline-link" variant="link" size="sm" onClick={() => void safe.refresh()}>Try again</Button>
          </div>
        ) : (
          <div className="pecu-pnl-skeleton is-page" role="status">
            <span />
            <span className="is-total" />
            <span className="is-split" />
            <span className="is-chart" />
            <span className="sr-only">Loading Safe…</span>
          </div>
        )}
      </div>
    );
  }
  const ready = detail.status === "ready";
  const creation = detail.creation;
  const pendingSpends = detail.intents.filter((item) => item.preview.state === "pending" || item.preview.state === "executing");
  return (
    <div className="pecu-profile-body">
      <header className="pecu-safe-head">
        <div className="pecu-safe-title">
          <Link className="pecu-safe-org" to="/profile">{detail.org.name}</Link>
          <div className="pecu-safe-name">
            <h1>{detail.name}</h1>
            <Button className="pecu-button pecu-button-quiet pecu-safe-rename" aria-label={`Rename ${detail.name}`} onClick={() => setRenaming(true)}>
              <PencilIcon className="size-4" />
            </Button>
          </div>
          <AddressLine address={detail.address} explorer />
        </div>
        {ready ? (
          <div className="pecu-safe-actions">
            <ReceiveButton address={detail.address} />
            <Button className="pecu-button pecu-button-primary pecu-safe-new" onClick={() => setMode({ kind: "send" })}>
              <PlusIcon className="size-4" />
              New transaction
            </Button>
          </div>
        ) : null}
      </header>
      {notice ? <p className="pecu-profile-notice" role="status">{notice}</p> : null}
      {ready ? (
        <dl className="pecu-profile-stats">
          <div>
            <dt>Required approvals</dt>
            <dd>{detail.threshold} of {detail.owners.length}</dd>
          </div>
          {detail.balances.map((balance) => (
            <div key={balance.symbol}>
              <dt>{balance.symbol}</dt>
              <dd>{balance.amount}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <section className="pecu-proposal" aria-labelledby="safe-creation">
          <h2 id="safe-creation" className="pecu-proposal-title">
            {detail.status === "creating" ? creation?.preview.state === "executing" ? "Creating this Safe on Base" : "Waiting for your confirmation" : "This Safe wasn't created"}
          </h2>
          <p className="pecu-proposal-summary">
            {detail.threshold ? `Any ${detail.threshold} of ${detail.owners.length} owners will approve each transaction.` : null}
          </p>
          <div className="pecu-proposal-actions">
            {creation && (creation.preview.state === "pending" || creation.preview.state === "executing") ? (
              <Button className="pecu-button pecu-button-primary" onClick={() => setIntent(creation)}>{creation.preview.state === "executing" ? "Check status" : "Review and confirm"}</Button>
            ) : null}
            {detail.status === "not-created" ? <Button className="pecu-button" onClick={() => setRemoving(true)}>Remove</Button> : null}
          </div>
        </section>
      )}
      {pendingSpends.map((item) => (
        <div className="pecu-proposal-pending" key={item.requestId}>
          <span>{item.preview.state === "executing" ? `${item.preview.title} submitted. Waiting for the receipt.` : `${item.preview.title} is waiting for your confirmation.`}</span>
          <Button className="pecu-button" onClick={() => setIntent(item)}>{item.preview.state === "executing" ? "Check status" : "Review"}</Button>
        </div>
      ))}
      {ready ? (
        <TabsPrimitive.Root value={tab} onValueChange={(value) => onTab(safeTabs.find((item) => item === value) ?? "transactions")} className="pecu-safe-tabs">
          <TabsPrimitive.List className="pecu-segmented pecu-segmented-tabs" aria-label="Safe sections">
            {safeTabs.map((item) => (
              <TabsPrimitive.Trigger key={item} value={item}>
                {tabLabels[item]}
                {item === "transactions" && detail.queue.length ? <span className="pecu-tab-count" aria-label={`${detail.queue.length} pending`}>{detail.queue.length}</span> : null}
              </TabsPrimitive.Trigger>
            ))}
          </TabsPrimitive.List>
          <TabsPrimitive.Content value="transactions">
            <SafeTransactions detail={detail} onChanged={changed} onIntent={setIntent} onReject={() => setMode({ kind: "reject" })} />
          </TabsPrimitive.Content>
          <TabsPrimitive.Content value="owners">
            <SafeOwners detail={detail} onOpen={setMode} onChanged={changed} />
          </TabsPrimitive.Content>
          <TabsPrimitive.Content value="settings">
            <SafeSettings detail={detail} onOpen={setMode} onRemove={() => setRemoving(true)} />
          </TabsPrimitive.Content>
        </TabsPrimitive.Root>
      ) : null}
      <TransactionDialog
        detail={detail}
        mode={mode}
        onClose={() => setMode(null)}
        onQueued={(message) => { changed(message); if (tab !== "transactions") onTab("transactions"); }}
        onIntent={setIntent}
      />
      <IntentDialog intent={intent} onClose={() => { setIntent(null); void safe.refresh(); void refreshOverview(); }} />
      <NameDialog
        open={renaming}
        title="Rename Safe"
        label="Name"
        initial={detail.name}
        submitLabel="Save"
        onClose={() => setRenaming(false)}
        onSave={async (name) => {
          await profileAction({ op: "safe-rename", safe: detail.address, name });
          changed();
          void refreshOverview();
        }}
      />
      <ConfirmDialog
        open={removing}
        title={`Remove ${detail.name}?`}
        body="This removes the Safe from your profile only. It stays on Base with its funds and owners, and you can add it again by address."
        confirmLabel="Remove from profile"
        onClose={() => setRemoving(false)}
        onConfirm={async () => {
          await profileAction({ op: "safe-remove", safe: detail.address });
          await refreshOverview();
          void navigate({ to: "/profile" });
        }}
      />
    </div>
  );
}
