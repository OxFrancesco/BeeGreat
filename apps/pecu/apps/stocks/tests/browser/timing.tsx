import { createRoot } from "react-dom/client";
import { TurnProgress } from "../../src/components/turn-progress";
import "./fixture.css";

createRoot(document.getElementById("root")!).render(
  <main className="transaction-fixture">
    <h1>Turn timing test</h1>
    <p>Build mode: {import.meta.env.MODE}. Simulated completed stages.</p>
    <TurnProgress pending={false} stages={[
      { id: "positions", label: "Reading Aerodrome", status: "complete", startedAt: 1000, endedAt: 2200 },
      { id: "model", label: "Generating answer", status: "complete", startedAt: 2200, endedAt: 5700 },
    ]} />
  </main>,
);
