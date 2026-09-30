// Runs one real research run in local workerd: DefiLlama, growthepie and
// twitterapi.io reads, OpenRouter specialists and the editor, through the
// production store, runner and inference runtimes. It spends real credits.
//   OPENROUTER_API_KEY=… TWITTERAPI_IO_KEY=… bun scripts/probe-research.ts base 7d
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const [chain = "base", window = "7d"] = process.argv.slice(2);
const fixtureDevVars = fileURLToPath(new URL("../tests/fixtures/.dev.vars", import.meta.url));
const appDevVars = fileURLToPath(new URL("../.dev.vars", import.meta.url));
const fromDevVars = (name: string) => existsSync(appDevVars) ? new RegExp(`^${name}=(.*)$`, "m").exec(readFileSync(appDevVars, "utf8"))?.[1]?.trim().replace(/^["']|["']$/g, "") : undefined;
const openRouter = process.env.OPENROUTER_API_KEY || fromDevVars("OPENROUTER_API_KEY");
const twitter = process.env.TWITTERAPI_IO_KEY || fromDevVars("TWITTERAPI_IO_KEY");
if (!openRouter) throw new Error("Set OPENROUTER_API_KEY in the environment or apps/pecu/.dev.vars");
if (existsSync(fixtureDevVars)) throw new Error(`${fixtureDevVars} already exists; remove it first`);

const usage = async () => z.object({ data: z.object({ usage: z.number() }) }).parse(await (await fetch("https://openrouter.ai/api/v1/key", { headers: { authorization: `Bearer ${openRouter}` } })).json()).data.usage;
const reservePort = () => { const listener = Bun.listen({ hostname: "127.0.0.1", port: 0, socket: { data() {} } }); const port = listener.port; listener.stop(true); return port; };
const port = reservePort();
writeFileSync(fixtureDevVars, `OPENROUTER_API_KEY=${openRouter}\n${twitter ? `TWITTERAPI_IO_KEY=${twitter}\n` : ""}`, { mode: 0o600 });
const wrangler = fileURLToPath(new URL("./bin/wrangler.js", import.meta.resolve("wrangler/package.json")));
const worker = Bun.spawn({
  cmd: ["node", wrangler, "dev", "--config", "tests/fixtures/wrangler.research-live.jsonc", "--local", "--port", String(port), "--inspector-port", String(reservePort()), "--log-level", "warn", "--show-interactive-dev-session=false", "--persist-to", `/tmp/pecu-research-probe-${process.pid}`],
  cwd: process.cwd(),
  env: { ...process.env, WRANGLER_REGISTRY_PATH: `/tmp/pecu-wrangler-research-${process.pid}/registry`, WRANGLER_SEND_METRICS: "false", WRANGLER_WRITE_LOGS: "false" },
  stdin: "ignore", stdout: "pipe", stderr: "pipe",
});
const logs = new Response(worker.stderr).text();

try {
  for (const deadline = Date.now() + 60_000; ;) {
    try { await fetch(`http://127.0.0.1:${port}/healthz`, { signal: AbortSignal.timeout(5_000) }); break; }
    catch { if (worker.exitCode !== null || Date.now() > deadline) throw new Error(`probe worker did not start\n${await logs}`); await Bun.sleep(500); }
  }
  const before = await usage();
  const startedAt = Date.now();
  const started = await (await fetch(`http://127.0.0.1:${port}/start?chain=${encodeURIComponent(chain)}&window=${window}`)).json();
  const parsed = z.object({ code: z.string() }).safeParse(started);
  if (!parsed.success) throw new Error(`start failed: ${JSON.stringify(started)}`);
  const { code } = parsed.data;
  console.log(JSON.stringify({ started: code, chain, window }));
  let detail: { state: string; markdown?: string | null; stages: { role: string; state: string; calls: number }[]; error?: string | null; deliveries?: string[] } | undefined;
  let last = "";
  for (const deadline = Date.now() + 40 * 60_000; Date.now() < deadline;) {
    await Bun.sleep(10_000);
    detail = await (await fetch(`http://127.0.0.1:${port}/detail?code=${code}`)).json();
    const line = `${detail!.state} ${detail!.stages.map((stage) => `${stage.role}:${stage.state}:${stage.calls}`).join(" ")}`;
    if (line !== last) console.log(JSON.stringify({ at: Math.round((Date.now() - startedAt) / 1000), line }));
    last = line;
    if (["completed", "failed", "cancelled"].includes(detail!.state)) break;
  }
  const spent = (await usage()) - before;
  writeFileSync(`/tmp/research-probe-${chain}-${window}.export.json`, JSON.stringify(await (await fetch(`http://127.0.0.1:${port}/export?code=${code}`)).json()));
  if (detail?.markdown) writeFileSync(`/tmp/research-probe-${chain}-${window}.md`, detail.markdown);
  writeFileSync(`/tmp/research-probe-${chain}-${window}.json`, JSON.stringify(detail, null, 2));
  console.log(JSON.stringify({ state: detail?.state, error: detail?.error, minutes: Math.round((Date.now() - startedAt) / 6000) / 10, openRouterUsd: Math.round(spent * 100) / 100, report: `/tmp/research-probe-${chain}-${window}.md`, deliveries: detail?.deliveries }));
  if (detail?.state !== "completed") throw new Error("research did not complete");
} finally {
  if (worker.exitCode === null) worker.kill("SIGTERM");
  await Promise.race([worker.exited, Bun.sleep(3_000)]);
  if (worker.exitCode === null) worker.kill("SIGKILL");
  rmSync(fixtureDevVars, { force: true });
  const text = await logs;
  if (text.trim()) writeFileSync(`/tmp/research-probe-${chain}-${window}.log`, text);
}
