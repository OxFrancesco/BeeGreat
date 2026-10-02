import { strict as assert } from "node:assert";
import { mkdir, rm } from "node:fs/promises";
import { z } from "zod";
import { jsonObjectSchema, type JsonFields } from "../src/json-contract";
import { stageSchema } from "../src/progress";
import { webStateSchema } from "../src/web-contract";

const directory = process.argv[2];
if (!directory) throw new Error("Usage: bun scripts/probe-codemode.ts OUTPUT_DIRECTORY [--live]");
const live = process.argv.includes("--live");
const actions = process.argv.includes("--actions");
await mkdir(directory, { recursive: true });
const runtime = `${directory}/runtime`;
await mkdir(runtime, { recursive: true });
const vars = `${runtime}/.dev.vars`;
const config = await Bun.file(new URL("../tests/fixtures/wrangler.codemode.jsonc", import.meta.url)).json();
config.main = new URL("../tests/fixtures/codemode-worker.ts", import.meta.url).pathname;
await Bun.write(`${runtime}/wrangler.jsonc`, JSON.stringify(config));
if (live) {
  const key = process.env.OPENROUTER_API_KEY ?? /^OPENROUTER_API_KEY=(.*)$/m.exec(await Bun.file(new URL("../.dev.vars", import.meta.url)).text())?.[1]?.trim().replace(/^["']|["']$/g, "");
  if (!key) throw new Error("OpenRouter key missing");
  await Bun.write(vars, `OPENROUTER_API_KEY=${key}\n`, { mode: 0o600 });
}
function reservePort() {
  const listener = Bun.listen({ hostname: "127.0.0.1", port: 0, socket: { data() {} } });
  const port = listener.port;
  listener.stop(true);
  return port;
}
const port = reservePort();
const worker = Bun.spawn(["bunx", "wrangler", "dev", "--config", `${runtime}/wrangler.jsonc`, "--local", "--port", String(port), "--inspector-port", String(reservePort()), "--show-interactive-dev-session=false"], {
  cwd: new URL("../", import.meta.url).pathname,
  env: { ...process.env, WRANGLER_WRITE_LOGS: "false", WRANGLER_SEND_METRICS: "false", WRANGLER_REGISTRY_PATH: `/tmp/pecu-codemode-${process.pid}` },
  stdout: "pipe", stderr: "pipe",
});
const logs = new Response(worker.stdout).text();
const errors = new Response(worker.stderr).text();
const responseSchema = z.object({
  text: z.string(), elapsedMs: z.number(), calls: z.array(z.object({ name: z.string() }).passthrough()),
  analytics: z.array(jsonObjectSchema), stages: z.array(stageSchema), dataRequests: z.array(z.string()),
  providerRequests: z.array(z.object({
    tools: z.array(z.object({ function: z.object({ name: z.string() }) })),
    messages: z.array(z.object({ role: z.string(), content: z.string().nullable().optional() }).passthrough()),
  })),
  state: webStateSchema.optional(), approvals: z.array(z.string()).optional(),
});
const rows: { name: string; elapsedMs: number; calls: string[] }[] = [];
async function run(name: string, input: JsonFields) {
  const response = await fetch(`http://127.0.0.1:${port}/run`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input), signal: AbortSignal.timeout(180_000) });
  const body = await response.json();
  await Bun.write(`${directory}/${name}.json`, JSON.stringify(body, null, 2));
  assert.equal(response.status, 200, `${name}: ${JSON.stringify(body).slice(0, 500)}`);
  const result = responseSchema.parse(body);
  rows.push({ name, elapsedMs: result.elapsedMs, calls: result.calls.map(call => call.name) });
  console.log(`${name}: ${result.elapsedMs} ms, ${result.calls.length} capability calls`);
  return result;
}
const script = (code: string) => ({ name: "run_tools", input: { code } });
const outputs = (result: z.infer<typeof responseSchema>) => result.providerRequests.at(-1)?.messages.filter(message => message.role === "tool").map(message => message.content ?? "") ?? [];
const last = (result: z.infer<typeof responseSchema>) => jsonObjectSchema.parse(JSON.parse(outputs(result).at(-1) ?? "null"));
try {
  let ready = false;
  for (const deadline = Date.now() + 45_000; Date.now() < deadline;) {
    try { ready = (await fetch(`http://127.0.0.1:${port}/healthz`)).ok; if (ready) break; } catch { /* Wait for Workerd. */ }
    if (worker.exitCode !== null) break;
    await Bun.sleep(250);
  }
  assert(ready, "Workerd did not start");
  if (actions) {
    const recipient = "0x2222222222222222222222222222222222222222";
    const text = `Send 1 USDC, then 2 USDC, then 3 USDC to ${recipient}. Complete all three sends.`;
    const code = `const results=[]; for(const amount of ['1','2','3']) results.push(await tools.evm_transfer({to:'${recipient}',token:'USDC',amount})); return results.join('\\n\\n');`;
    for (const [name, yolo, pending, expected] of [["actions-yolo", true, false, 3], ["actions-confirmation", false, false, 0], ["actions-pending", true, true, 1]] as const) {
      const input: JsonFields = { text, actions: { yolo, pending, turns: [text] } };
      if (!live) input.plan = [script(code)];
      const result = await run(name, input);
      assert.equal(result.approvals?.length, expected, `${name}: requested actions did not respect YOLO and receipt status`);
      assert.equal(result.state?.messages.at(-1)?.canRetry, false, "A message with transaction intents cannot be regenerated");
    }
    const question = `I am considering sending 1 USDC, then 2 USDC, then 3 USDC to ${recipient}. Ask me whether to use this exact plan, with choices Use this plan and Cancel. Wait for my choice.`;
    const input: JsonFields = { text: question, actions: { yolo: true, turns: [question, "Use this plan"] } };
    if (!live) input.plan = [{ name: "ask_user", input: { question: `Send 1, 2 and 3 USDC to ${recipient}?`, options: ["Use this plan", "Cancel"] } }, null, script(code)];
    const accepted = await run("actions-accepted-plan", input);
    assert.equal(accepted.approvals?.length, 3, "Accepting the plan must retain YOLO and finish every action");
    assert.equal(accepted.state?.yolo, true);
  } else if (live) {
    const single = await run("live-single", { text: "What is my wallet address? Reply with the address only." });
    assert(single.text.includes("0x1111111111111111111111111111111111111111"));
    assert.deepEqual(single.calls.map(call => call.name), ["wallet_address"]);
    assert(single.providerRequests.every(request => request.tools.some(tool => tool.function.name === "run_tools")));
    const aggregate = await run("live-aggregate", { text: "Read Base TVL daily values for 30 days. Calculate the mean over all non-null daily values, their count, minimum and maximum. Return JSON only with mean,count,min,max. Use one read and calculate in the script." });
    const encoded = z.string().safeParse(last(aggregate).value);
    const answer = z.object({ mean: z.number(), count: z.number(), min: z.number(), max: z.number() }).parse(encoded.success ? JSON.parse(encoded.data) : last(aggregate).value);
    const day = 86_400_000;
    const yesterday = Math.floor(Date.now() / day) * day - day;
    const values = Array.from({ length: 30 }, (_, index) => yesterday - index * day)
      .filter(date => date <= Date.UTC(2026, 8, 29) && date >= Date.UTC(2026, 7, 1))
      .map(date => date >= Date.UTC(2026, 8, 22) ? 6_300_000_000 : 6_000_000_000);
    assert.equal(answer.count, values.length); assert.equal(answer.min, 6_000_000_000); assert.equal(answer.max, 6_300_000_000);
    assert(Math.abs(answer.mean - values.reduce((sum, value) => sum + value, 0) / values.length) < 1);
    assert.equal(aggregate.dataRequests.length, 1);
    assert(aggregate.stages.some(stage => stage.label === "Reading chain data" && stage.status === "complete"));
    const proposal = await run("live-proposal", { text: "Send 1 USDC to 0x2222222222222222222222222222222222222222. Prepare a preview for my confirmation." });
    assert.equal(proposal.calls.filter(call => call.name === "evmPropose").length, 1);
    assert(proposal.text.includes("ABC234"));
  } else {
    const parallel = await run("parallel", { text: "Read my wallet and balances", plan: [script("return await Promise.all([tools.wallet_address({}), tools.wallet_balances({})]);")] });
    assert.equal(last(parallel).ok, true); assert.equal(parallel.calls.length, 2);
    assert(parallel.stages.some(stage => stage.label === "Reading balances" && stage.status === "running"));
    assert(parallel.stages.some(stage => stage.label === "Reading balances" && stage.status === "complete"));
    assert(parallel.analytics.some(event => event.tool_name === "wallet_balances" && event.$ai_is_error === false));
    assert(parallel.analytics.every(event => !("input" in event) && !("output" in event)));
    const hidden = await run("hidden", { text: "Hello", plan: [script('return await tools.evm_transfer({to:"0x2222222222222222222222222222222222222222",amount:"1"});')] });
    assert.equal(last(hidden).ok, false); assert.equal(hidden.calls.length, 0);
    const invalid = await run("invalid", { text: "Send USDC", plan: [script('return await tools.evm_transfer({to:"not-an-address",amount:"1"});')] });
    assert.equal(last(invalid).ok, false); assert.equal(invalid.calls.length, 0);
    const loaded = await run("loaded", { text: "Hello", plan: [{ name: "load_skills", input: { names: ["wallet"] } }, script('return await tools.evm_token_balance({token:"USDC"});')] });
    assert.equal(last(loaded).ok, true); assert.equal(loaded.calls[0]?.name, "evm_token_balance");
    const partial = await run("partial", { text: "Read my wallet and balances", failBalances: true, plan: [script("return await Promise.allSettled([tools.wallet_address({}),tools.wallet_balances({})]);")] });
    assert.equal(last(partial).ok, true); assert.equal(partial.calls.length, 2);
    assert(partial.stages.some(stage => stage.label === "Reading balances" && stage.status === "error"));
    assert(partial.analytics.some(event => event.tool_name === "wallet_balances" && event.$ai_is_error === true));
    const limited = await run("limited", { text: "Read my wallet", plan: [script("for(let i=0;i<25;i++) await tools.wallet_address({}); return 'done';")] });
    assert.equal(last(limited).ok, false); assert.equal(limited.calls.length, 24);
    const truncated = await run("truncated", { text: "Hello", plan: [script("return 'a'.repeat(30000);")] });
    assert.equal(last(truncated).truncated, true); assert((outputs(truncated).at(-1)?.length ?? 0) < 25_000);
    for (const [name, code] of [["fetch", "return await fetch('https://example.com');"], ["import", "import fs from 'node:fs'; return fs.readFileSync('/etc/passwd');"], ["control", "return await tools.load_skills({names:['wallet']});"]]) {
      const result = await run(name, { text: "Hello", plan: [script(code)] });
      assert.equal(last(result).ok, false); assert.equal(result.calls.length, 0);
    }
    const proposed = await run("proposal-error", { text: "Send 1 USDC", plan: [script('await tools.evm_transfer({to:"0x2222222222222222222222222222222222222222",amount:"1",token:"USDC"}); throw new Error("later failure");')] });
    assert.equal(last(proposed).ok, false); assert.equal(proposed.calls.length, 1);
    assert.equal(proposed.calls[0]?.name, "evmPropose");
    assert(JSON.stringify(last(proposed).completed).includes("ABC234"));
    const research = await run("research", { text: "Inspect Base TVL", research: "capital", plan: [
      script('await tools.chain_metric({chain:"base",metric:"tvl",days:30}); return await tools.wallet_address({});'),
      { name: "research_findings", input: { summary: "Fixture findings", findings: [], gaps: ["Fixture data"] } },
    ] });
    assert.equal(research.calls.length, 0);
    assert.equal(research.dataRequests.length, 1);
    assert(outputs(research).some(text => text.includes('"ok":false')));
    assert(outputs(research).some(text => text.includes("Submitted")));
    const explanation = await run("explanation", { text: "Explain slippage", explanation: true, plan: [script("return await tools.wallet_address({});")] });
    assert.equal(explanation.calls.length, 0);
    const bypass = await run("direct-bypass", { text: "Hello", plan: [{ name: "evm_transfer", input: { to: "0x2222222222222222222222222222222222222222", amount: "1" } }] });
    assert.equal(bypass.calls.length, 0);
    assert.deepEqual(explanation.providerRequests[0]?.tools.map(tool => tool.function.name), ["ask_user"]);
  }
  await Bun.write(`${directory}/summary.json`, JSON.stringify({ live, scope: "Actual Workerd, Durable Object, OpenCode session and Pecu tool handlers. External wallet and chain services are fixtures. Live mode uses OpenRouter; scripted mode supplies provider SSE. No signing capabilities.", rows }, null, 2));
} finally {
  worker.kill("SIGTERM");
  await worker.exited;
  if (live) await rm(vars, { force: true });
  await Bun.write(`${directory}/worker.log`, (await logs) + (await errors));
}
