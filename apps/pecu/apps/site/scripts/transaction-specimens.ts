import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PreviewCard } from "../../stocks/src/components/preview-card";
import { planAt } from "../../stocks/tests/fixtures/transaction-plans";
import { transactionPreviews } from "../../stocks/tests/fixtures/transaction-previews";

const states = ["pending", "executing", "succeeded", "failed", "cancelled", "expired"] as const;

function specimen(index: number, name: string) {
  const preview = transactionPreviews[index]!;
  const render = (state: (typeof states)[number]) => renderToStaticMarkup(
    createElement(PreviewCard, {
      preview: {
        ...preview,
        state,
        result: state === "failed" ? "Sample error. Check transaction status before retrying." : undefined,
        ...(preview.plan ? { plan: planAt(preview.plan, state) } : {}),
      },
      busy: false,
      confirming: false,
      onSend: async () => {},
    }),
    { identifierPrefix: `transaction-${index}-${state}-` },
  );
  return `<div data-sample-card="${name}"><div data-sample-content>${render("pending")}</div>${states.map((state) => `<template data-preview-state="${state}">${render(state)}</template>`).join("")}</div>`;
}

const stateSelect = (id: string, label: string) =>
  `<label for="${id}">${label}</label><select id="${id}">${states.map((s) => `<option value="${s}">${s}</option>`).join("")}</select>`;

export const transactionSpecimens = `${specimen(0, "swap")}<h3>Approval</h3>${specimen(6, "approval")}<h3>Basket</h3>${specimen(4, "basket")}`;

export const planSpecimens = `<h3>Route and transactions</h3><p>Each preview lists the transactions it will sign, decoded from the exact calls, and draws where the tokens go. Numbers on the route match the list. Point at a transaction to highlight its part of the route. The route animates only while the plan waits for a decision.</p>${stateSelect("plan-state", "Plan state")}${specimen(13, "pool")}<h3>Multi-hop swap</h3>${specimen(14, "multihop")}`;
