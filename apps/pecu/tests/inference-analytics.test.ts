import { expect, test } from "bun:test";
import { generationEvents, type InferenceLogEntry } from "../src/inference-analytics";
import { usageStep, verificationTurn } from "./fixtures/inference-usage";

test("counts cache and reasoning once and excludes tool settlement latency and content", async () => {
  const events = await generationEvents(usageStep("first"), verificationTurn);
  expect(events).toHaveLength(1);
  expect(events[0]).toMatchObject({ $ai_input_tokens: 140, $ai_output_tokens: 50,
    $ai_cache_read_input_tokens: 40, $ai_reasoning_tokens: 30, $ai_latency: 1.5,
    $ai_total_cost_usd: 0.00123, cost_is_estimate: true, billing: "chatgpt_subscription" });
  const encoded = JSON.stringify(events);
  for (const privateValue of [verificationTurn.senderId, verificationTurn.eventId, verificationTurn.conversationId, "do not capture", "session-test"]) expect(encoded).not.toContain(privateValue);
  expect(events[0]).not.toHaveProperty("$ai_input");
  expect(events[0]).not.toHaveProperty("$ai_output_choices");
});

test("captures all tool-loop steps and fallback, ignoring history and duplicate endings", async () => {
  const second = usageStep("second", "openrouter", 8000);
  const events = await generationEvents([...usageStep("old", "openai", 0), ...usageStep("first"), ...second, second[2]], verificationTurn);
  expect(events).toHaveLength(2);
  expect(events[0].$ai_trace_id).toBe(events[1].$ai_trace_id);
  expect(events[0].$ai_span_id).not.toBe(events[1].$ai_span_id);
  expect(events[1].billing).toBe("openrouter_api");
  const otherUser = await generationEvents(second, { ...verificationTurn, senderId: "someone-else" });
  expect(otherUser[0].$ai_session_id).not.toBe(events[1].$ai_session_id);
});

test("failed generations preserve missing usage instead of claiming zero cost or leaking errors", async () => {
  const entries = usageStep("failed");
  const failed: InferenceLogEntry = { id: "evt_failure", created: 2000,
    durable: { aggregateID: "session-test", seq: 2, version: 1 }, type: "session.step.failed",
    data: { sessionID: "session-test", assistantMessageID: "failed", error: { type: "provider.error", message: "secret error" } } };
  const [event] = await generationEvents([entries[0], failed], verificationTurn);
  expect(event).toMatchObject({ $ai_is_error: true, usage_available: false });
  expect(event).not.toHaveProperty("$ai_input_tokens");
  expect(event).not.toHaveProperty("$ai_total_cost_usd");
  expect(JSON.stringify(event)).not.toContain("secret error");
});

test("zero catalog cost remains unknown and failed calls retain reported usage", async () => {
  const entries = usageStep("zero");
  const end = entries[2];
  if (end.type !== "session.step.ended") throw new Error("fixture");
  const [zero] = await generationEvents([entries[0], { ...end, data: { ...end.data, cost: 0 } }], verificationTurn);
  expect(zero).not.toHaveProperty("$ai_total_cost_usd");
  expect(zero.cost_source).toBe("posthog_model_estimate");
  const [failed] = await generationEvents([entries[0], { ...end, type: "session.step.failed", data: { ...end.data, finish: undefined, error: { type: "provider.error", message: "private" } } }], verificationTurn);
  expect(failed.$ai_input_tokens).toBe(140);
  expect(failed.$ai_total_cost_usd).toBe(0.00123);
});

test("harness drains durable usage and preserves replies and errors when telemetry fails", async () => {
  const child = Bun.spawn([process.execPath, new URL("./fixtures/inference-analytics-check.ts", import.meta.url).pathname], { stdout: "pipe", stderr: "pipe" });
  const [out, err, code] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited]);
  expect(code).toBe(0);
  expect(JSON.parse(err.trim())).toMatchObject({ level: "warn", message: "inference_analytics_failed" });
  expect(err).not.toContain("private log error");
  expect(out).toContain("failed-wait capture passed");
});
