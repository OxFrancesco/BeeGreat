import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SafeTransactions } from "../../stocks/src/components/profile/safe-transactions";
import { pendingSend, treasuryDetail } from "../../stocks/tests/fixtures/safe-profile";

const noop = () => {};

export const safeSpecimen = `<div class="pecu safe-specimen">${renderToStaticMarkup(
  createElement(SafeTransactions, { detail: { ...treasuryDetail, queue: [pendingSend], history: [] }, onChanged: noop, onIntent: noop, onReject: noop }),
)}</div>`;
