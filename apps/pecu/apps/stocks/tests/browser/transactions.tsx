import { useState } from "react";
import { PreviewCard } from "../../src/components/preview-card";
import type { ConfirmationState } from "../../src/components/ai-elements/confirmation";
import { transactionPreviews } from "../fixtures/transaction-previews";

export function TransactionFixture() {
  const [index, setIndex] = useState(0);
  const [state, setState] = useState<ConfirmationState>("pending");
  const [confirming, setConfirming] = useState(false);
  const [command, setCommand] = useState("");
  const preview = transactionPreviews[index]!;
  return (
    <main className="pecu transaction-fixture">
      <h1>Transaction previews</h1>
      <p>Fictional data. Buttons only change this local example.</p>
      <div className="transaction-fixture-controls">
        <label>
          Example
          <select
            disabled={confirming}
            value={index}
            onChange={(e) => {
              setIndex(Number(e.target.value));
              setState("pending");
              setCommand("");
            }}
          >
            {transactionPreviews.map((p, i) => (
              <option value={i} key={p.code}>
                {i + 1}. {p.title}
                {i === 8 ? " · long amounts" : ""}
              </option>
            ))}
          </select>
        </label>
        <label>
          State
          <select
            disabled={confirming}
            value={state}
            onChange={(e) => setState(e.target.value as ConfirmationState)}
          >
            {[
              "pending",
              "executing",
              "succeeded",
              "failed",
              "cancelled",
              "expired",
            ].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
      </div>
      <PreviewCard
        preview={{
          ...preview,
          state,
          result:
            state === "failed"
              ? "Sample error. Check transaction status before retrying."
              : undefined,
        }}
        busy={confirming}
        confirming={confirming}
        onSend={async (text) => {
          setCommand(text);
          if (text.startsWith("/cancel")) {
            setState("cancelled");
            return;
          }
          setConfirming(true);
          await new Promise((resolve) => setTimeout(resolve, 900));
          setState(state === "executing" ? "succeeded" : "executing");
          setConfirming(false);
        }}
      />
      <output>{command ? `Local command: ${command}` : ""}</output>
    </main>
  );
}
