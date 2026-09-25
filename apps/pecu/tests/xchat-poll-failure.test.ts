import { afterEach, expect, test } from "bun:test";
import { ApiError } from "@xdevplatform/xdk";
import { Store } from "../src/store";
import { XChatTransport, type ChatTransportApi, type ChatTransportCrypto } from "../src/x/transport";

let store: Store | undefined;
afterEach(() => store?.close());

test("conversation rate limits reach the scheduler with reset headers intact", async () => {
  store = new Store(":memory:");
  const error = new ApiError("HTTP 429", 429, "Too Many Requests", new Headers({ "x-rate-limit-reset": "1800000000" }));
  let eventCalls = 0;
  const unexpected = (): never => { throw new Error("Unexpected call after rate limit"); };
  const api: ChatTransportApi = {
    conversationId: unexpected, publicKeys: unexpected, send: unexpected,
    conversations: async () => [{ id: "1-2", participantIds: ["1", "2"] }, { id: "1-3", participantIds: ["1", "3"] }],
    events: async () => { eventCalls++; throw error; },
  };
  const chat: ChatTransportCrypto = { decryptEvents: unexpected, setSigningKeys: unexpected, encryptReply: unexpected };
  const transport = new XChatTransport(api, chat, "1", { chatPeerUserIds: [], pollIntervalMs: 60_000 }, store, { handle: unexpected });
  await expect(transport.poll()).rejects.toBe(error);
  expect(eventCalls).toBe(1);
});
