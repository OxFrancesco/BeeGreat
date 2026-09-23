import { isPolymarketSnapshot, type AnalyticsSnapshot } from "../../../../src/analytics-contract";
import { NansenChart } from "./nansen-charts";
import { PolymarketCard } from "./polymarket-cards";

export function AnalyticsCard({ snapshot, illustrative = false }: { snapshot: AnalyticsSnapshot; illustrative?: boolean }) {
  return isPolymarketSnapshot(snapshot) ? <PolymarketCard snapshot={snapshot} illustrative={illustrative} /> : <NansenChart snapshot={snapshot} illustrative={illustrative} />;
}
