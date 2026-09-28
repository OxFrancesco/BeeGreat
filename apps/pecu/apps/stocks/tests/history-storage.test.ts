import { expect, test } from "bun:test";
import { historySnapshot, readHistorySnapshot } from "../src/lib/history-storage";
import type { WebState } from "../../../src/web-contract";
const state = (id: string): WebState => ({ threadId: id, wallet: null, yolo: false, messages: [], stocks: null, stocksAt: null, basket: null });
const threads = { threads: [], olderCursor: null, newerCursor: null };
test("disk snapshots expire and reject invalid schemas without renewing their timestamp", () => {
  const snapshot = historySnapshot(threads, [state("a")]);
  const at = Date.now() - 1000;
  expect(readHistorySnapshot({ ...snapshot, at })?.at).toBe(at);
  expect(readHistorySnapshot({ ...snapshot, at: Date.now() - 86_400_001 })).toBeNull();
  expect(readHistorySnapshot({ ...snapshot, states: [null] })).toBeNull();
  expect(readHistorySnapshot({ ...snapshot, at: Date.now() + 120_000 })).toBeNull();
});
test("disk snapshots bound retained histories and skip oversized payloads", () => {
  const snapshot = historySnapshot(threads, Array.from({ length: 100 }, (_, i) => state(String(i))));
  expect(snapshot.states.length).toBe(12);
  expect(snapshot.states[0]?.threadId).toBe("88");
  const large = { ...state("large"), messages: [{ id: "large", text: "x".repeat(4 * 1024 * 1024), createdAt: 1, reply: null }] };
  expect(historySnapshot(threads, [state("small"), large]).states.map(s => s.threadId)).toEqual(["small"]);
});
