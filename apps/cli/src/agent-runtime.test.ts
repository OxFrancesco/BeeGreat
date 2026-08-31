import { describe, expect, test } from "bun:test";

import { ensureBeeAgent } from "./agent-runtime";

const projectRoot = new URL("../../..", import.meta.url).pathname.replace(
  /\/$/,
  "",
);

describe("Bee local agent runtime", () => {
  test("leaves remote agents to their configured host", async () => {
    let spawned = false;
    await expect(
      ensureBeeAgent(
        {
          agentUrl: "https://agent.example.test",
          autoStart: true,
        },
        {
          spawn: () => {
            spawned = true;
            return { unref() {} };
          },
        },
      ),
    ).resolves.toBe("remote");
    expect(spawned).toBeFalse();
  });

  test("reuses a healthy local Bee agent", async () => {
    let spawned = false;
    await expect(
      ensureBeeAgent(
        {
          agentUrl: "http://localhost:3583",
          autoStart: true,
        },
        {
          fetch: async () =>
            Response.json({ ok: true, service: "beegreat-agent" }),
          spawn: () => {
            spawned = true;
            return { unref() {} };
          },
        },
      ),
    ).resolves.toBe("ready");
    expect(spawned).toBeFalse();
  });

  test("starts a missing local agent and waits for Bee health", async () => {
    let checks = 0;
    let detached = false;
    let separateProcessGroup = false;
    const statuses: string[] = [];
    await expect(
      ensureBeeAgent(
        {
          agentUrl: "http://localhost:3583",
          autoStart: true,
          projectRoot,
          onStatus: (message) => statuses.push(message),
        },
        {
          fetch: async () => {
            checks += 1;
            if (checks < 3) throw new Error("connection refused");
            return Response.json({ ok: true, service: "beegreat-agent" });
          },
          spawn: (_command, options) => {
            separateProcessGroup = options.detached;
            return {
              unref() {
                detached = true;
              },
            };
          },
          sleep: async () => undefined,
        },
      ),
    ).resolves.toBe("started");
    expect(detached).toBeTrue();
    expect(separateProcessGroup).toBeTrue();
    expect(statuses).toEqual(["Waking up the local Bee agent…"]);
  });

  test("keeps self-started agent output in the configured diagnostics log", async () => {
    let checks = 0;
    let stdout: "ignore" | number = "ignore";
    let stderr: "ignore" | number = "ignore";
    let openedPath = "";
    let closed = false;
    await expect(
      ensureBeeAgent(
        {
          agentUrl: "http://localhost:3583",
          autoStart: true,
          projectRoot,
          logPath: "/tmp/beegreat-agent-test.log",
        },
        {
          fetch: async () => {
            checks += 1;
            if (checks < 2) throw new Error("connection refused");
            return Response.json({ ok: true, service: "beegreat-agent" });
          },
          openLog: async (path) => {
            openedPath = path;
            return {
              fd: 42,
              close: async () => {
                closed = true;
              },
            };
          },
          spawn: (_command, options) => {
            stdout = options.stdout;
            stderr = options.stderr;
            return { unref() {} };
          },
          sleep: async () => undefined,
        },
      ),
    ).resolves.toBe("started");
    expect(openedPath).toBe("/tmp/beegreat-agent-test.log");
    expect<"ignore" | number>(stdout).toBe(42);
    expect<"ignore" | number>(stderr).toBe(42);
    expect(closed).toBeTrue();
  });

  test("does not start over another service", async () => {
    await expect(
      ensureBeeAgent(
        {
          agentUrl: "http://localhost:3583",
          autoStart: true,
        },
        {
          fetch: async () => Response.json({ ok: true }),
        },
      ),
    ).rejects.toThrow("something other than BeeGreat");
  });
});
