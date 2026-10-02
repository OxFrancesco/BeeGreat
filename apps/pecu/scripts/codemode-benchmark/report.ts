import { mkdir } from "node:fs/promises";
import { z } from "zod";
import { jsonValueSchema } from "../../src/json-contract";
import { equivalent } from "./data";

const [directory, destination = directory] = process.argv.slice(2);
if (!directory) throw new Error("Usage: bun scripts/codemode-benchmark/report.ts RESULTS_DIRECTORY [REPORT_DIRECTORY]");
const stepSchema = z.object({
  elapsedMs: z.number(), promptTokens: z.number(), completionTokens: z.number(), cachedTokens: z.number(),
  calls: z.array(z.object({ name: z.string(), arguments: z.string(), output: z.string() })),
});
const resultSchema = z.object({
  model: z.string(), effort: z.string(), samples: z.number(), runtime: z.string(), snapshotSha256: z.string(), scope: z.string(),
  providerReportedCostUsd: z.number(), budgetAccountedUsd: z.number(),
  rows: z.array(z.object({ case: z.string(), sample: z.number(), mode: z.enum(["direct", "codemode"]), elapsedMs: z.number(), correct: z.boolean(), answer: z.string(), error: z.string().optional(), traces: z.array(stepSchema), toolCalls: z.array(z.object({ name: z.string(), input: z.object({ chain: z.string() }), error: z.string().optional() })) })),
});
const results = resultSchema.parse(await Bun.file(`${directory}/results.json`).json());
const expected = z.array(z.object({ id: z.string(), expected: jsonValueSchema, minimumCalls: z.number() })).parse(await Bun.file(`${directory}/expected.json`).json());
const taskCorrect = (row: (typeof results.rows)[number]) => {
  if (row.error) return false;
  const target = expected.find(item => item.id === row.case);
  if (!target) throw new Error(`Missing expected answer for ${row.case}`);
  if (new Set(row.toolCalls.map(call => JSON.stringify([call.name, call.input.chain.toLowerCase()]))).size < target.minimumCalls) return false;
  if (row.case === "partial-failure" && row.toolCalls.filter(call => call.error).length !== 1) return false;
  try { return equivalent(jsonValueSchema.parse(JSON.parse(row.answer)), target.expected, true); }
  catch { return false; }
};
type Row = (typeof results.rows)[number];
const sum = (numbers: number[]) => numbers.reduce((total, number) => total + number, 0);
const median = (numbers: number[]) => {
  if (!numbers.length) return null;
  const ordered = numbers.toSorted((a, b) => a - b);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 ? ordered[middle] : (ordered[middle - 1] + ordered[middle]) / 2;
};
const stats = (rows: Row[]) => ({
  runs: rows.length, correct: rows.filter(taskCorrect).length, strictCorrect: rows.filter(row => row.correct).length,
  medianSeconds: median(rows.map(row => row.elapsedMs / 1000)),
  medianCorrectSeconds: median(rows.filter(taskCorrect).map(row => row.elapsedMs / 1000)),
  medianSteps: median(rows.map(row => row.traces.length)),
  inputTokens: sum(rows.map(row => sum(row.traces.map(step => step.promptTokens)))),
  outputTokens: sum(rows.map(row => sum(row.traces.map(step => step.completionTokens)))),
  cachedTokens: sum(rows.map(row => sum(row.traces.map(step => step.cachedTokens)))),
  toolCalls: sum(rows.map(row => row.toolCalls.length)),
  toolErrors: sum(rows.map(row => row.toolCalls.filter(call => call.error).length)),
  scriptErrors: sum(rows.map(row => sum(row.traces.map(step => step.calls.filter(call => call.name === "execute" && z.object({ ok: z.boolean() }).safeParse(JSON.parse(call.output)).data?.ok === false).length)))),
});
const totals = { direct: stats(results.rows.filter(row => row.mode === "direct")), codemode: stats(results.rows.filter(row => row.mode === "codemode")) };
const cases = [...new Set(results.rows.map(row => row.case))].map(id => {
  const rows = results.rows.filter(row => row.case === id);
  const direct = stats(rows.filter(row => row.mode === "direct"));
  const codemode = stats(rows.filter(row => row.mode === "codemode"));
  const pairs = rows.filter(row => row.mode === "direct").flatMap(before => {
    const after = rows.find(row => row.mode === "codemode" && row.sample === before.sample);
    return after ? [{ sample: before.sample, directSeconds: before.elapsedMs / 1000, codemodeSeconds: after.elapsedMs / 1000, bothCorrect: taskCorrect(before) && taskCorrect(after), changePct: (after.elapsedMs / before.elapsedMs - 1) * 100 }] : [];
  });
  return { id, direct, codemode, pairs, medianPairedChangePct: median(pairs.map(pair => pair.changePct)) };
});
const complete = cases.every(item => item.direct.runs === results.samples && item.codemode.runs === results.samples);
const summary = { model: results.model, effort: results.effort, complete, scope: results.scope, totals, cases, providerReportedCostUsd: results.providerReportedCostUsd, budgetAccountedUsd: results.budgetAccountedUsd };
await mkdir(destination, { recursive: true });
await Bun.write(`${destination}/summary.json`, JSON.stringify(summary, null, 2));
if (directory !== destination) for (const name of ["results.json", "snapshot.json", "expected.json"]) await Bun.write(`${destination}/${name}`, Bun.file(`${directory}/${name}`));
const html = (value: string | number) => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
const seconds = (value: number | null) => value === null ? "n/a" : `${value.toFixed(2)} s`;
const count = (value: number) => value.toLocaleString("en-US");
const labels = new Map(Object.entries({ "single-read": "One read", "parallel-reads": "Three parallel reads", "dependent-research": "Dependent research", "large-aggregation": "90-day calculation", "partial-failure": "One provider fails" }));
const inputChange = (totals.codemode.inputTokens / totals.direct.inputTokens - 1) * 100;
const quality = `Correct answers: direct ${totals.direct.correct}/${totals.direct.runs}; Code Mode ${totals.codemode.correct}/${totals.codemode.runs}.`;
const calculation = cases.find(item => item.id === "large-aggregation");
const calculationSpeedup = calculation?.direct.medianSeconds && calculation.codemode.medianSeconds ? calculation.direct.medianSeconds / calculation.codemode.medianSeconds : null;
const headline = !complete ? "Incomplete comparison" : calculationSpeedup && calculationSpeedup > 2 && calculation?.codemode.correct === calculation?.codemode.runs ? `Calculations were ${calculationSpeedup.toFixed(1)}× faster with Code Mode` : "Pecu Code Mode comparison";
const tables = cases.map(item => `<tr><th scope="row">${html(labels.get(item.id) ?? item.id)}</th><td>${seconds(item.direct.medianSeconds)}</td><td>${seconds(item.codemode.medianSeconds)}</td><td>${item.direct.correct}/${item.direct.runs} → ${item.codemode.correct}/${item.codemode.runs}</td><td>${item.direct.medianSteps} → ${item.codemode.medianSteps}</td></tr>`).join("");
const details = results.rows.map(row => `<details><summary>${html(labels.get(row.case) ?? row.case)} · ${html(row.mode)} · repetition ${row.sample + 1} · ${taskCorrect(row) ? "correct" : "failed"} · ${seconds(row.elapsedMs / 1000)}</summary><pre>${html(row.error ?? row.answer)}</pre>${row.traces.map((step, index) => `<p>Model turn ${index + 1}: ${seconds(step.elapsedMs / 1000)}, ${count(step.promptTokens)} input tokens, ${count(step.completionTokens)} output tokens.</p>${step.calls.map(call => `<pre>${html(call.name)}\n${html(call.arguments)}</pre>`).join("")}`).join("")}</details>`).join("");
await Bun.write(`${destination}/index.html`, `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Pecu Code Mode comparison</title><style>
:root{color-scheme:light dark;--bg:#f9f9f9;--ink:#202020;--muted:#646464;--line:#d8d8d8;--link:#644a40}*{box-sizing:border-box;scrollbar-width:none}*::-webkit-scrollbar{display:none}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}main{max-width:1120px;margin:56px auto;padding:0 28px 60px}h1{font-size:32px;line-height:1.2;letter-spacing:-.8px;margin:0 0 20px}h2{font-size:20px;margin:34px 0 12px}p{max-width:88ch}a{color:var(--link)}.muted{color:var(--muted)}.table{overflow-x:auto}table{border-collapse:collapse;width:100%;font-size:14px;font-variant-numeric:tabular-nums}th,td{padding:14px 12px;text-align:right;border-bottom:1px solid var(--line);white-space:nowrap}th:first-child{text-align:left;padding-left:0}thead th{color:var(--muted);font-weight:500}details{border-bottom:1px solid var(--line);padding:14px 0}summary{cursor:pointer;min-height:32px}pre{white-space:pre-wrap;overflow-wrap:anywhere;font:13px/1.6 ui-monospace,monospace;max-height:360px;overflow:auto;padding:16px;background:#efefef}code{overflow-wrap:anywhere}.links{display:flex;gap:24px;flex-wrap:wrap}@media(prefers-color-scheme:dark){:root{--bg:#111;--ink:#eee;--muted:#b4b4b4;--line:#35312c;--link:#ffe0c2}pre{background:#191919}}@media(max-width:600px){main{margin-top:28px;padding:0 18px 40px}h1{font-size:27px}}
</style></head><body><main><h1>${headline}</h1><p>${quality} Input token usage ${inputChange >= 0 ? "increased" : "decreased"} ${Math.abs(inputChange).toFixed(1)}% with Code Mode.</p><p class="muted">${html(results.model)}, ${html(results.effort)} reasoning. ${results.samples} repetitions per mode and task, alternating which mode runs first. Median elapsed times include the full model-and-tool loop.</p><div class="table"><table><thead><tr><th>Task</th><th>Direct</th><th>Code Mode</th><th>Correct</th><th>Model turns</th></tr></thead><tbody>${tables}</tbody></table></div>
<h2>Tokens and execution</h2><div class="table"><table><thead><tr><th>Mode</th><th>Input tokens</th><th>Output tokens</th><th>Cached input</th><th>Tool calls</th><th>Script errors</th></tr></thead><tbody>${Object.entries(totals).map(([mode, value]) => `<tr><th>${html(mode)}</th><td>${count(value.inputTokens)}</td><td>${count(value.outputTokens)}</td><td>${count(value.cachedTokens)}</td><td>${value.toolCalls}</td><td>${value.scriptErrors}</td></tr>`).join("")}</tbody></table></div>
<h2>What this proves</h2><p>The model called Pecu's real chain-data tool schemas and OpenCode's installed interpreter. Both modes received the same captured public DefiLlama outputs. Direct tool calls could run concurrently. Expected answers were calculated separately; grading checked required reads, names, nulls, ordering, counts and numbers within 0.1%. The failure case deliberately made Arbitrum unavailable.</p><p>Task accuracy accepts capitalization differences in names. The original strict score is preserved in the traces and summary: direct ${totals.direct.strictCorrect}/${totals.direct.runs}, Code Mode ${totals.codemode.strictCorrect}/${totals.codemode.runs}. This post-run review does not change the prompts, measurements or saved answers.</p><p>This is an isolated model loop with two read tools, structured JSON answers and replayed data. It does not exercise production OpenCode sessions, Pecu's full prompt and catalog, Cloudflare, wallet confirmations, the ChatGPT subscription route or user-interface latency. There are no artificial tool delays. ${results.samples} repetitions are exploratory, not evidence of a general latency guarantee. Provider cache is uncontrolled.</p><p>Provider-reported cost: $${results.providerReportedCostUsd.toFixed(4)}. ${results.providerReportedCostUsd === 0 ? "The API returned zero cost; that is not proof the experiment was free." : ""} The spending guard accounted for $${results.budgetAccountedUsd.toFixed(4)}, using the greater of reported cost and a conservative token estimate.</p>
<p>Runtime: ${html(results.runtime)}. Snapshot SHA-256: <code>${html(results.snapshotSha256)}</code>.</p><div class="links"><a href="summary.json">Summary JSON</a><a href="results.json">Full traces</a><a href="snapshot.json">Captured data</a><a href="expected.json">Tasks and expected answers</a></div><h2>Individual runs</h2>${details}</main></body></html>`);
console.log(JSON.stringify(summary, null, 2));
