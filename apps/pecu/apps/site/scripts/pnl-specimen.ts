import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { PnlSnapshot } from "../../../src/analytics-contract";
import { PnlPreviewBody } from "../../stocks/src/components/wallet-pnl";
import { analyticsFixtures } from "../../stocks/tests/fixtures/nansen-analytics";

const snapshot = analyticsFixtures.find((fixture) => fixture.kind === "pnl" && fixture.rows.length) as PnlSnapshot;

export const pnlSpecimen = `<div class="pecu pecu-pnl-card"><div class="pecu-pnl-card-head"><span>P&amp;L · 30 days</span></div>${renderToStaticMarkup(
  createElement(PnlPreviewBody, { snapshot, now: snapshot.observedAt + 2 * 60_000 }),
)}</div>`;
