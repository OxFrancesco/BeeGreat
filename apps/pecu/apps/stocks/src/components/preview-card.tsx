import { Loader2Icon } from "lucide-react";
import type { z } from "zod";
import type { previewSchema } from "../../../../src/web-contract";
import { previewRows } from "../lib/preview";
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

export function PreviewCard({
  preview,
  busy,
  confirming,
  onSend,
}: {
  preview: Preview;
  busy: boolean;
  confirming: boolean;
  onSend: (text: string) => Promise<void>;
}) {
  const expires = new Date(preview.expiresAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  const labels: Record<Preview["state"], string> = {
    pending: `Waiting for your confirmation · expires ${expires}`,
    executing: "Submitted, waiting for the receipt",
    succeeded: "Executed and verified on Base",
    failed: "Failed",
    cancelled: "Cancelled, nothing was sent",
    expired: "Expired without confirmation",
  };
  const status = confirming
    ? preview.state === "executing"
      ? "Checking…"
      : "Confirming…"
    : labels[preview.state];
  const links = (preview.result ?? "").match(TX_LINK) ?? [];
  return (
    <Confirmation className="pecu-confirmation" state={preview.state}>
      <ConfirmationTitle className="pecu-confirmation-head">
        <span className="pecu-confirmation-heading">
          <span className="pecu-confirmation-name">
            {preview.title ?? "Transaction"}
          </span>
          <span className="pecu-confirmation-status">{status}</span>
        </span>
        <span
          aria-label="Confirmation code"
          className="mono pecu-code"
          title={`Use /confirm ${preview.code} in X chat`}
        >
          {preview.code}
        </span>
      </ConfirmationTitle>
      <div className="pecu-confirmation-body">
        {previewRows(preview.text).map((group, index) => (
          <dl className="pecu-confirmation-rows" key={index}>
            {group.map((row, rowIndex) =>
              row.label ? (
                <div className="pecu-confirmation-row" key={rowIndex}>
                  <dt>{row.label}</dt>
                  <dd className={isAmount(row.value) ? "mono" : undefined}>
                    {row.value}
                  </dd>
                </div>
              ) : (
                <dd
                  className="pecu-confirmation-row is-plain"
                  key={rowIndex}
                >
                  {row.value}
                </dd>
              ),
            )}
          </dl>
        ))}
      </div>
      <ConfirmationRequest>
        <ConfirmationActions className="pecu-confirmation-actions">
          {preview.state === "pending" ? (
            <ConfirmationAction
              className="pecu-button pecu-button-quiet"
              disabled={busy || confirming}
              onClick={() => void onSend(`/cancel ${preview.code}`)}
            >
              Cancel
            </ConfirmationAction>
          ) : null}
          <ConfirmationAction
            className="pecu-button pecu-button-primary"
            disabled={busy || confirming}
            onClick={() => void onSend(`/confirm ${preview.code}`)}
          >
            {confirming ? (
              <>
                <Loader2Icon className="size-4 animate-spin" />
                {preview.state === "executing" ? "Checking…" : "Confirming…"}
              </>
            ) : preview.state === "executing" ? (
              "Check transaction"
            ) : (
              "Confirm"
            )}
          </ConfirmationAction>
        </ConfirmationActions>
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
          Pecu read the receipt and checked the user operation itself succeeded.
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
    </Confirmation>
  );
}
