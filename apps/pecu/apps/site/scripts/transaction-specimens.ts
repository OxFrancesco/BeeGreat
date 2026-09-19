import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PreviewCard } from "../../stocks/src/components/preview-card";
import { transactionPreviews } from "../../stocks/tests/fixtures/transaction-previews";

const states = ["pending", "executing", "succeeded", "failed", "cancelled", "expired"] as const;

function specimen(index: number, name: string) {
  const render = (state: (typeof states)[number]) => renderToStaticMarkup(
    createElement(PreviewCard, {
      preview: {
        ...transactionPreviews[index]!,
        state,
        result: state === "failed" ? "Sample error. Check transaction status before retrying." : undefined,
      },
      busy: false,
      confirming: false,
      onSend: async () => {},
    }),
    { identifierPrefix: `transaction-${index}-${state}-` },
  );
  return `<div data-sample-card="${name}"><div data-sample-content>${render("pending")}</div>${states.map((state) => `<template data-preview-state="${state}">${render(state)}</template>`).join("")}</div>`;
}

export const transactionSpecimens = `${specimen(0, "swap")}<h3>Approval</h3>${specimen(6, "approval")}<h3>Basket</h3>${specimen(4, "basket")}`;
