import { useState } from "react";
import { createRoot } from "react-dom/client";
import { NansenChart } from "../../src/components/nansen-charts";
import { analyticsFixtures } from "../fixtures/nansen-analytics";
import "./fixture.css";

function AnalyticsFixture() {
  const [index, setIndex] = useState(0);
  const snapshot = analyticsFixtures[index];
  return <main className="pecu transaction-fixture">
    <h1>Nansen charts</h1>
    <p>Fictional data. These are the production chart components.</p>
    <div className="transaction-fixture-controls"><label>Example<select value={index} onChange={(event) => setIndex(Number(event.target.value))}>
      {['Cohort flows', 'Trading P&L', 'Portfolio exposure', 'Missing values', 'No trades', 'Unavailable wallet balances'].map((label, i) => <option key={label} value={i}>{label}</option>)}
    </select></label></div>
    {snapshot ? <NansenChart key={snapshot.key} snapshot={snapshot} /> : null}
  </main>;
}
const root = document.getElementById("root");
if (root) createRoot(root).render(<AnalyticsFixture />);
