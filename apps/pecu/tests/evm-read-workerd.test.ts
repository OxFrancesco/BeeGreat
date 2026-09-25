import { test, expect } from "bun:test";
import { fileURLToPath } from "node:url";

test("direct EVM HTTP reads work in Cloudflare's runtime", async () => {
  const listener = Bun.listen({ hostname: "127.0.0.1", port: 0, socket: { data() {} } });
  const port = listener.port;
  listener.stop(true);
  const wrangler = fileURLToPath(new URL("./bin/wrangler.js", import.meta.resolve("wrangler/package.json")));
  const child = Bun.spawn({
    cmd: ["node", wrangler, "dev", "--config", "tests/fixtures/wrangler.evm-read-workerd.jsonc", "--local", "--ip", "127.0.0.1", "--port", String(port), "--show-interactive-dev-session=false"],
    env: { ...process.env, WRANGLER_SEND_METRICS: "false", WRANGLER_WRITE_LOGS: "false", WRANGLER_REGISTRY_PATH: `/tmp/pecu-evm-read-test-${process.pid}` },
    stdout: "pipe", stderr: "pipe",
  });
  const logs = new Response(child.stdout).text(), errors = new Response(child.stderr).text();
  try {
    let response: Response | undefined;
    for (const deadline = Date.now() + 25000; Date.now() < deadline;) {
      try { response = await fetch(`http://127.0.0.1:${port}/`, { signal: AbortSignal.timeout(5000) }); break; }
      catch { if (child.exitCode !== null) break; await Bun.sleep(100); }
    }
    if (!response) throw new Error("Cloudflare read fixture did not start");
    const result = await response.json() as { result: unknown; requests: string[] };
    expect(result).toEqual({ result: { ok: true, result: { chainId: 8453, address: "0x1111111111111111111111111111111111111111", balanceWei: "16", block: "100" } }, requests: ["eth_chainId", "eth_blockNumber", "eth_getBalance"] });
  } catch (error) {
    child.kill(); await child.exited;
    throw new Error(`${await logs}\n${await errors}`, { cause: error });
  } finally {
    if (child.exitCode === null) child.kill();
    await child.exited;
  }
}, 40000);
