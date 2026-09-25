import { expect, mock } from "bun:test";
import { Database } from "bun:sqlite";
import type { TimingSql } from "../../src/inference-timings";
import { usageStep } from "./inference-usage";
import type { AgentAnalyticsEvent } from "../../src/analytics";

let calls = 0;
let readAfter: number | undefined;
let failLog = false;
let failWait = false;
let logGate: Promise<void> | undefined;
const values = new Map<string, unknown>();
const db = new Database(":memory:");
const sql: TimingSql = { exec: <R extends Record<string, SqlStorageValue>>(query: string, ...params: SqlStorageValue[]) => {
  const rows = db.query<R, (string | number | null | Uint8Array)[]>(query).all(...params.map((value) => value instanceof ArrayBuffer ? new Uint8Array(value) : value));
  return { toArray: () => rows };
} };
const storage = { get: async (key: string) => values.get(key), put: async (key: string, value: unknown) => { values.set(key, value); }, delete: async (key: string) => values.delete(key), sql };
const client = {
  sessions: {
    get: async () => ({}),
    switchModel: async () => {},
    prompt: async () => { calls++; return { timeCreated: calls * 1000 }; },
    wait: async () => { if (failWait) throw new Error("original provider failure"); },
    log: async function* ({ after }: { after?: number }) {
      await logGate;
      if (failLog) throw new Error("private log error");
      readAfter = after;
      for (const entry of usageStep(`step-${calls}`, "openai", calls * 1000)) {
        if (entry.type !== "log.synced") yield { ...entry, durable: { ...entry.durable, seq: calls * 10 } };
      }
    },
  },
  message: { list: async () => ({ data: [{ type: "assistant", time: { created: calls * 1000 }, content: [{ type: "text", text: "safe answer" }] }] }) },
};
mock.module("@opencode-ai/sdk/workerd", () => ({ OpenCodeWorkerd: { create: async () => client } }));
mock.module("@opencode-ai/plugin", () => ({ Plugin: { define: (plugin: unknown) => plugin } }));
const { OpenCodeHarness } = await import("../../src/cloudflare/opencode");
const events: AgentAnalyticsEvent[] = [];
const store = { agentSession: () => "session-test", saveAgentTurn() {} };
const harness = await OpenCodeHarness.create(storage as never, store as never, () => { throw new Error("tools not called"); }, undefined, undefined, (_sender, event) => { events.push(event); });
const message = { eventId: "turn", senderId: "sender", conversationId: "conversation", text: "hello" } as never;
const capabilities = { yoloEnabled: () => false } as never;
expect(await harness.respond(message, capabilities)).toBe("safe answer");
expect(events).toHaveLength(1);
expect(readAfter).toBeUndefined();
expect(await harness.respond(message, capabilities)).toBe("safe answer");
expect(readAfter).toBe(10);
expect(events).toHaveLength(2);
failLog = true;
expect(await harness.respond(message, capabilities)).toBe("safe answer");
expect(events).toHaveLength(2);
failLog = false;
failWait = true;
await expect(harness.respond(message, capabilities)).rejects.toThrow("original provider failure");
expect(events).toHaveLength(3);
failWait = false;
let release!: () => void;
logGate = new Promise<void>((resolve) => { release = resolve; });
const scheduled: Promise<void>[] = [];
const asynchronous = await OpenCodeHarness.create(storage as never, store as never, () => capabilities, undefined, undefined, (_sender, event) => { events.push(event); }, (work) => { scheduled.push(work); });
expect(await asynchronous.respond(message, capabilities)).toBe("safe answer");
expect(events).toHaveLength(3);
const callsBefore = calls;
const next = asynchronous.respond(message, capabilities);
await Bun.sleep(10);
expect(calls).toBe(callsBefore);
release();
await next;
await Promise.all(scheduled);
expect(events).toHaveLength(5);
console.log("inference telemetry cursor, response isolation, and failed-wait capture passed");
