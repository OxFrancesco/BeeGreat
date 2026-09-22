import { test, expect } from "bun:test";
import { fileURLToPath } from "node:url";
import { readSseEvents, webTurnEventSchema, type WebTurnEvent } from "../src/web-stream";

test("paragraphs stream incrementally through a Durable Object stub and a service-binding entrypoint in workerd", async () => {
  const listener = Bun.listen({ hostname: "127.0.0.1", port: 0, socket: { data() {} } });
  const port = listener.port;
  listener.stop(true);
  const wrangler = fileURLToPath(new URL("./bin/wrangler.js", import.meta.resolve("wrangler/package.json")));
  const child = Bun.spawn({
    cmd: ["node", wrangler, "dev", "--config", "tests/fixtures/wrangler.stream-workerd.jsonc", "--local", "--ip", "127.0.0.1", "--port", String(port), "--show-interactive-dev-session=false"],
    env: { ...process.env, WRANGLER_SEND_METRICS: "false", WRANGLER_WRITE_LOGS: "false", WRANGLER_REGISTRY_PATH: `/tmp/pecu-stream-test-${process.pid}` },
    stdout: "pipe",
    stderr: "pipe",
  });
  const logs = new Response(child.stdout).text(), errors = new Response(child.stderr).text();
  try {
    let response: Response | undefined;
    let lastError: unknown;
    for (const deadline = Date.now() + 25000; Date.now() < deadline;) {
      try {
        response = await fetch(`http://127.0.0.1:${port}/turn`, { headers: { Accept: "text/event-stream" }, signal: AbortSignal.timeout(5000) });
        break;
      } catch (error) {
        lastError = error;
        if (child.exitCode !== null) break;
        await Bun.sleep(100);
      }
    }
    if (!response) throw new Error(`No response on port ${port}: ${String(lastError)}`);
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/event-stream");
    const arrivals: Array<{ event: WebTurnEvent; at: number }> = [];
    for await (const raw of readSseEvents(response.body!)) arrivals.push({ event: webTurnEventSchema.parse(raw), at: Date.now() });
    expect(arrivals.map((entry) => entry.event)).toEqual([
      { type: "paragraph", text: "First paragraph." },
      { type: "paragraph", text: "Second paragraph." },
      { type: "paragraph", text: "Third paragraph." },
      { type: "complete", status: "complete" },
    ]);
    // Buffered delivery would collapse every arrival into the same instant; the probe spaces paragraphs 250ms apart.
    expect(arrivals[2]!.at - arrivals[0]!.at).toBeGreaterThanOrEqual(400);

    // A client that leaves mid-reply must not abort the turn running in the object.
    const cancelled = await fetch(`http://127.0.0.1:${port}/turn?cancel=1`, { headers: { Accept: "text/event-stream" } });
    await cancelled.body!.cancel();
    let finished = false;
    for (const deadline = Date.now() + 5000; Date.now() < deadline && !finished;) {
      await Bun.sleep(100);
      finished = ((await (await fetch(`http://127.0.0.1:${port}/finished`)).json()) as { finished: boolean }).finished;
    }
    expect(finished).toBe(true);
  } catch (error) {
    child.kill();
    await child.exited;
    throw new Error(`${await logs}\n${await errors}`, { cause: error });
  } finally {
    if (child.exitCode === null) child.kill();
    await child.exited;
  }
}, 45000);
