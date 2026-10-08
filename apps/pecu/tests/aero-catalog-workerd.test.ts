import { expect, test } from "bun:test";
import { fileURLToPath } from "node:url";
import { rmSync } from "node:fs";
import { z } from "zod";
import { startSugarRpcMock } from "./fixtures/sugar-rpc-mock";

const ticksSchema = z.array(z.object({ kind: z.string(), status: z.string() }));
const logSchema = z.looseObject({ message: z.string() });

const secretPath = "v3/secret-path-token";
const wrangler = fileURLToPath(new URL("./bin/wrangler.js", import.meta.resolve("wrangler/package.json")));

function reservePort(): number {
  const listener = Bun.listen({ hostname: "127.0.0.1", port: 0, socket: { data() {} } });
  const port = listener.port;
  listener.stop(true);
  return port;
}

async function startWorker(rpcUrl: string, persistTo: string) {
  const port = reservePort();
  const child = Bun.spawn({
    cmd: ["node", wrangler, "dev", "--config", "tests/fixtures/wrangler.aero-catalog-workerd.jsonc", "--local", "--ip", "127.0.0.1", "--port", String(port),
      "--persist-to", persistTo, "--var", `ALCHEMY_RPC_URL:${rpcUrl}/${secretPath}`, "--show-interactive-dev-session=false"],
    env: { ...process.env, WRANGLER_SEND_METRICS: "false", WRANGLER_WRITE_LOGS: "false", WRANGLER_REGISTRY_PATH: `${persistTo}-registry` },
    stdout: "pipe", stderr: "pipe",
  });
  let output = "";
  for (const stream of [child.stdout, child.stderr]) void (async () => { for await (const chunk of stream) output += new TextDecoder().decode(chunk); })();
  const base = `http://127.0.0.1:${port}`;
  for (const deadline = Date.now() + 30_000; ;) {
    try { await fetch(`${base}/ready`, { signal: AbortSignal.timeout(5000) }); break; }
    catch { if (child.exitCode !== null || Date.now() > deadline) throw new Error(`Aero catalog fixture did not start\n${output}`); await Bun.sleep(100); }
  }
  return {
    get: (path: string) => fetch(`${base}${path}`),
    tick: async () => Object.fromEntries(ticksSchema.parse(await (await fetch(`${base}/tick`)).json()).map(tick => [tick.kind, tick.status])),
    logs: (message: string) => Bun.stripANSI(output).split("\n").flatMap(line => {
      const json = line.slice(line.indexOf("{\"timestamp\""), line.lastIndexOf("}") + 1);
      const entry = json.startsWith("{") ? logSchema.parse(JSON.parse(json)) : undefined;
      return entry?.message === message ? [entry] : [];
    }),
    async waitForLogs(message: string, count = 1) {
      for (const deadline = Date.now() + 5000; Date.now() < deadline; await Bun.sleep(50)) if (this.logs(message).length >= count) break;
      return this.logs(message);
    },
    output: () => output,
    stop: async () => { child.kill(); await child.exited; },
  };
}

test("an exhausted RPC quota is reported, backed off durably per catalog, and recovers", async () => {
  const rpc = startSugarRpcMock();
  const persistTo = `/tmp/pecu-aero-catalog-test-${process.pid}`;
  rmSync(persistTo, { recursive: true, force: true });
  let worker = await startWorker(rpc.url, persistTo);
  try {
    expect(await worker.tick()).toEqual({ pools: "idle", "swap-topology": "idle", tokens: "idle" });
    expect(rpc.requests).toBe(0);

    rpc.setMode("quota");
    const startedAt = Date.now();
    const failed = await worker.get("/catalog/pools");
    expect(failed.status).toBe(503);
    expect(Date.now() - startedAt).toBeGreaterThanOrEqual(1000);
    expect(rpc.requests).toBe(4);
    const [failure] = await worker.waitForLogs("aero_catalog_refresh_failed");
    expect(failure).toMatchObject({ kind: "pools", stage: "rpc", error_code: "RPC_RATE_LIMITED", operation: "count", attempts: 4, retryable: true, failures: 1 });
    expect(String(failure?.error_message)).toContain("Status: 429");
    expect(String(failure?.error_message)).toContain("monthly quota");

    expect(await worker.tick()).toEqual({ pools: "deferred", "swap-topology": "failed", tokens: "failed" });
    expect(rpc.requests).toBe(12);
    expect(await worker.tick()).toEqual({ pools: "deferred", "swap-topology": "deferred", tokens: "deferred" });
    expect(rpc.requests).toBe(12);
    expect((await worker.waitForLogs("aero_catalog_refresh_deferred", 4)).length).toBeGreaterThanOrEqual(4);
    expect(worker.output()).not.toContain("secret-path-token");

    await worker.stop();
    worker = await startWorker(rpc.url, persistTo);
    expect(await worker.tick()).toEqual({ pools: "deferred", "swap-topology": "deferred", tokens: "deferred" });
    expect(rpc.requests).toBe(12);

    rpc.setMode("ok");
    const recovered = await worker.get("/catalog/pools");
    expect(recovered.status).toBe(200);
    expect(await recovered.text()).toBe(JSON.stringify({ entries: 3 }));
    expect(await worker.tick()).toEqual({ pools: "fresh", "swap-topology": "deferred", tokens: "deferred" });
    expect(await (await worker.get("/r2")).text()).toBe(JSON.stringify(["v1/pools"]));
    expect(await worker.waitForLogs("aero_catalog_refreshed")).toMatchObject([{ kind: "pools", entries: 3 }]);
    expect(worker.logs("aero_catalog_write_failed")).toEqual([]);
    expect(worker.output()).not.toContain("secret-path-token");
  } catch (error) {
    throw new Error(worker.output(), { cause: error });
  } finally {
    await worker.stop();
    rpc.stop();
    rmSync(persistTo, { recursive: true, force: true });
    rmSync(`${persistTo}-registry`, { recursive: true, force: true });
  }
}, 90_000);
