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

function constantTimeEqual(left: string, right: string): boolean {
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

export function activityConversation(body: unknown): { eventType: string; conversationId?: string; senderId?: string; encodedEvent?: string; keyChangeEvent?: string } | undefined {
  if (!body || typeof body !== "object") return undefined;
  const root = body as Record<string, unknown>;
  const data = root.data && typeof root.data === "object" ? root.data as Record<string, unknown> : root;
  const payload = data.payload && typeof data.payload === "object" ? data.payload as Record<string, unknown> : data;
  const eventType = String(data.event_type ?? data.eventType ?? "");
  if (!eventType.startsWith("chat.")) return undefined;
  const conversationId = payload.conversation_id ?? payload.conversationId;
  const senderId = payload.sender_id ?? payload.senderId;
  const encodedEvent = payload.encoded_event ?? payload.encodedEvent;
  const keyChangeEvent = payload.conversation_key_change_event ?? payload.conversationKeyChangeEvent;
  return {
    eventType,
    ...(typeof conversationId === "string" && conversationId ? { conversationId } : {}),
    ...(typeof senderId === "string" && senderId ? { senderId } : {}),
    ...(typeof encodedEvent === "string" && encodedEvent ? { encodedEvent } : {}),
    ...(typeof keyChangeEvent === "string" && keyChangeEvent ? { keyChangeEvent } : {}),
  };
}
