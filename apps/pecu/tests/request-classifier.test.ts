import { expect, test } from "bun:test";
import { TypeSafeRequestClassifier } from "../src/request-classifier";

test("selects a stable tool family in the same classifier request", async () => {
  let calls = 0;
  const classifier = new TypeSafeRequestClassifier("test", async (_url, init) => {
    calls++;
    expect(JSON.parse(String(init?.body)).questions.family.criteria).toHaveProperty("wallet");
    return Response.json({ answers: { route: { choice: "mixed", confidence: 0.99 }, family: { choice: "wallet", confidence: 0.99 } } });
  });
  expect(await classifier.classify("Create a Safe")).toEqual({ kind: "mixed", family: "wallet" });
  expect(calls).toBe(1);
});

test("uncertain or malformed family classifications keep all capabilities available", async () => {
  for (const family of [{ choice: "wallet", confidence: 0.5 }, { choice: "execute", confidence: 1 }, null]) {
    const classifier = new TypeSafeRequestClassifier("test", async () => Response.json({ answers: { route: { choice: "mixed", confidence: 0.99 }, family } }));
    expect(await classifier.classify("continue")).toEqual({ kind: "mixed" });
  }
});

test.each(["wallet", "balance", "stocks", "positions", "deposit_status", "help"])("maps %s to an allowlisted command", async (label) => {
  const classifier = new TypeSafeRequestClassifier("test", async (url, init) => {
    expect(url).toBe("https://api.typesafe.ai/v1/systemone");
    const body = JSON.parse(String(init?.body));
    expect(body.state).toEqual({ userMessage: "synthetic request" });
    expect(Object.keys(body.questions.route.criteria)).not.toContain("confirm");
    return Response.json({ answers: { route: { choice: label, confidence: 0.99 } } });
  });
  expect(await classifier.classify("synthetic request")).toEqual({ kind: "command", command: label });
});

test.each(["response", "mixed"])("preserves %s routing", async (label) => {
  const classifier = new TypeSafeRequestClassifier("test", async () => Response.json({ answers: { route: { choice: label, confidence: 0.95 } } }));
  expect(await classifier.classify("synthetic request")).toEqual({ kind: label });
});

test.each([
  { choice: "wallet", confidence: 0.5 },
  { choice: "confirm", confidence: 1 },
  { choice: "wallet", confidence: 2 },
  { choice: "wallet" },
  null,
])("invalid or uncertain answers retain the existing agent", async (answer) => {
  const classifier = new TypeSafeRequestClassifier("test", async () => Response.json({ answers: { route: answer } }));
  expect(await classifier.classify("synthetic request")).toEqual({ kind: "fallback" });
});

test("HTTP failures do not retry or block the existing agent", async () => {
  let calls = 0;
  const classifier = new TypeSafeRequestClassifier("test", async () => { calls++; return new Response(null, { status: 503 }); });
  expect(await classifier.classify("hello")).toEqual({ kind: "fallback" });
  expect(calls).toBe(1);
});

test("oversized messages bypass classification", async () => {
  const classifier = new TypeSafeRequestClassifier("test", async () => { throw new Error("must not call API"); });
  expect(await classifier.classify("x".repeat(8001))).toEqual({ kind: "fallback" });
});

test("an uncertain command never executes, but independently confident scope is retained", async () => {
  for (const choice of ["mixed", "wallet", "response"]) {
    const classifier = new TypeSafeRequestClassifier("test", async () => Response.json({ model: "jev-test", answers: {
      route: { choice, confidence: 0.86 }, family: { choice: "defi", confidence: 0.99 },
    } }));
    expect(await classifier.classify("synthetic uncertain request")).toEqual({ kind: "fallback", family: "defi" });
  }
});
