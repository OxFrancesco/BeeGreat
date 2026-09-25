import { CheckIcon, CircleIcon, ExternalLinkIcon, PenLineIcon } from "lucide-react";
import { useState } from "react";
import type { ProfileIntent, ProfileProposal, ProfileSafeDetail } from "../../../../../src/safe-profile-contract";
import { executeSafeTransaction, executionSignatures, signSafeTransaction, useBrowserWallets } from "@/lib/browser-wallet";
import { addressLabel, errorText, newRequestId, profileAction, sameAddress, shortAddress } from "@/lib/profile";
import { Button } from "../ui/button";

const proposerText = { you: "Proposed by you", owner: "Proposed by an owner", other: "Proposed by someone who isn't a known owner" } satisfies Record<ProfileProposal["proposer"], string>;
const dateTime = (value: number) => new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

function ApprovalBeads({ approvals, threshold }: { approvals: number; threshold: number }) {
  return (
    <span className="pecu-beads" aria-hidden="true">
      {Array.from({ length: threshold }, (_, index) => <span key={index} data-filled={index < approvals ? "true" : undefined} />)}
    </span>
  );
}

function ProposalCard({ proposal, detail, onChanged, onIntent, onReject }: {
  proposal: ProfileProposal; detail: ProfileSafeDetail;
  onChanged: (message?: string) => void; onIntent: (intent: ProfileIntent) => void; onReject: () => void;
}) {
  const { connected } = useBrowserWallets();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const approved = (address: string | null | undefined) => proposal.approvals.some((approval) => sameAddress(approval.owner, address));
  const isOwner = (address: string | null | undefined) => detail.owners.some((owner) => sameAddress(owner, address));
  const count = proposal.approvals.length;
  const readyFor = (executor: string | null | undefined) => Boolean(executor) && count + (isOwner(executor) && !approved(executor) ? 1 : 0) >= detail.threshold;
  const browser = connected?.address ?? null;
  const browserName = connected?.wallet.info.name ?? "your wallet";
  const pendingIntent = proposal.intents.find((intent) => intent.preview.state === "pending" || intent.preview.state === "executing");
  const submitted = proposal.state === "submitted";
  const missing = Math.max(detail.threshold - count, 0);
  const ownerCanFinish = missing === 1 && [detail.wallet, browser].some((executor) => isOwner(executor) && !approved(executor));
  const status = submitted
    ? "Submitted. Waiting for Base to include it."
    : missing === 0
      ? "Ready to execute"
      : `Needs ${missing} more ${missing === 1 ? "approval" : "approvals"}${ownerCanFinish ? ". Executing from an owner wallet counts as its approval." : ""}`;
  const run = async (key: string, task: () => Promise<string | void>) => {
    setBusy(key);
    setError(null);
    try {
      onChanged((await task()) ?? undefined);
    } catch (reason) {
      setError(errorText(reason));
    } finally {
      setBusy(null);
    }
  };
  const label = (owner: string) => addressLabel(owner, { contacts: detail.contacts, wallet: detail.wallet, browser });
  const actions: Array<{ key: string; label: string; primary: boolean; task: () => Promise<string | void> }> = [];
  if (!submitted && !pendingIntent) {
    if (browser && connected && isOwner(browser) && !approved(browser)) {
      actions.push({ key: "sign", label: `Sign with ${browserName}`, primary: !readyFor(detail.wallet) && !readyFor(browser), task: async () => {
        const signature = await signSafeTransaction(connected.wallet, browser, proposal.transaction);
        await profileAction({ op: "proposal-sign", hash: proposal.hash, owner: browser, signature });
        return "Signature saved. Other owners can see it now.";
      } });
    }
    if (detail.wallet && isOwner(detail.wallet) && !approved(detail.wallet) && !readyFor(detail.wallet)) {
      actions.push({ key: "approve", label: "Approve with Pecu wallet", primary: false, task: async () => {
        const result = await profileAction({ op: "proposal-approve", requestId: newRequestId(), hash: proposal.hash });
        if (!result.intent) throw new Error(result.message ?? "Pecu couldn't prepare the approval.");
        onIntent(result.intent);
      } });
    }
    if (detail.wallet && readyFor(detail.wallet)) {
      actions.push({ key: "execute", label: "Execute with Pecu wallet", primary: true, task: async () => {
        const result = await profileAction({ op: "proposal-execute", requestId: newRequestId(), hash: proposal.hash });
        if (!result.intent) throw new Error(result.message ?? "Pecu couldn't prepare the transaction.");
        onIntent(result.intent);
      } });
    }
    if (browser && connected && readyFor(browser)) {
      actions.push({ key: "execute-browser", label: `Execute with ${browserName}`, primary: !detail.wallet, task: async () => {
        const signatures = executionSignatures(proposal, detail.owners, detail.threshold, isOwner(browser) ? browser : null);
        if (!signatures) throw new Error("This transaction doesn't have enough approvals yet.");
        const transaction = await executeSafeTransaction(connected.wallet, browser, proposal.transaction, signatures);
        await profileAction({ op: "proposal-submitted", hash: proposal.hash, transaction });
        return "Submitted from your wallet. Pecu is checking Base for the result.";
      } });
    }
  }
  return (
    <article className="pecu-proposal" aria-labelledby={`proposal-${proposal.hash}`}>
      <header className="pecu-proposal-head">
        <div className="pecu-proposal-heading">
          <h3 id={`proposal-${proposal.hash}`}>{proposal.title}</h3>
          <p className="pecu-proposal-meta">
            {proposerText[proposal.proposer]} · {dateTime(proposal.createdAt)}
          </p>
        </div>
        <div className="pecu-proposal-progress">
          <ApprovalBeads approvals={count} threshold={detail.threshold} />
          <span>{count} of {detail.threshold}</span>
        </div>
      </header>
      <p className="pecu-proposal-summary">{proposal.summary}</p>
      <ul className="pecu-approvals" aria-label="Owner approvals">
        {detail.owners.map((owner) => {
          const approval = proposal.approvals.find((item) => sameAddress(item.owner, owner));
          const name = label(owner);
          return (
            <li className="pecu-approval" key={owner} data-approved={approval ? "true" : undefined}>
              {approval ? approval.via === "chain" ? <CheckIcon className="size-4" aria-hidden="true" /> : <PenLineIcon className="size-4" aria-hidden="true" /> : <CircleIcon className="size-4" aria-hidden="true" />}
              <span className="pecu-approval-who">
                {name ? <span>{name}</span> : null}
                <span className="mono">{shortAddress(owner)}</span>
              </span>
              <span className="pecu-approval-state">{approval ? approval.via === "chain" ? "Approved on Base" : "Signed" : "Waiting"}</span>
            </li>
          );
        })}
      </ul>
      <p className="pecu-proposal-status" role="status">
        {status}
        {submitted && proposal.executedTransaction ? (
          <> · <a href={`https://basescan.org/tx/${proposal.executedTransaction}`} target="_blank" rel="noreferrer">View on Basescan <ExternalLinkIcon className="size-3.5" /></a></>
        ) : null}
      </p>
      {pendingIntent ? (
        <div className="pecu-proposal-pending">
          <span>{pendingIntent.preview.state === "executing" ? `${pendingIntent.preview.title} submitted. Waiting for the receipt.` : `${pendingIntent.preview.title} is waiting for your confirmation.`}</span>
          <Button className="pecu-button" onClick={() => onIntent(pendingIntent)}>{pendingIntent.preview.state === "executing" ? "Check status" : "Review"}</Button>
        </div>
      ) : null}
      {error ? <p className="pecu-error" role="alert">{error}</p> : null}
      <div className="pecu-proposal-actions">
        {actions.map((action) => (
          <Button key={action.key} className={action.primary ? "pecu-button pecu-button-primary" : "pecu-button"} disabled={busy !== null} onClick={() => void run(action.key, action.task)}>
            {busy === action.key ? (action.key === "sign" || action.key === "execute-browser" ? "Check your wallet…" : "Preparing…") : action.label}
          </Button>
        ))}
        {!submitted && proposal.kind !== "reject" ? (
          <Button className="pecu-button pecu-button-quiet" disabled={busy !== null} onClick={onReject}>Reject</Button>
        ) : null}
        {proposal.proposer === "you" && !submitted ? (
          confirmRemove ? (
            <span className="pecu-inline-confirm">
              <Button className="pecu-button pecu-button-danger" disabled={busy !== null} onClick={() => void run("delete", async () => { await profileAction({ op: "proposal-delete", hash: proposal.hash }); return "Removed from the queue."; })}>Remove</Button>
              <Button className="pecu-button pecu-button-quiet" onClick={() => setConfirmRemove(false)}>Keep</Button>
            </span>
          ) : (
            <Button className="pecu-button pecu-button-quiet" disabled={busy !== null} onClick={() => setConfirmRemove(true)}>Remove from queue</Button>
          )
        ) : null}
      </div>
      {!detail.wallet && !connected && !submitted ? <p className="pecu-profile-note">Connect a wallet that owns this Safe to sign or execute.</p> : null}
    </article>
  );
}

const historyState = {
  queued: "Pending",
  submitted: "Submitted",
  executed: "Executed",
  replaced: "Replaced by another transaction",
  closed: "No longer pending",
} satisfies Record<ProfileProposal["state"], string>;

export function SafeTransactions({ detail, onChanged, onIntent, onReject }: {
  detail: ProfileSafeDetail; onChanged: (message?: string) => void; onIntent: (intent: ProfileIntent) => void; onReject: () => void;
}) {
  return (
    <div className="pecu-profile-stack">
      <section className="pecu-profile-section" aria-labelledby="safe-queue">
        <h2 id="safe-queue">Pending</h2>
        {detail.queue.length > 1 ? <p className="pecu-profile-note">These share one position in the Safe's queue. Once one executes, the others can no longer run.</p> : null}
        {detail.queue.length ? (
          detail.queue.map((proposal) => <ProposalCard key={proposal.hash} proposal={proposal} detail={detail} onChanged={onChanged} onIntent={onIntent} onReject={onReject} />)
        ) : (
          <p className="pecu-profile-empty">Nothing is waiting for approval.</p>
        )}
      </section>
      {detail.history.length ? (
        <section className="pecu-profile-section" aria-labelledby="safe-history">
          <h2 id="safe-history">History</h2>
          <ul className="pecu-history">
            {detail.history.map((proposal) => (
              <li key={proposal.hash}>
                <span className="pecu-history-title">{proposal.title}</span>
                <span className="pecu-history-meta">{dateTime(proposal.createdAt)}</span>
                <span className="pecu-history-state" data-state={proposal.state}>
                  {proposal.state === "executed" && proposal.executedTransaction ? (
                    <a href={`https://basescan.org/tx/${proposal.executedTransaction}`} target="_blank" rel="noreferrer">Executed <ExternalLinkIcon className="size-3.5" /></a>
                  ) : historyState[proposal.state]}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
