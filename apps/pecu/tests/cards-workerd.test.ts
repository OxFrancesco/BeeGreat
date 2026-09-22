import { test, expect } from "bun:test";
import { fileURLToPath } from "node:url";
test("concurrent card claims obey uniqueness and the global cap in Durable Object SQLite", async () => {
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
      "tests/fixtures/wrangler.cards-workerd.jsonc",
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
      WRANGLER_REGISTRY_PATH: `/tmp/pecu-cards-test-${process.pid}`,
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
    const group = crypto.randomUUID();
    const claim = async (id: number) => {
      const response = await fetch(`http://127.0.0.1:${port}/?group=${group}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: `user_${id}`, xId: String(id) }),
      });
      expect(response.ok).toBe(true);
      return await response.json() as { created: boolean; status: string; remaining: number; cards: { id: number }[] };
    };
    const repeated = await Promise.all(Array.from({ length: 30 }, () => claim(1)));
    expect(repeated.filter(r => r.created)).toHaveLength(1);
    expect(new Set(repeated.map(r => r.cards[0]!.id)).size).toBe(1);
    let awarded = 1;
    for (let start = 2; start <= 3051; start += 50) {
      const results = await Promise.all(Array.from({ length: 50 }, (_, i) => claim(start + i)));
      awarded += results.filter(r => r.created).length;
    }
    expect(awarded).toBe(3000);
    expect((await claim(4000)).status).toBe("sold_out");
    expect((await claim(1)).status).toBe("owned");
  } catch (error) {
    child.kill();
    await child.exited;
    throw new Error(`${await logs}\n${await errors}`, { cause: error });
  } finally {
    if (child.exitCode === null) child.kill();
    await child.exited;
  }
}, 60000);
