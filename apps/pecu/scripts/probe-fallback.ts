import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { heapProbe } from "./heap-probe";

const fixtureDevVars = fileURLToPath(new URL("../tests/fixtures/.dev.vars", import.meta.url));
const appDevVars = fileURLToPath(new URL("../.dev.vars", import.meta.url));
const sampleCount = Number(process.env.PECU_PROBE_SAMPLES ?? 1);
if (!Number.isInteger(sampleCount) || sampleCount < 1 || sampleCount > 20) throw new Error("PECU_PROBE_SAMPLES must be between 1 and 20");
const modes = process.env.PECU_PROBE_MODE ? [process.env.PECU_PROBE_MODE] : ["response", "default"];
if (modes.some(mode => !["response", "default", "wallet", "defi", "markets", "analytics", "funding"].includes(mode))) throw new Error("Unknown PECU_PROBE_MODE");

function readKey(text: string): string | undefined {
  const value = /^OPENROUTER_API_KEY=(.*)$/m.exec(text)?.[1]?.trim().replace(/^["']|["']$/g, "");
  return value || undefined;
}

const key = process.env.OPENROUTER_API_KEY || (existsSync(appDevVars) ? readKey(readFileSync(appDevVars, "utf8")) : undefined);
if (!key) throw new Error("Set OPENROUTER_API_KEY in the environment or in apps/pecu/.dev.vars");
if (existsSync(fixtureDevVars)) throw new Error(`${fixtureDevVars} already exists; remove it first`);

function reservePort(): number {
  const listener = Bun.listen({ hostname: "127.0.0.1", port: 0, socket: { data() {} } });
  const port = listener.port;
  listener.stop(true);
  return port;
}

const port = reservePort();
const inspectorPort = reservePort();
writeFileSync(fixtureDevVars, `OPENROUTER_API_KEY=${key}\n`, { mode: 0o600 });
const wrangler = fileURLToPath(new URL("./bin/wrangler.js", import.meta.resolve("wrangler/package.json")));
const worker = Bun.spawn({
  cmd: ["node", wrangler, "dev", "--config", "tests/fixtures/wrangler.fallback-live.jsonc", "--local", "--port", String(port), "--inspector-port", String(inspectorPort), "--log-level", "info", "--show-interactive-dev-session=false"],
  cwd: process.cwd(),
  env: { ...process.env, WRANGLER_REGISTRY_PATH: `/tmp/pecu-wrangler-test-${process.pid}/registry`, WRANGLER_SEND_METRICS: "false", WRANGLER_WRITE_LOGS: "false" },
  stdin: "ignore",
  stdout: "pipe",
  stderr: "pipe",
});
const stdout = new Response(worker.stdout).text();
const stderr = new Response(worker.stderr).text();
let heap: Awaited<ReturnType<typeof heapProbe>> | undefined;

try {
  let ready = false;
  for (const deadline = Date.now() + 30_000; Date.now() < deadline;) {
    try {
      await fetch(`http://127.0.0.1:${port}/healthz`, { signal: AbortSignal.timeout(5_000) });
      ready = true;
      break;
    } catch {
      if (worker.exitCode !== null) break;
      await Bun.sleep(250);
    }
  }
  if (!ready) throw new Error(`probe worker did not start\n${await stdout}\n${await stderr}`);
  heap = await heapProbe(inspectorPort);
  for (const mode of modes) {
    const session = crypto.randomUUID();
    for (let sample = 0; sample < sampleCount; sample++) {
      const heapBefore = await heap.read();
      let heapPeak = heapBefore;
      let sampling = false;
      const timer = setInterval(() => {
        if (sampling) return;
        sampling = true;
        void heap!.read().then((value) => { heapPeak = Math.max(heapPeak, value); }).finally(() => { sampling = false; });
      }, 100);
      const response = await fetch(`http://127.0.0.1:${port}/?mode=${mode}&session=${session}`, { signal: AbortSignal.timeout(120_000) });
      const result = await response.json();
      clearInterval(timer);
      const heapAfter = await heap.read();
      console.log(JSON.stringify({ mode, sample, state: sample === 0 ? "cold" : "warm", status: response.status, heapBefore, heapAfter, heapPeak: Math.max(heapPeak, heapAfter), result }));
      if (!response.ok || typeof result !== "object" || result === null || !("text" in result) || result.text !== "OK") throw new Error("Probe did not return the expected successful answer");
    }
  }
} finally {
  heap?.close();
  if (worker.exitCode === null) worker.kill("SIGTERM");
  await Promise.race([worker.exited, Bun.sleep(2_000)]);
  if (worker.exitCode === null) worker.kill("SIGKILL");
  rmSync(fixtureDevVars, { force: true });
}
