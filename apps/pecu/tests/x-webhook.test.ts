import { describe, expect, test } from "bun:test";
import { activityConversation, verifyWebhookSignature, webhookCrcResponse } from "../src/x/webhook";

describe("X webhook security", () => {
  test("generates CRC responses and verifies the exact raw payload", async () => {
    const secret = "consumer-secret";
    const raw = JSON.stringify({ data: { event_type: "chat.received" } });
    const signature = await webhookCrcResponse(raw, secret);
    expect(signature).toStartWith("sha256=");
    expect(await verifyWebhookSignature(raw, signature, secret)).toBe(true);
    expect(await verifyWebhookSignature(`${raw} `, signature, secret)).toBe(false);
    expect(await verifyWebhookSignature(raw, null, secret)).toBe(false);
  });

  test("preserves ciphertext and key changes for direct webhook decryption", () => {
    expect(activityConversation({ data: { event_type: "chat.received", payload: {
      conversation_id: "1-2", sender_id: "1", encoded_event: "ciphertext", conversation_key_change_event: "key-change",
    } } })).toEqual({ eventType: "chat.received", conversationId: "1-2", senderId: "1", encodedEvent: "ciphertext", keyChangeEvent: "key-change" });
  });

  test("extracts only encrypted-chat activity routing data", () => {
    expect(activityConversation({
      data: {
        event_type: "chat.received",
        payload: { conversation_id: "1-2", sender_id: "1" },
      },
    })).toEqual({ eventType: "chat.received", conversationId: "1-2", senderId: "1" });
    expect(activityConversation({ data: { event_type: "profile.update.bio", payload: {} } })).toBeUndefined();
  });
});
