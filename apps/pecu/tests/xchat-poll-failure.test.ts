import { afterEach, expect, test } from "bun:test";
import { ApiError } from "@xdevplatform/xdk";
import type { ChatWithJuicebox } from "@xdevplatform/chat-xdk";
import type { PecuAgent } from "../src/agent";
import { Store } from "../src/store";
import type { XApi } from "../src/x/api";
import { XChatTransport } from "../src/x/transport";

let store: Store | undefined;
afterEach(() => store?.close());

test("conversation rate limits reach the scheduler with reset headers intact", async () => {
  store = new Store(":memory:");
  const error = new ApiError("HTTP 429", 429, "Too Many Requests", new Headers({ "x-rate-limit-reset": "1800000000" }));
  let eventCalls = 0;
  const api = {
    conversations: async () => [{ id: "1-2", participantIds: ["1", "2"] }, { id: "1-3", participantIds: ["1", "3"] }],
    events: async () => { eventCalls++; throw error; },
  } as unknown as XApi;
  const transport = new XChatTransport(api, {} as ChatWithJuicebox, "1", { chatPeerUserIds: [], pollIntervalMs: 60_000 }, store, {} as PecuAgent);
  await expect(transport.poll()).rejects.toBe(error);
  expect(eventCalls).toBe(1);
});
