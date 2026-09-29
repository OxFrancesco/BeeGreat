import { expect, test } from "bun:test";
import type { TaskView } from "../../../src/task-contract";
import { allowanceText, automationMeta } from "../src/lib/automations";

const task = (over: Partial<TaskView> = {}): TaskView => ({
  code: "ABC234", title: "Buy NVDA", mode: "run", instruction: "Buy $20 of NVDAc", trigger: { kind: "interval", everyMinutes: 1440, startAt: 1 },
  schedule: "Every day", state: "active", nextRunAt: null, lastRunAt: null, lastOutcome: null, runCount: 0, channel: "web", threadId: null,
  grant: null, yolo: false, createdAt: 1, ...over,
});
const grant = { scopes: ["trade" as const], maxUsdPerRun: 25, days: 30, approvedAt: null, expiresAt: null };

test("the meta line names the mode and schedule, or the paused and finished states", () => {
  expect(automationMeta(task())).toBe("Runs Pecu · Every day");
  expect(automationMeta(task({ state: "paused", mode: "heartbeat" }))).toBe("Heartbeat · Paused");
  expect(automationMeta(task({ state: "completed", mode: "remind" }))).toBe("Reminder · Finished");
});

test("the allowance reads as one plain sentence for every state", () => {
  expect(allowanceText(task())).toBeNull();
  expect(allowanceText(task({ grant: { ...grant, state: "requested", active: false } }))).toBe("Asks to execute trades up to $25 per run.");
  expect(allowanceText(task({ grant: { ...grant, state: "approved", expiresAt: Date.UTC(2030, 0, 5), active: true } }))).toContain("YOLO is off in its chat");
  expect(allowanceText(task({ yolo: true, grant: { ...grant, state: "approved", expiresAt: Date.UTC(2030, 0, 5), active: true } }))).not.toContain("YOLO");
  expect(allowanceText(task({ grant: { ...grant, state: "approved", expiresAt: 1, active: false } }))).toBe("Allowance expired. Transactions wait for your confirmation.");
});
