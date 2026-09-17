import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const fixtureDevVars = fileURLToPath(new URL("../tests/fixtures/.dev.vars", import.meta.url));
const appDevVars = fileURLToPath(new URL("../.dev.vars", import.meta.url));

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

writeFileSync(fixtureDevVars, `OPENROUTER_API_KEY=${key}\n`, { mode: 0o600 });
const port = reservePort();
const wrangler = fileURLToPath(new URL("./bin/wrangler.js", import.meta.resolve("wrangler/package.json")));
const worker = Bun.spawn({
  cmd: ["node", wrangler, "dev", "--config", "tests/fixtures/wrangler.fallback-live.jsonc", "--local", "--port", String(port), "--log-level", "info", "--show-interactive-dev-session=false"],
  cwd: process.cwd(),
  env: { ...process.env, WRANGLER_REGISTRY_PATH: `/tmp/pecu-wrangler-test-${process.pid}/registry`, WRANGLER_SEND_METRICS: "false", WRANGLER_WRITE_LOGS: "false" },
  stdin: "ignore",
  stdout: "pipe",
  stderr: "pipe",
});
const stdout = new Response(worker.stdout).text();
const stderr = new Response(worker.stderr).text();

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
  for (const mode of ["response", "default"]) {
    const response = await fetch(`http://127.0.0.1:${port}/?mode=${mode}`, { signal: AbortSignal.timeout(120_000) });
    console.log(`mode=${mode} status=${response.status} ${await response.text()}`);
  }
} finally {
  if (worker.exitCode === null) worker.kill("SIGTERM");
  await Promise.race([worker.exited, Bun.sleep(2_000)]);
  if (worker.exitCode === null) worker.kill("SIGKILL");
  rmSync(fixtureDevVars, { force: true });
}
