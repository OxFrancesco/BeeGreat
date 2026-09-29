import { createRoot } from "react-dom/client";
import type { TaskView } from "../../../../src/task-contract";
import { Automations } from "../../src/components/automations";
import "./fixture.css";

const day = 86_400_000;
const now = Date.now();
let tasks: TaskView[] = [
  { code: "ABC234", title: "Weekly index rebalance", mode: "run", instruction: "Rebalance my stock index to NVDAc=50, AAPLc=30, TSLAc=20", trigger: { kind: "calendar", time: "09:00", weekdays: [1], timezone: "Europe/Rome" }, schedule: "Mon 09:00 Europe/Rome", state: "active", nextRunAt: now + 3 * day, lastRunAt: now - 4 * day, lastOutcome: "Rebalanced", runCount: 3, channel: "web", threadId: "index01", grant: { scopes: ["trade"], maxUsdPerRun: 50, days: 30, state: "approved", approvedAt: now - 5 * day, expiresAt: now + 25 * day, active: true }, yolo: true, createdAt: now - 6 * day },
  { code: "DEF567", title: "Rebalance ETH/USDC pool", mode: "run", instruction: "Every 30 minutes, if my ETH/USDC position is out of range, withdraw it and open a new one 20% around the price", trigger: { kind: "interval", everyMinutes: 30, startAt: now }, schedule: "Every 30 min", state: "active", nextRunAt: now + 12 * 60_000, lastRunAt: null, lastOutcome: null, runCount: 0, channel: "web", threadId: null, grant: { scopes: ["liquidity"], maxUsdPerRun: 200, days: 30, state: "requested", approvedAt: null, expiresAt: null, active: false }, yolo: false, createdAt: now - day },
  { code: "GHJ892", title: "AERO under $1", mode: "remind", instruction: "AERO dropped below $1. Decide whether to buy.", trigger: { kind: "price", token: "AERO", direction: "below", priceUsd: "1", checkMinutes: 5 }, schedule: "When AERO is at or below $1", state: "active", nextRunAt: now + 60_000, lastRunAt: null, lastOutcome: "Checked at $1.18", runCount: 0, channel: "x", threadId: null, grant: null, yolo: false, createdAt: now - 2 * day },
  { code: "KLM345", title: "Positions heartbeat", mode: "heartbeat", instruction: "Tell me if any liquidity position is out of range or has more than $5 of unclaimed fees", trigger: { kind: "interval", everyMinutes: 60, startAt: now }, schedule: "Every hour", state: "paused", nextRunAt: null, lastRunAt: now - day, lastOutcome: "Nothing needed attention", runCount: 22, channel: "web", threadId: null, grant: null, yolo: false, createdAt: now - 9 * day },
];
window.fetch = async (input, init) => {
  const url = new URL(String(input), location.href);
  if (url.pathname.endsWith("/tasks")) return Response.json({ tasks });
  if (url.pathname.endsWith("/task-action") && init?.method === "POST") {
    const action = JSON.parse(String(init.body));
    const task = tasks.find((item) => item.code === action.code)!;
    const next: TaskView = action.kind === "allow"
      ? { ...task, grant: { ...task.grant!, maxUsdPerRun: action.maxUsd ?? task.grant!.maxUsdPerRun, state: "approved", approvedAt: Date.now(), expiresAt: Date.now() + 30 * day, active: true } }
      : action.kind === "pause" ? { ...task, state: "paused", nextRunAt: null }
      : action.kind === "resume" ? { ...task, state: "active", nextRunAt: Date.now() + 30 * 60_000 }
      : action.kind === "revoke" ? { ...task, grant: { ...task.grant!, state: "revoked", active: false } }
      : task;
    tasks = action.kind === "cancel" ? tasks.filter((item) => item.code !== action.code) : tasks.map((item) => item.code === action.code ? next : item);
    return Response.json({ task: next, message: `Updated ${task.title}.` });
  }
  return Response.json({ error: "not found" }, { status: 404 });
};

function Fixture() {
  return (
    <main className="pecu transaction-fixture">
      <h1>Automations fixture</h1>
      <p>Fictional automations. Requests stay in this page.</p>
      <Automations onOpenThread={() => {}} />
      <div className="pecu-turn" style={{ marginTop: 32 }}>
        <p className="pecu-task-origin">Weekly index rebalance</p>
        <div className="pecu-bubble-bot" style={{ marginTop: 8 }}>Rebalanced your index: sold 0.12 NVDAc and bought 0.4 TSLAc for 18.20 USDC, inside the $50 allowance.</div>
      </div>
    </main>
  );
}
createRoot(document.getElementById("root")!).render(<Fixture />);
