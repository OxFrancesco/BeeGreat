import { afterEach, expect, test } from "bun:test";
import { ApiError } from "@xdevplatform/xdk";
import type { ChatWithJuicebox } from "@xdevplatform/chat-xdk";
import type { BasedBotAgent } from "../src/agent";
import { Store } from "../src/store";
import type { XApi } from "../src/x/api";
import { XChatTransport, type ConversationDiscovery } from "../src/x/transport";

const stores: Store[] = [];
afterEach(() => { for (const store of stores.splice(0)) store.close(); });
const limited = () => new ApiError("HTTP 429", 429, "Too Many Requests", new Headers({ "x-rate-limit-reset": String(Math.ceil(Date.now() / 1000) + 900) }));

function fixture(list: () => Promise<Array<{ id: string; participantIds: string[] }>>, peers: string[], initial?: ConversationDiscovery) {
  const store = new Store(":memory:"); stores.push(store);
  const eventReads: string[] = [];
  let persisted = initial;
  const api = {
    conversations: list,
    conversationId: async () => "1-2",
    events: async (id: string) => { eventReads.push(id); return { data: [], meta: {} }; },
    publicKeys: async () => [],
  } as unknown as XApi;
  const chat = { setSigningKeys() {}, decryptEvents: () => ({ messages: [], errors: {}, conversationKeys: { keys: {}, latestVersion: null } }) } as unknown as ChatWithJuicebox;
  const create = () => new XChatTransport(api, chat, "1", { chatPeerUserIds: peers, pollIntervalMs: 60_000 }, store, {} as BasedBotAgent, {
    get: async () => persisted,
    put: async (value) => { persisted = value; },
  });
  return { create, eventReads, persisted: () => persisted };
}

test("discovery rate limits do not block a configured peer's messages", async () => {
  const f = fixture(async () => { throw limited(); }, ["2"]);
  await f.create().poll();
  expect(f.eventReads).toEqual(["1-2"]);
  expect(f.persisted()?.refreshAt).toBeGreaterThan(Date.now() + 14 * 60_000);
});

test("discovery cache survives transport recreation", async () => {
  let scans = 0;
  const f = fixture(async () => { scans++; return [{ id: "1-2", participantIds: ["1", "2"] }]; }, []);
  await f.create().poll();
  await f.create().poll();
  expect(scans).toBe(1);
  expect(f.eventReads).toEqual(["1-2", "1-2"]);
});

test("expired discovery data remains usable during a rate limit", async () => {
  const f = fixture(async () => { throw limited(); }, [], { ids: ["1-2"], refreshAt: 0 });
  await f.create().poll();
  expect(f.eventReads).toEqual(["1-2"]);
});

test("an empty discovery failure still reaches the scheduler without known peers", async () => {
  const error = limited();
  const f = fixture(async () => { throw error; }, []);
  await expect(f.create().poll()).rejects.toBe(error);
  expect(f.eventReads).toHaveLength(0);
});
