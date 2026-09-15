import { fileURLToPath } from "node:url";
import { describe, expect, test } from "bun:test";

function reservePort(): number {
  const listener = Bun.listen({
    hostname: "127.0.0.1",
    port: 0,
    socket: { data() {} },
  });
  const port = listener.port;
  listener.stop(true);
  return port;
}

describe("X Chat WASM in Workerd", () => {
  test("initializes the X Chat and Juicebox WASM modules", async () => {
    const port = reservePort();
    const wrangler = fileURLToPath(new URL("./bin/wrangler.js", import.meta.resolve("wrangler/package.json")));
    const worker = Bun.spawn({
      cmd: [
        "node",
        wrangler,
        "dev",
        "--config",
        "tests/fixtures/wrangler.xchat-workerd.jsonc",
        "--local",
        "--port",
        String(port),
        "--log-level",
        "info",
        "--show-interactive-dev-session=false",
      ],
      cwd: process.cwd(),
      env: {
        ...process.env,
        WRANGLER_REGISTRY_PATH: `/tmp/basedbot-wrangler-test-${process.pid}/registry`,
        WRANGLER_SEND_METRICS: "false",
        WRANGLER_WRITE_LOGS: "false",
      },
      stdin: "ignore",
      stdout: "pipe",
      stderr: "pipe",
    });

    const stdout = new Response(worker.stdout).text();
    const stderr = new Response(worker.stderr).text();
    const request = (path: string, init: RequestInit = {}) => fetch(`http://127.0.0.1:${port}${path}`, { ...init, headers: { Accept: "application/json", ...init.headers }, signal: AbortSignal.timeout(10_000) });

    try {
      let response: Response | undefined;
      for (const deadline = Date.now() + 25_000; Date.now() < deadline;) {
        try {
          response = await request("/");
          break;
        } catch {
          if (worker.exitCode !== null) break;
          await Bun.sleep(100);
        }
      }

      if (!response) {
        throw new Error("Workerd test worker did not start within 25 seconds");
      }

      expect(response.status).toBe(200);
      expect(await response.text()).toBe('{"ok":true}');
      const queued = await request("/queue", { method: "POST" });
      expect(await queued.text()).toBe('{"queued":true}');
      const before = await request("/queue");
      expect(await before.text()).toBe('{"completed":false}');
      const claims = await request("/store");
      expect(await claims.text()).toBe(JSON.stringify({ first: "claimed", duplicate: "busy", reclaimed: "claimed", completed: "completed", details: '{"amount":"0.000001"}', isolated: true, yoloPersisted: true, yoloIsolated: true, outgoingMatched: true }));
      const model = await request("/model");
      expect(model.status).toBe(200);
      const modelBody = await model.text();
      expect(modelBody).toBe('{"requests":2}');
      let completed = false;
      for (let attempt = 0; attempt < 45; attempt++) {
        const status = await request("/queue");
        completed = ((await status.json()) as { completed: boolean }).completed;
        if (completed) break;
        await Bun.sleep(1000);
      }
      expect(completed).toBe(true);
    } catch (error) {
      worker.kill();
      await worker.exited;
      throw new Error(`Workerd test failed\n${await stdout}\n${await stderr}`, { cause: error });
    } finally {
      if (worker.exitCode === null) worker.kill("SIGTERM");
      await Promise.race([worker.exited, Bun.sleep(2_000)]);
      if (worker.exitCode === null) worker.kill("SIGKILL");
    }
  }, 120_000);
});
