import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { AnalyticsCard } from "../src/components/analytics-card";
import { PolymarketCard } from "../src/components/polymarket-cards";
import { analyticsFixtures } from "./fixtures/nansen-analytics";
import { polymarketFixtures } from "./fixtures/polymarket-analytics";

test("every Polymarket card renders exact odds, units and the Polymarket source", () => {
  const html = renderToStaticMarkup(<>{polymarketFixtures.map((snapshot) => <PolymarketCard key={snapshot.key} snapshot={snapshot} />)}</>);
  expect(html).toContain("Fed Decision in October?");
  expect(html).toContain("53.5%");
  expect(html).toContain("View on Polymarket");
  expect(html).toContain("Bids");
  expect(html).toContain("14.0¢");
  expect(html).toContain("Top traders by profit");
  expect(html).toContain("https://polymarket.com/profile/0x0f6f76ced62a911bccef92f50faaff143854d977");
  expect(html).toContain("Biggest winning positions");
  expect(html).toContain("Alex Michelsen");
  expect(html.match(/Data: Polymarket/g)).toHaveLength(polymarketFixtures.length);
  expect(html).not.toContain("NaN");
  expect(html).not.toContain("Infinity");
  expect(html).not.toContain("Data: Nansen");
});

test("the shared card picks the renderer by source and illustrative cards claim no retrieval", () => {
  const nansen = renderToStaticMarkup(<AnalyticsCard snapshot={analyticsFixtures[0]!} />);
  expect(nansen).toContain("Data: Nansen");
  const polymarket = renderToStaticMarkup(<AnalyticsCard snapshot={polymarketFixtures[0]!} illustrative />);
  expect(polymarket).toContain("Illustrative data");
  expect(polymarket).not.toContain("Retrieved");
});

test("empty Polymarket pages say so instead of drawing empty charts", () => {
  const empty = polymarketFixtures.map((snapshot) => {
    switch (snapshot.kind) {
      case "pm_history": return { ...snapshot, points: [] };
      case "pm_trader": return { ...snapshot, points: [] };
      case "pm_book": return { ...snapshot, bids: [], asks: [] };
      case "pm_odds": case "pm_markets": case "pm_leaderboard": case "pm_wins": case "pm_positions": return { ...snapshot, rows: [] };
    }
  });
  const html = renderToStaticMarkup(<>{empty.map((snapshot) => <PolymarketCard key={snapshot.key} snapshot={snapshot} />)}</>);
  for (const message of ["No open outcomes returned.", "No markets returned.", "Not enough price points", "No bids.", "No traders returned.", "No winning positions returned.", "Not enough P&amp;L points", "No positions returned."]) expect(html).toContain(message);
});
