import { expect, test } from "bun:test";
import { generationEvents, toolEvents, type InferenceLogEntry } from "../src/inference-analytics";
import { usageStep, verificationTurn } from "./fixtures/inference-usage";

test("request latency includes the provider wait before the first streamed event", async () => {
  const entries = usageStep("slow", "openrouter", 6000);
  const firstOutput: InferenceLogEntry = { id: "output", created: 6200, durable: { aggregateID: "session-test", seq: 2, version: 1 }, type: "session.text.started", data: { sessionID: "session-test", assistantMessageID: "slow", ordinal: 0 } };
  const [event] = await generationEvents([entries[0], firstOutput, ...entries.slice(1)], verificationTurn, [
    { id: "request", session_id: "session-test", provider: "openrouter", model: "openai/gpt-6-sol", started_at: 1000, response_at: 3000, status: 200 },
  ]);
  expect(event).toMatchObject({ $ai_latency: 6.5, $ai_time_to_first_token: 5.2, http_response_ms: 2000, stream_duration_ms: 1500, timestamp: 7500, started_at: 1000, latency_source: "http_request" });
});

test("tool failures retain their own timings without inputs, output or error text", async () => {
  const durable = { aggregateID: "session-test", seq: 1, version: 1 as const };
  const base = { id: "evt_tool", durable, created: 2000 };
  const data = { sessionID: "session-test", assistantMessageID: "step", id: "private-call-id" };
  const entries: InferenceLogEntry[] = [
    { ...base, type: "session.tool.input.started", data: { ...data, name: "nansen_token_info" } },
    { ...base, type: "session.tool.called", data: { ...data, input: { token: "private-token" }, executed: false } },
    { ...base, durable: { ...durable, version: 2 }, created: 7300, type: "session.tool.failed", data: { ...data, error: { type: "unknown", message: "private failure" }, executed: false } },
  ];
  const [event] = await toolEvents([...entries, entries[2]], verificationTurn);
  expect(event).toMatchObject({ event: "$ai_span", timestamp: 7300, started_at: 2000, $ai_latency: 5.3, $ai_is_error: true, tool_name: "nansen_token_info" });
  expect(await toolEvents([...entries, entries[2]], verificationTurn)).toHaveLength(1);
  expect(JSON.stringify(event)).not.toMatch(/private|session-test|analytics-inference-verification/);
  const [generation] = await generationEvents(usageStep("step"), verificationTurn);
  expect(event.$ai_parent_id).toBe(generation.$ai_span_id);
  expect(event.$ai_trace_id).toBe(generation.$ai_trace_id);
});

test("retries include failed-attempt waits and do not consume other sessions or auxiliary models", async () => {
  const request = { id: "r", session_id: "session-test", provider: "openrouter", model: "openai/gpt-6-sol", started_at: 1000, response_at: 2000, status: 503 };
  const [event] = await generationEvents(usageStep("retry", "openrouter", 6000), verificationTurn, [
    { ...request, session_id: "other-session", started_at: 900 },
    { ...request, model: "title-model", started_at: 950 },
    request,
    { ...request, id: "r2", started_at: 4000, response_at: 5500, status: 200 },
  ]);
  expect(event).toMatchObject({ $ai_latency: 6.5, timestamp: 7500, started_at: 1000, request_count: 2, $ai_is_error: false });
});

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

test("a follow-up request can start in the same millisecond as the previous step ends", async () => {
  const first = usageStep("first", "openrouter", 2000);
  const end = first[2];
  if (end.type !== "session.step.ended") throw new Error("fixture");
  const previousEnd = end.created;
  const request = { session_id: "session-test", provider: "openrouter", model: "openai/gpt-6-sol", response_at: null, status: null };
  const events = await generationEvents([...first, ...usageStep("second", "openrouter", previousEnd + 4000)], verificationTurn, [
    { ...request, id: "first", started_at: 1000 },
    { ...request, id: "second", started_at: previousEnd },
  ]);
  expect(events.map((event) => event.request_count)).toEqual([1, 1]);
  expect(events[1]).toMatchObject({ started_at: previousEnd, $ai_latency: 5.5, latency_source: "http_request" });
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

test("successful tools report discarded output separately from API success without leaking content", async () => {
  const durable = { aggregateID:"session-test",seq:1,version:1 as const };
  const data = {sessionID:"session-test",assistantMessageID:"step",id:"call"};
  const base = {id:"evt",created:2000,durable};
  const entries: InferenceLogEntry[] = [
    {...base,type:"session.tool.input.started",data:{...data,name:"polymarket_search"}},
    {...base,type:"session.tool.called",data:{...data,input:{q:"private search"},executed:false}},
    {...base,created:2300,durable:{...durable,version:2},type:"session.tool.success",data:{...data,content:[{type:"text",text:"private result"}],metadata:{truncated:true,pecu_output_bytes:155870,pecu_source_bytes:200000,pecu_output_partial:true},executed:false}},
  ];
  const [event] = await toolEvents(entries,verificationTurn);
  expect(event).toMatchObject({$ai_is_error:false,output_truncated:true,output_partial:true,output_bytes:155870,source_output_bytes:200000,returned_output_bytes:14});
  expect(JSON.stringify(event)).not.toContain("private");
});
