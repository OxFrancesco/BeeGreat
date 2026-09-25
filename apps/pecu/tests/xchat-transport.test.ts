import { describe, expect, test } from "bun:test";
import type { SendPayload } from "@xdevplatform/chat-xdk";
import type { PecuAgent } from "../src/agent";
import type { TransportStateStore } from "../src/state";
import { type ChatTransportApi, type ChatTransportCrypto, XChatTransport } from "../src/x/transport";

describe("X Chat inbox bootstrap", () => {
  test("replies to the latest recent inbound message from a configured request peer", async () => {
    const botUserId = "2086819052069007360";
    const peerUserId = "1319617668186542087";
    const conversationId = `${peerUserId}-${botUserId}`;
    const encodedEvent = "encoded-help-event";
    const handled: string[] = [];
    const sent: SendPayload[] = [];
    const ignored: string[] = ["event-help"];
    const pending: Array<{
      id: string;
      conversationId: string;
      replyToEvent: string;
      text: string;
      payloadJson?: string;
    }> = [];
    let initialized = false;

    const api: ChatTransportApi = {
      conversations: async () => [],
      conversationId: async (peerId: string) => {
        expect(peerId).toBe(peerUserId);
        return conversationId;
      },
      events: async (requestedConversationId: string) => {
        expect(requestedConversationId).toBe(conversationId);
        return ({
        data: [{
          id: "sequence-event-help",
          senderId: peerUserId,
          conversationId,
          encodedEvent,
        }],
        meta: { conversationKeyEvents: [] },
        });
      },
      publicKeys: async () => [{
        public_key_version: "1",
        signing_public_key: "signing-key",
        public_key: "identity-key",
        identity_public_key_signature: "identity-signature",
      }],
      send: async (_conversationId: string, payload: SendPayload) => { sent.push(payload); },
    };
    const chat: ChatTransportCrypto = {
      setSigningKeys() {},
      decryptEvents: () => ({
        messages: [{
          originalB64: encodedEvent,
          event: {
            type: "message",
            id: "event-help",
            senderId: peerUserId,
            conversationId,
            createdAtMsec: Date.now() - 1_000,
            verified: true,
            content: { text: "/help" },
          },
        }],
        conversationKeys: { keys: {}, latestVersion: null },
        errors: {},
      }),
      encryptReply: () => ({
        signature: "signature", signatureInfo: { publicKeyVersion: "1", signatureVersion: "1" }, conversationKeyVersion: "1", shouldNotify: true,
        messageId: "reply-message",
        encryptedContent: "encrypted-reply",
        encodedEventSignature: "reply-signature",
      }),
    };
    const store: TransportStateStore = {
      outgoingReplyText: () => undefined,
      ignoreEvent: (eventId) => { ignored.push(eventId); },
      enqueueReply: (id, replyConversationId, replyToEvent, text) => {
        pending.push({ id, conversationId: replyConversationId, replyToEvent, text });
      },
      pendingReplies: () => pending,
      prepareReply: (id, payloadJson) => {
        const reply = pending.find((item) => item.id === id);
        if (reply) reply.payloadJson = payloadJson;
      },
      sentReply: (id) => {
        const index = pending.findIndex((item) => item.id === id);
        if (index >= 0) pending.splice(index, 1);
      },
      failReply() {},
      transportInitialized: () => initialized,
      savePaginationToken: () => { initialized = true; },
    };
    const agent: Pick<PecuAgent, "handle"> = {
      handle: async ({ text }: { text: string }, retryUnanswered?: boolean) => {
        expect(retryUnanswered).toBe(true);
        ignored.splice(ignored.indexOf("event-help"), 1);
        handled.push(text);
        return "Pecu is ready.";
      },
    };

    const transport = new XChatTransport(
      api,
      chat,
      botUserId,
      { chatPeerUserIds: [peerUserId], pollIntervalMs: 60_000 },
      store,
      agent,
    );

    await transport.poll();

    expect(handled).toEqual(["/help"]);
    expect(ignored).toEqual([]);
    expect(sent).toHaveLength(1);
    expect(initialized).toBe(true);
  });

  test.each([false, true])("handles a chat.received webhook, ciphertext included: %s", async (includesCiphertext) => {
    const botUserId = "2086819052069007360";
    const peerUserId = "1319617668186542087";
    const conversationId = `${peerUserId}-${botUserId}`;
    const pending: Array<{ id: string; conversationId: string; replyToEvent: string; text: string; payloadJson?: string }> = [];
    const sent: SendPayload[] = [];
    let fullInboxScans = 0;
    let historyReads = 0;
    const api: ChatTransportApi = {
      conversationId: async () => conversationId,
      conversations: async () => { fullInboxScans += 1; return []; },
      events: async (requested: string) => {
        historyReads += 1;
        expect(requested).toBe(conversationId);
        return {
          data: [{ id: "outer-event", senderId: peerUserId, conversationId, encodedEvent: "encoded-event" }],
          meta: { conversationKeyEvents: [] },
        };
      },
      publicKeys: async () => [{ public_key_version: "1", signing_public_key: "signing-key" }],
      send: async (_conversationId: string, payload: SendPayload) => { sent.push(payload); },
    };
    const chat: ChatTransportCrypto = {
      setSigningKeys() {},
      decryptEvents: () => ({
        messages: [{
          originalB64: "encoded-event",
          event: {
            type: "message",
            id: "signed-event",
            senderId: peerUserId,
            conversationId,
            verified: true,
            content: { text: "/wallet" },
          },
        }],
        conversationKeys: { keys: {}, latestVersion: null },
        errors: {},
      }),
      encryptReply: () => ({
        signature: "signature", signatureInfo: { publicKeyVersion: "1", signatureVersion: "1" }, conversationKeyVersion: "1", shouldNotify: true,
        messageId: "reply-message",
        encryptedContent: "encrypted-reply",
        encodedEventSignature: "reply-signature",
      }),
    };
    const store: TransportStateStore = {
      outgoingReplyText: () => undefined,
      ignoreEvent() {},
      enqueueReply: (id, replyConversationId, replyToEvent, text) => {
        pending.push({ id, conversationId: replyConversationId, replyToEvent, text });
      },
      pendingReplies: () => pending,
      prepareReply: (id, payloadJson) => {
        const reply = pending.find((item) => item.id === id);
        if (reply) reply.payloadJson = payloadJson;
      },
      sentReply: (id) => {
        const index = pending.findIndex((item) => item.id === id);
        if (index >= 0) pending.splice(index, 1);
      },
      failReply() {},
      transportInitialized: () => true,
      savePaginationToken() {},
    };
    const agent: Pick<PecuAgent, "handle"> = {
      handle: async ({ text }: { text: string }) => {
        expect(text).toBe("/wallet");
        return "wallet reply";
      },
    };
    const transport = new XChatTransport(
      api,
      chat,
      botUserId,
      { chatPeerUserIds: [peerUserId], pollIntervalMs: 60_000 },
      store,
      agent,
    );

    type ActivityPayload = { conversation_id: string; sender_id: string; encoded_event?: string; conversation_key_change_event?: string };
    const payload: ActivityPayload = { conversation_id: conversationId, sender_id: peerUserId };
    if (includesCiphertext) {
      payload.encoded_event = "encoded-event";
      payload.conversation_key_change_event = "key-change";
    }
    expect(await transport.ingestActivity({ data: { event_type: "chat.received", payload } })).toBe(true);
    expect(fullInboxScans).toBe(0);
    expect(historyReads).toBe(includesCiphertext ? 0 : 1);
    expect(sent).toHaveLength(1);
  });
});
