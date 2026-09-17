import { expect, mock } from "bun:test";
import { Store } from "../../src/store";

const created: string[] = [];
const switched: { sessionID: string; model: { providerID: string; id: string; variant: string } }[] = [];
const prompts: string[] = [];
const client = {
  sessions: {
    get: async () => ({ id: "session" }),
    create: async (input: { model: { id: string } }) => { created.push(input.model.id); return { id: "session" }; },
    switchModel: async (input: (typeof switched)[number]) => { switched.push(input); },
    prompt: async (input: { text: string }) => { prompts.push(input.text); return { timeCreated: 1 }; },
    wait: async () => {},
    context: async () => [{ type: "assistant", time: { created: 2 }, content: [{ type: "text", text: "answer" }] }],
  },
};
mock.module("@opencode-ai/sdk/workerd", () => ({ OpenCodeWorkerd: { create: async () => client } }));
mock.module("@opencode-ai/plugin", () => ({ Plugin: { define: (value: unknown) => value } }));
const { OpenCodeHarness } = await import("../../src/cloudflare/opencode");
const store = new Store(":memory:");
try {
  const capabilities = { yoloEnabled: () => false } as never;
  const harness = await OpenCodeHarness.create({} as never, store, () => capabilities);
  const message = { eventId: "1", senderId: "sender", conversationId: "chat", text: "Explain slippage", encodedEvent: "verified" };
  expect(await harness.respond(message, capabilities, "response")).toBe("answer");
  expect(await harness.respond({ ...message, eventId: "2" }, capabilities, "mixed")).toBe("answer");
  expect(await harness.respond({ ...message, eventId: "3" }, capabilities)).toBe("answer");
  expect(created).toEqual(["gpt-5.6-luna"]);
  expect(switched.map((entry) => entry.model)).toEqual([
    { providerID: "openai", id: "gpt-5.6-luna", variant: "low" },
    { providerID: "openai", id: "gpt-5.6-luna", variant: "low" },
    { providerID: "openai", id: "gpt-5.6-sol", variant: "medium" },
  ]);
  expect(new Set(switched.map((entry) => entry.sessionID)).size).toBe(1);
  expect(prompts[0]).toContain("explanation-only");
  expect(prompts[1]).not.toContain("explanation-only");
  console.log("Luna selection, retained session, Sol fallback, response instructions passed");
} finally { store.close(); }
