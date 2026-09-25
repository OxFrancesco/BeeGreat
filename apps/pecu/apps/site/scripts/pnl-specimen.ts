import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PnlPreviewBody } from "../../stocks/src/components/wallet-pnl";
import { analyticsFixtures } from "../../stocks/tests/fixtures/nansen-analytics";

const snapshot = analyticsFixtures.find((fixture) => fixture.kind === "pnl" && fixture.rows.length);
if (!snapshot || snapshot.kind !== "pnl") throw new Error("Missing P&L specimen");

export const pnlSpecimen = `<div class="pecu pecu-pnl-card"><div class="pecu-pnl-card-head"><span>P&amp;L · 30 days</span></div>${renderToStaticMarkup(
  createElement(PnlPreviewBody, { snapshot, now: snapshot.observedAt + 2 * 60_000 }),
)}</div>`;
