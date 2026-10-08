import { afterEach, expect, test } from "bun:test";
import { ApiError } from "@xdevplatform/xdk";
import { Store } from "../src/store";
import { type ChatTransportApi, type ChatTransportCrypto, type PeerConversationStore, XChatTransport } from "../src/x/transport";

const stores: Store[] = [];
afterEach(() => { for (const store of stores.splice(0)) store.close(); });

/** Shared Durable Object storage stand-in: every transport built from it acts like a reinitialized one. */
function fixture(options: { listed?: string[]; lookup?: string; missing?: boolean } = {}) {
  const store = new Store(":memory:"); stores.push(store);
  const saved = new Map<string, string>();
  const lookups: string[] = [];
  const eventReads: string[] = [];
  const peers: PeerConversationStore = {
    get: async (bot, peer) => saved.get(`${bot}:${peer}`),
    put: async (bot, peer, id) => { saved.set(`${bot}:${peer}`, id); },
    delete: async (bot, peer) => { saved.delete(`${bot}:${peer}`); },
  };
  const api: ChatTransportApi = {
    conversations: async () => (options.listed ?? []).map(id => ({ id, participantIds: [] })),
    conversationId: async (peer: string) => { lookups.push(peer); return options.lookup ?? `${peer}-1`; },
    events: async (id: string) => {
      eventReads.push(id);
      if (options.missing) throw new ApiError("HTTP 404", 404, "Not Found", new Headers());
      return { data: [], meta: {} };
    },
    publicKeys: async () => [],
    send: async () => { throw new Error("Unexpected send"); },
  };
  const chat: ChatTransportCrypto = { encryptReply: () => { throw new Error("Unexpected encryption"); }, setSigningKeys() {}, decryptEvents: () => ({ messages: [], errors: {}, conversationKeys: { keys: {}, latestVersion: null } }) };
  const create = (botUserId = "1") => new XChatTransport(api, chat, botUserId, { chatPeerUserIds: ["2"], pollIntervalMs: 60_000 }, store,
    { handle: async () => { throw new Error("Unexpected message"); } }, undefined, peers);
  return { create, saved, lookups, eventReads, options };
}

test("a verified peer conversation survives transport reinitialization but never crosses bot accounts", async () => {
  const f = fixture();
  await f.create().poll();
  await f.create().poll();
  expect(f.lookups).toEqual(["2"]);
  expect(f.eventReads).toEqual(["2-1", "2-1"]);
  expect([...f.saved]).toEqual([["1:2", "2-1"]]);

  await f.create("3").poll();
  expect(f.lookups).toEqual(["2", "2"]);
  expect(f.saved.has("3:2")).toBe(false);
});

test("a discovered direct conversation avoids the lookup, and an unrecognized ID is never persisted", async () => {
  const discovered = fixture({ listed: ["1-2"] });
  await discovered.create().poll();
  expect(discovered.lookups).toEqual([]);
  expect([...discovered.saved]).toEqual([["1:2", "1-2"]]);

  const unrecognized = fixture({ lookup: "group-7" });
  await unrecognized.create().poll();
  expect(unrecognized.eventReads).toEqual(["group-7"]);
  expect(unrecognized.saved.size).toBe(0);
});

test("a conversation X no longer serves drops its stored mapping", async () => {
  const f = fixture({ missing: true });
  await expect(f.create().poll()).rejects.toBeInstanceOf(ApiError);
  expect(f.saved.size).toBe(0);
  f.options.missing = false;
  await f.create().poll();
  expect(f.lookups).toEqual(["2", "2"]);
  expect([...f.saved]).toEqual([["1:2", "2-1"]]);
});
