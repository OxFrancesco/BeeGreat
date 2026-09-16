import { test, expect } from "bun:test";
import { fileURLToPath } from "node:url";
test("history migration and triggers work in actual Durable Object SQLite", async () => {
  const listener = Bun.listen({
    hostname: "127.0.0.1",
    port: 0,
    socket: { data() {} },
  });
  const port = listener.port;
  listener.stop(true);
  const wrangler = fileURLToPath(
    new URL("./bin/wrangler.js", import.meta.resolve("wrangler/package.json")),
  );
  const child = Bun.spawn({
    cmd: [
      "node",
      wrangler,
      "dev",
      "--config",
      "tests/fixtures/wrangler.history-workerd.jsonc",
      "--local",
      "--ip",
      "127.0.0.1",
      "--port",
      String(port),
      "--show-interactive-dev-session=false",
    ],
    env: {
      ...process.env,
      WRANGLER_SEND_METRICS: "false",
      WRANGLER_WRITE_LOGS: "false",
      WRANGLER_REGISTRY_PATH: `/tmp/pecu-history-test-${process.pid}`,
    },
    stdout: "pipe",
    stderr: "pipe",
  });
  const logs = new Response(child.stdout).text(),
    errors = new Response(child.stderr).text();
  try {
    let response: Response | undefined;
    let lastError: unknown;
    for (const deadline = Date.now() + 25000; Date.now() < deadline;) {
      try {
        response = await fetch(`http://127.0.0.1:${port}/`, {
          signal: AbortSignal.timeout(3000),
        });
        break;
      } catch (error) {
        lastError = error;
        if (child.exitCode !== null) break;
        await Bun.sleep(100);
      }
    }
    if (!response)
      throw new Error(`No response on port ${port}: ${String(lastError)}`);
    expect(response.status).toBe(200);
    expect(await response.text()).toBe(
      JSON.stringify({
        initial: 105,
        latest: 40,
        older: 40,
        roundtrip: true,
        count: 106,
        deleted: true,
      }),
    );
  } catch (error) {
    child.kill();
    await child.exited;
    throw new Error(`${await logs}\n${await errors}`, { cause: error });
  } finally {
    if (child.exitCode === null) child.kill();
    await child.exited;
  }
}, 35000);
