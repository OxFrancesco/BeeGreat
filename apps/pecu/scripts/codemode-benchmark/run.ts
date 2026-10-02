import { createHash } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { CodeMode, Tool } from "@opencode-ai/codemode";
import { Effect, Schema } from "effect";
import { z } from "zod";
import { jsonValueSchema, type JsonFields, type JsonValue } from "../../src/json-contract";
import { fallbackModels } from "../../src/cloudflare/opencode";
import { capture, catalog, equivalent, lookup, scenarios, snapshotSchema, type Scenario } from "./data";

const directory = process.argv[2];
if (!directory) throw new Error("Usage: bun scripts/codemode-benchmark/run.ts OUTPUT_DIRECTORY [samples=4]");
const samples = z.coerce.number().int().min(1).max(10).parse(process.argv[3] ?? 4);
const model = process.env.PECU_BENCH_MODEL ?? fallbackModels.default.id;
const effort = process.env.PECU_BENCH_EFFORT ?? fallbackModels.default.variant;
const budget = z.coerce.number().positive().max(25).parse(process.env.PECU_BENCH_BUDGET_USD ?? 5);
const vars = Bun.file(new URL("../../.dev.vars", import.meta.url));
const key = process.env.OPENROUTER_API_KEY ?? (/^OPENROUTER_API_KEY=(.*)$/m.exec(await vars.text())?.[1]?.trim().replace(/^["']|["']$/g, ""));
if (!key) throw new Error("OPENROUTER_API_KEY unavailable");
await mkdir(directory, { recursive: true });
if (await Bun.file(`${directory}/results.json`).exists()) throw new Error("Choose a new output directory to preserve previous evidence.");
const snapshot = process.env.PECU_BENCH_SNAPSHOT
  ? snapshotSchema.parse(await Bun.file(process.env.PECU_BENCH_SNAPSHOT).json())
  : await capture();
const snapshotText = JSON.stringify(snapshot, null, 2);
await Bun.write(`${directory}/snapshot.json`, snapshotText);
const cases = scenarios(snapshot).filter(item => !process.env.PECU_BENCH_CASES || process.env.PECU_BENCH_CASES.split(",").includes(item.id));
if (!cases.length) throw new Error("No matching benchmark cases");
await Bun.write(`${directory}/expected.json`, JSON.stringify(cases, null, 2));

const completionSchema = z.object({
  id: z.string(), model: z.string(),
  choices: z.array(z.object({ finish_reason: z.string().nullish(), message: z.object({
    content: z.string().nullish(), reasoning: z.string().nullish(), reasoning_details: z.array(jsonValueSchema).optional(),
    tool_calls: z.array(z.object({ id: z.string(), type: z.literal("function"), function: z.object({ name: z.string(), arguments: z.string() }) })).optional(),
  }) })),
  usage: z.object({ prompt_tokens: z.number(), completion_tokens: z.number(), cost: z.number(), prompt_tokens_details: z.object({ cached_tokens: z.number().optional() }).optional() }),
});
type Mode = "direct" | "codemode";
type Trace = { step: number; elapsedMs: number; requestBytes: number; id: string; model: string; promptTokens: number; completionTokens: number; cachedTokens: number; cost: number; finishReason: string | null | undefined; content: string | null | undefined; calls: { name: string; arguments: string; output: string }[] };
type ToolCall = { name: string; input: unknown; elapsedMs: number; error?: string };
type Row = { case: string; sample: number; mode: Mode; elapsedMs: number; correct: boolean; answer: string; error?: string; toolCalls: ToolCall[]; traces: Trace[] };
const rows: Row[] = [];
let spent = 0;
let budgetUsed = 0;
const toolSchema: z.ZodType<Tool.JsonSchema> = z.lazy(() => z.object({
  type: z.union([z.string(), z.array(z.string())]).optional(),
  properties: z.record(z.string(), toolSchema).optional(),
  required: z.array(z.string()).optional(),
  additionalProperties: z.union([z.boolean(), toolSchema]).optional(),
  items: toolSchema.optional(), enum: z.array(z.unknown()).optional(),
  anyOf: z.array(toolSchema).optional(), oneOf: z.array(toolSchema).optional(),
  description: z.string().optional(), default: z.unknown().optional(),
  minimum: z.number().optional(), maximum: z.number().optional(),
}));
const system = "You are Pecu answering a read-only benchmark request. Use tools for all data; never invent numbers. Return only the requested JSON with no markdown. Preserve missing data as null. Independent calls may run in parallel; sequence dependent calls. Do not retry unavailable data. The tools replay one captured public dataset: chain_metric requires metric=tvl, days=90; chain_dexes requires window=7d, limit=25. Both return JSON text strings. Do not make other parameter choices. No wallet actions or transaction tools are available.";
const codeInstructions = "Use execute to run JavaScript with top-level await and return. Call tools using the exact catalog paths. Tool results are JSON text: JSON.parse them before using fields. Parallelize independent calls with Promise.all or Promise.allSettled. Filter and calculate inside the program and return only what the answer needs. Await all useful work. No imports, filesystem, network or timers. search() discovers tools. Catalog:\n";

async function run(mode: Mode, scenario: Scenario, sample: number): Promise<Row> {
  const started = performance.now();
  const calls: ToolCall[] = [];
  const traces: Trace[] = [];
  let answer = "";
  const invoke = async (name: string, input: JsonValue) => {
    const start = performance.now();
    try {
      if (calls.length >= 24) throw new Error("Per-run tool budget exhausted");
      const content = lookup(snapshot, name, input);
      const args = z.object({ chain: z.string() }).parse(input);
      if (scenario.id === "partial-failure" && args.chain.toLowerCase() === "arbitrum") throw new Error("Arbitrum upstream unavailable for this sample");
      calls.push({ name, input, elapsedMs: performance.now() - start });
      return content;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Tool failed";
      calls.push({ name, input, elapsedMs: performance.now() - start, error: message });
      throw new Error(message);
    }
  };
  const runtime = CodeMode.make({
    tools: Object.fromEntries(catalog.map(tool => [tool.name, Tool.make({
      description: tool.description, input: toolSchema.parse(z.toJSONSchema(tool.input)), output: Schema.String,
      execute: input => Effect.tryPromise(() => invoke(tool.name, jsonValueSchema.parse(input))),
    })])),
    limits: { timeoutMs: 10_000, maxToolCalls: 24, maxOutputBytes: 16_000 },
  });
  const tools = mode === "direct"
    ? catalog.map(tool => ({ type: "function", function: { name: tool.name, description: tool.description, parameters: z.toJSONSchema(tool.input) } }))
    : [{ type: "function", function: { name: "execute", description: codeInstructions + JSON.stringify(runtime.catalog()), parameters: { type: "object", properties: { code: { type: "string" } }, required: ["code"], additionalProperties: false } } }];
  const messages: JsonFields[] = [{ role: "system", content: system }, { role: "user", content: scenario.text }];
  try {
    for (let step = 0; step < 8; step++) {
      if (budgetUsed >= budget) throw new Error("Experiment spending ceiling reached");
      if (performance.now() - started > 240_000) throw new Error("Run exceeded four minutes");
      const body = JSON.stringify({ model, provider: { only: ["openai"] }, reasoning: { effort }, max_tokens: 8000, messages, tools, parallel_tool_calls: true });
      const before = performance.now();
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body, signal: AbortSignal.timeout(120_000),
      });
      if (!response.ok) { await response.body?.cancel(); throw new Error(`OpenRouter HTTP ${response.status}`); }
      const data = completionSchema.parse(await response.json());
      spent += data.usage.cost;
      budgetUsed += Math.max(data.usage.cost, (data.usage.prompt_tokens * 2 + data.usage.completion_tokens * 10) / 1_000_000);
      const choice = data.choices[0];
      if (!choice) throw new Error("Provider returned no completion");
      const message = choice.message;
      const trace: Trace = { step, elapsedMs: performance.now() - before, requestBytes: Buffer.byteLength(body), id: data.id, model: data.model, promptTokens: data.usage.prompt_tokens, completionTokens: data.usage.completion_tokens, cachedTokens: data.usage.prompt_tokens_details?.cached_tokens ?? 0, cost: data.usage.cost, finishReason: choice.finish_reason, content: message.content, calls: [] };
      traces.push(trace);
      if (!message.tool_calls?.length) {
        answer = message.content ?? "";
        const actual = jsonValueSchema.parse(JSON.parse(answer));
        const readCount = new Set(calls.map(call => JSON.stringify([call.name, z.object({ chain: z.string() }).parse(call.input).chain.toLowerCase()]))).size;
        const noRetries = scenario.id !== "partial-failure" || calls.filter(call => call.error).length === 1;
        return { case: scenario.id, sample, mode, elapsedMs: performance.now() - started, correct: readCount >= scenario.minimumCalls && noRetries && equivalent(actual, scenario.expected), answer, toolCalls: calls, traces };
      }
      messages.push({ role: "assistant", ...message });
      const results = await Promise.all(message.tool_calls.map(async call => {
        let output: string;
        try {
          const input = jsonValueSchema.parse(JSON.parse(call.function.arguments));
          if (mode === "codemode") {
            if (call.function.name !== "execute") throw new Error("Only execute is available");
            const { code } = z.object({ code: z.string() }).parse(input);
            const result = await Effect.runPromise(runtime.execute(code));
            output = JSON.stringify(result);
          } else output = await invoke(call.function.name, input);
        } catch (error) { output = JSON.stringify({ error: error instanceof Error ? error.message : "Tool failed" }); }
        trace.calls.push({ name: call.function.name, arguments: call.function.arguments, output });
        return { role: "tool", tool_call_id: call.id, content: output };
      }));
      messages.push(...results);
    }
    throw new Error("Eight model steps exhausted");
  } catch (error) {
    return { case: scenario.id, sample, mode, elapsedMs: performance.now() - started, correct: false, answer, error: error instanceof Error ? error.message : "Run failed", toolCalls: calls, traces };
  }
}

const metadata = { model, effort, samples, budgetUsd: budget, runtime: "@opencode-ai/codemode@0.0.0-beta-18684", snapshotSha256: createHash("sha256").update(snapshotText).digest("hex"), scope: "Live OpenRouter model plus real OpenCode interpreter, replaying public production chain_* tool outputs. Custom isolated model loop; not production OpenCode sessions, Cloudflare, ChatGPT subscription, wallet tools or UI latency. Both modes may parallelize. No artificial tool delays. Cache uncontrolled and recorded. Partial failure deliberately injected. Numeric tolerance 0.1%." };
for (let sample = 0; sample < samples; sample++) {
  for (const [index, scenario] of cases.entries()) {
    const order: Mode[] = (sample + index) % 2 ? ["codemode", "direct"] : ["direct", "codemode"];
    for (const mode of order) {
      if (budgetUsed >= budget) throw new Error(`Budget reached after ${rows.length} runs; partial results saved`);
      const row = await run(mode, scenario, sample);
      rows.push(row);
      await Bun.write(`${directory}/results.json`, JSON.stringify({ ...metadata, providerReportedCostUsd: spent, budgetAccountedUsd: budgetUsed, rows }, null, 2));
      console.log(JSON.stringify({ case: row.case, sample, mode, correct: row.correct, seconds: Math.round(row.elapsedMs / 100) / 10, steps: row.traces.length, toolCalls: row.toolCalls.length, promptTokens: row.traces.reduce((sum, step) => sum + step.promptTokens, 0), spentUsd: Math.round(spent * 1000) / 1000, error: row.error }));
      if (row.error?.startsWith("OpenRouter HTTP")) throw new Error(row.error);
    }
  }
}
