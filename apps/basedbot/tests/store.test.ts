import { afterEach, describe, expect, test } from "bun:test";
import { Store } from "../src/store";
import { eventProcessingLeaseMs } from "../src/state";

let store: Store | undefined;
afterEach(() => store?.close());

describe("durable state", () => {
  test("claims each X event once and returns its cached reply", () => {
    store = new Store(":memory:");
    expect(store.claimEvent("event-1", "1:2", "2")).toBe("claimed");
    expect(store.claimEvent("event-1", "1:2", "2")).toBe("busy");
    store.completeEvent("event-1", "done");
    expect(store.claimEvent("event-1", "1:2", "2")).toBe("completed");
    expect(store.eventReply("event-1")).toBe("done");
  });

  test("uses compare-and-set for proposal execution", () => {
    store = new Store(":memory:");
    const expiresAt = Date.now() + 1000;
    const call = {
      role: "action" as const,
      from: "0x1111111111111111111111111111111111111111" as const,
      to: "0x2222222222222222222222222222222222222222" as const,
      data: "0x12345678" as const,
      value: "0",
    };
    store.createIntent({
      id: "intent-1", codeHash: "hash", senderId: "2", conversationId: "1:2", sourceEventId: "event-1",
      state: "pending", family: "aero", action: "stake", parameters: { chain: 8453, wallet: call.from, pool: call.to },
      preview: "stake preview", planDigest: "digest", expiresAt,
    }, [call]);
    expect(store.intentForCode("hash")?.action).toBe("stake");
    expect(store.steps("intent-1").map((step) => step.call)).toEqual([call]);
    expect(store.transitionIntent("intent-1", "pending", "executing")).toBe(true);
    expect(store.transitionIntent("intent-1", "pending", "executing")).toBe(false);
  });

  test("reuses the same outbox record for one source event", () => {
    store = new Store(":memory:");
    store.enqueueReply("reply:event-1", "1:2", "raw", "hello");
    store.enqueueReply("reply:event-1", "1:2", "raw", "hello");
    expect(store.pendingReplies()).toHaveLength(1);
  });

  test("seeds historical events without turning them into commands", () => {
    store = new Store(":memory:");
    store.ignoreEvent("old-event", "1:2", "2");
    expect(store.claimEvent("old-event", "1:2", "2")).toBe("completed");
    expect(store.eventReply("old-event")).toBeUndefined();
  });

  test("revives only unanswered bootstrap events", () => {
    store = new Store(":memory:");
    expect(store.claimEvent("stuck-event", "1:2", "2")).toBe("claimed");
    expect(store.claimEvent("stuck-event", "1:2", "2", true)).toBe("claimed");
    store.completeEvent("stuck-event", "done");
    expect(store.claimEvent("stuck-event", "1:2", "2", true)).toBe("completed");
    expect(store.eventReply("stuck-event")).toBe("done");
  });

  test("reclaims an interrupted event after its processing lease expires", () => {
    store = new Store(":memory:");
    expect(store.claimEvent("interrupted-event", "1:2", "2", false, 1_000)).toBe("claimed");
    expect(store.claimEvent("interrupted-event", "1:2", "2", false, 1_000 + eventProcessingLeaseMs - 1)).toBe("busy");
    expect(store.claimEvent("interrupted-event", "1:2", "2", false, 1_000 + eventProcessingLeaseMs)).toBe("claimed");
    store.completeEvent("interrupted-event", "recovered");
    expect(store.claimEvent("interrupted-event", "1:2", "2", false, 1_000 + eventProcessingLeaseMs * 2)).toBe("completed");
  });

  test("keeps one agent session and verified turn per sender and conversation", () => {
    store = new Store(":memory:");
    store.saveAgentSession("2", "1:2", "session-1");
    expect(store.agentSession("2", "1:2")).toBe("session-1");
    expect(store.agentSession("3", "1:2")).toBeUndefined();
    store.saveAgentTurn("session-1", {
      senderId: "2",
      conversationId: "1:2",
      eventId: "event-1",
      text: "show my positions",
      encodedEvent: "ciphertext",
    });
    expect(store.agentTurn("session-1")?.eventId).toBe("event-1");
  });
});
