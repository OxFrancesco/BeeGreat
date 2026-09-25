import { z } from "zod";

const encoder = new TextEncoder();

async function signature(secret: string, value: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const bytes = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(value)));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return `sha256=${btoa(binary)}`;
}

export function constantTimeEqual(left: string, right: string): boolean {
  const length = Math.max(left.length, right.length);
  let difference = left.length ^ right.length;
  for (let index = 0; index < length; index += 1) {
    difference |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }
  return difference === 0;
}

export function webhookCrcResponse(crcToken: string, consumerSecret: string): Promise<string> {
  return signature(consumerSecret, crcToken);
}

export async function verifyWebhookSignature(
  rawBody: string,
  receivedSignature: string | null,
  consumerSecret: string,
): Promise<boolean> {
  if (!receivedSignature) return false;
  return constantTimeEqual(await signature(consumerSecret, rawBody), receivedSignature);
}

type ChatActivity = { eventType: string; conversationId?: string; senderId?: string; encodedEvent?: string; keyChangeEvent?: string };
const routingText = z.string().nullish().catch("");
const routingFields = {
  conversation_id: routingText, conversationId: routingText,
  sender_id: routingText, senderId: routingText,
  encoded_event: routingText, encodedEvent: routingText,
  conversation_key_change_event: routingText, conversationKeyChangeEvent: routingText,
};
const eventSchema = z.object({
  ...routingFields,
  event_type: z.coerce.string().nullish().catch(""),
  eventType: z.coerce.string().nullish().catch(""),
  payload: z.object(routingFields).optional().catch(undefined),
});
const activitySchema = eventSchema.extend({ data: eventSchema.optional().catch(undefined) }).transform((root): ChatActivity | undefined => {
  const data = root.data ?? root;
  const payload = data.payload ?? data;
  const eventType = String(data.event_type ?? data.eventType ?? "");
  if (!eventType.startsWith("chat.")) return undefined;
  const conversationId = payload.conversation_id ?? payload.conversationId;
  const senderId = payload.sender_id ?? payload.senderId;
  const encodedEvent = payload.encoded_event ?? payload.encodedEvent;
  const keyChangeEvent = payload.conversation_key_change_event ?? payload.conversationKeyChangeEvent;
  const activity: ChatActivity = { eventType };
  if (conversationId) activity.conversationId = conversationId;
  if (senderId) activity.senderId = senderId;
  if (encodedEvent) activity.encodedEvent = encodedEvent;
  if (keyChangeEvent) activity.keyChangeEvent = keyChangeEvent;
  return activity;
}).catch(undefined);

export const activityConversation = activitySchema.parse;
