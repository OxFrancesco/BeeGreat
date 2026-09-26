import {
  ArrowDownIcon,
  CheckIcon,
  Clock3Icon,
  Loader2Icon,
  CircleAlertIcon,
  XIcon,
} from "lucide-react";
import { useId } from "react";
import type { z } from "zod";
import type { previewSchema } from "../../../../src/web-contract";
import {
  confirmationLabel,
  previewPresentation,
  type PreviewRow,
} from "../lib/preview";
import { AddressText } from "./address-text";
import { CopyButton } from "./copy-button";
import { TransactionPlan } from "./transaction-plan";
import {
  Confirmation,
  ConfirmationAccepted,
  ConfirmationAction,
  ConfirmationActions,
  ConfirmationRejected,
  ConfirmationRequest,
  ConfirmationTitle,
} from "./ai-elements/confirmation";

type Preview = z.infer<typeof previewSchema>;

const TX_LINK = /https:\/\/basescan\.org\/tx\/0x[0-9a-fA-F]{64}/g;

function shorten(hash: string) {
  return `${hash.slice(0, 6)}…${hash.slice(-4)}`;
}

/** Values that read as amounts or token figures keep tabular digits. */
function isAmount(value: string) {
  return /^(about )?\d/.test(value);
}

function DetailRows({ rows }: { rows: readonly PreviewRow[] }) {
  return (
    <dl className="pecu-confirmation-rows">
      {rows.map((row, index) => (
        <div
          className={`pecu-confirmation-row${row.label ? "" : " is-plain"}`}
          key={index}
        >
          {row.label ? (
            <dt>{row.label}</dt>
          ) : (
            <dt className="sr-only">Details</dt>
          )}
          <dd
            className={
              isAmount(row.value) || row.value.startsWith("0x") ? "mono" : undefined
            }
          >
            <span><AddressText text={row.value} /></span>
            {/^0x[\da-fA-F]{40}$/.test(row.value) ? (
              <CopyButton
                text={row.value}
                label={
                  row.label === "To"
                    ? "Copy recipient"
                    : `Copy ${row.label.toLowerCase()}`
                }
                className="pecu-preview-copy"
              />
            ) : null}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function Amount({ row }: { row: PreviewRow }) {
  const label =
    row.label === "You receive"
      ? "Estimated receive"
      : row.label === "You pay"
        ? "Pay"
        : row.label;
  const value =
    row.label === "You receive" ? row.value.replace(/^about /, "") : row.value;
  return (
    <div className="pecu-preview-amount">
      <span>{label}</span>
      <strong className="mono">{value}</strong>
    </div>
  );
}

export function PreviewCard({
  preview,
  busy,
  confirming,
  onSend,
  onWalletConfirm,
  walletNotice,
}: {
  preview: Preview;
  busy: boolean;
  confirming: boolean;
  onSend: (text: string) => Promise<void>;
  /** Runs the linked-wallet flow for previews that the user's own wallet signs. */
  onWalletConfirm?: (resend: boolean) => void;
  walletNotice?: Readonly<{ message: string; resend: boolean }> | null;
}) {
  const signedByWallet = Boolean(preview.signer && onWalletConfirm);
  const headingId = useId();
  const {
    groups: parsedGroups,
    metadata,
    basket,
  } = previewPresentation(preview.text);
  const groups = parsedGroups.map((group) => ({
    ...group,
    details: group.details.filter(
      (row) =>
        !(
          row.label === "Action" &&
          row.value.toLowerCase() === preview.title?.toLowerCase()
        ),
    ),
  }));
  const approval = /approval|^Approve\b/i.test(preview.title ?? "") && !/\bSafe\b/.test(preview.title ?? "");
  const expires = new Date(preview.expiresAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  const labels = {
    pending: signedByWallet ? `Review, then sign in your wallet · expires ${expires}` : `Review before confirming · expires ${expires}`,
    executing: signedByWallet ? "Sent from your wallet, waiting for Base" : "Submitted, waiting for the receipt",
    succeeded: "Executed and verified on Base",
    failed: "Failed",
    cancelled: "Cancelled, nothing was sent",
    expired: "Expired without confirmation",
  } satisfies Record<Preview["state"], string>;
  const status = confirming
    ? signedByWallet
      ? "Check your wallet…"
      : preview.state === "executing"
        ? "Checking…"
        : "Confirming…"
    : labels[preview.state];
  const confirm = () => (signedByWallet ? onWalletConfirm?.(false) : void onSend(`/confirm ${preview.code}`));
  // Steps with a hash already link to Basescan inside the plan.
  const links = preview.plan?.steps.some((step) => step.hash)
    ? []
    : (preview.result ?? "").match(TX_LINK) ?? [];
  const StateIcon =
    preview.state === "succeeded"
      ? CheckIcon
      : preview.state === "failed"
        ? CircleAlertIcon
        : preview.state === "cancelled" || preview.state === "expired"
          ? XIcon
          : Clock3Icon;
  return (
    <Confirmation
      className="pecu-confirmation"
      state={preview.state}
      aria-labelledby={headingId}
      aria-busy={confirming}
    >
      <ConfirmationTitle className="pecu-confirmation-head">
        <span className="pecu-confirmation-heading">
          <span className="pecu-confirmation-name" id={headingId}>
            {preview.title ?? "Transaction"}
          </span>
          <span className="pecu-confirmation-status" role="status">
            <StateIcon aria-hidden="true" size={16} />
            {status}
          </span>
        </span>
      </ConfirmationTitle>
      <div
        className={`pecu-confirmation-body${basket ? " is-basket" : ""}${approval ? " is-approval" : ""}`}
      >
        {groups.map((group, index) => (
          <div className="pecu-preview-group" key={index}>
            {group.amounts.length ? (
              <div className="pecu-preview-amounts">
                {group.amounts.map((row, rowIndex) => (
                  <div className="pecu-preview-amount-wrap" key={rowIndex}>
                    {rowIndex > 0 && row.label === "You receive" ? (
                      <ArrowDownIcon
                        className="pecu-preview-arrow"
                        size={18}
                        aria-hidden="true"
                      />
                    ) : null}
                    <Amount row={row} />
                  </div>
                ))}
              </div>
            ) : null}
            {group.details.length ? <DetailRows rows={group.details} /> : null}
          </div>
        ))}
        {metadata.length ? <DetailRows rows={metadata} /> : null}
        {preview.plan ? <TransactionPlan plan={preview.plan} state={preview.state} /> : null}
        {approval &&
        !preview.text.includes("This only approves token spending.") ? (
          <p className="pecu-preview-approval-note">
            This authorizes token spending. It does not transfer tokens.
          </p>
        ) : null}
      </div>
      <ConfirmationRequest>
        <ConfirmationActions className="pecu-confirmation-actions">
          <ConfirmationAction
            className="pecu-button pecu-button-primary"
            disabled={busy || confirming}
            onClick={confirm}
          >
            {confirming ? (
              <>
                <Loader2Icon
                  className="size-4 animate-spin"
                  aria-hidden="true"
                />
                {signedByWallet ? "Check your wallet…" : preview.state === "executing" ? "Checking…" : "Confirming…"}
              </>
            ) : preview.state === "executing" ? (
              "Check transaction"
            ) : basket ? (
              "Confirm basket"
            ) : (
              confirmationLabel(preview.title)
            )}
          </ConfirmationAction>
          {preview.state === "pending" ? (
            <ConfirmationAction
              className="pecu-button"
              disabled={busy || confirming}
              onClick={() => void onSend(`/cancel ${preview.code}`)}
            >
              Cancel
            </ConfirmationAction>
          ) : null}
        </ConfirmationActions>
        {walletNotice ? (
          <p className="pecu-confirmation-note pecu-wallet-notice" role="status">
            <span>{walletNotice.message}</span>
            {walletNotice.resend ? (
              <button className="pecu-inline-link" type="button" disabled={busy || confirming} onClick={() => onWalletConfirm?.(true)}>
                Send again
              </button>
            ) : null}
          </p>
        ) : null}
      </ConfirmationRequest>
      <ConfirmationAccepted>
        {links.length ? (
          <div className="pecu-confirmation-links">
            {links.map((link, index) => (
              <a href={link} key={link} rel="noreferrer" target="_blank">
                View transaction{links.length > 1 ? ` ${index + 1}` : ""} on
                Basescan{" "}
                <span className="mono">{shorten(link.slice(-66))}</span>
              </a>
            ))}
          </div>
        ) : null}
        <span className="pecu-confirmation-note">
          Receipt verified on Base. Amounts above are from the original preview.
        </span>
      </ConfirmationAccepted>
      <ConfirmationRejected>
        {preview.state === "failed" && preview.result ? (
          <span className="pecu-confirmation-note">
            {preview.result.split("\n")[0]}
          </span>
        ) : null}
        <span className="pecu-confirmation-note">
          {preview.state === "failed"
            ? "Execution encountered an error. Check the reply and transaction status before trying again."
            : "Nothing was sent. Ask again if you still want to do this."}
        </span>
      </ConfirmationRejected>
      {signedByWallet ? null : (
        <details className="pecu-preview-reference">
          <summary>Confirmation code</summary>
          <div>
            <code>{preview.code}</code>
            <CopyButton
              text={`/confirm ${preview.code}`}
              label="Copy confirmation command"
              className="pecu-preview-copy"
            />
          </div>
        </details>
      )}
    </Confirmation>
  );
}
