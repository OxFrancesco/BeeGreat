import type { Event } from "@xdevplatform/chat-xdk";
import { z } from "zod";
import type { TransportStateStore } from "../state";

const previewSchema = z.object({
  senderId: z.string().optional(),
  messageText: z.string().optional(),
  replyingToMessageId: z.string().optional(),
});

export function replyConfirmationCode(event: Event, botUserId: string, store: Pick<TransportStateStore, "outgoingReplyText">): string | undefined {
  if (event.replyPreviewValidation === "invalid" || !event.conversationId) return;
  const parsed = previewSchema.safeParse(event.content?.replyingToPreview);
  if (!parsed.success || parsed.data.senderId !== botUserId) return;
  const preview = parsed.data;
  const savedText = preview.replyingToMessageId ? store.outgoingReplyText(preview.replyingToMessageId, event.conversationId) : undefined;
  const text = savedText ?? (event.replyPreviewValidation === "valid" ? preview.messageText : undefined);
  const codes = [...new Set(Array.from(text?.matchAll(/\/confirm ([A-Z0-9]{6})\b/g) ?? [], (match) => match[1]))];
  return codes.length === 1 ? codes[0] : undefined;
}
