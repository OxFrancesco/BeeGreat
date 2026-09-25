import { expect, test } from "bun:test";
import { compare } from "./compare";

test("blocked, skipped and missing passes are regressions, not omissions", () => {
  const baseline = { scope: "full" as const, rows: ["same", "failed", "blocked", "skipped", "missing"].map((id) => ({ id, status: "pass" as const, evidence: ["before.json"] })) };
  expect(compare(baseline, { scope: "partial", rows: [
    { id: "same", status: "pass", evidence: ["after.json"] },
    { id: "failed", status: "fail", evidence: [] },
    { id: "blocked", status: "blocked", evidence: [] },
    { id: "skipped", status: "skipped", evidence: [] },
  ] }).map((row) => row.after)).toEqual(["fail", "blocked", "skipped", "missing"]);
  expect(() => compare({ ...baseline, scope: "partial" }, baseline)).toThrow("last full run");
});
