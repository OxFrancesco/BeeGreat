import { expect, test } from "bun:test";
import type { Event } from "@xdevplatform/chat-xdk";
import { replyConfirmationCode } from "../src/x/reply-confirmation";

const event: Event = {
  type: "message", verified: true, conversationId: "chat",
  content: { type: "text", text: "confirm", replyingToPreview: { senderId: "bot", replyingToMessageId: "preview", messageText: "/confirm BADBAD" } },
};
const store = { outgoingReplyText: (id: string, conversation: string) => id === "preview" && conversation === "chat" ? "/confirm ABC123" : undefined };
test("confirmation uses our saved outgoing preview instead of quoted user text", () => {
  expect(replyConfirmationCode(event, "bot", store)).toBe("ABC123");
  expect(replyConfirmationCode({ ...event, conversationId: "other" }, "bot", store)).toBeUndefined();
  expect(replyConfirmationCode({ ...event, replyPreviewValidation: "invalid" }, "bot", store)).toBeUndefined();
  expect(replyConfirmationCode(event, "other-bot", store)).toBeUndefined();
});
test("unknown previews require valid signed original and a single code", () => {
  const emptyStore = { outgoingReplyText: () => undefined };
  expect(replyConfirmationCode(event, "bot", emptyStore)).toBeUndefined();
  expect(replyConfirmationCode({ ...event, replyPreviewValidation: "valid" }, "bot", emptyStore)).toBe("BADBAD");
  const ambiguous = { ...event, replyPreviewValidation: "valid" as const, content: { ...event.content, replyingToPreview: { senderId: "bot", messageText: "/confirm ABC123 /confirm DEF456" } } };
  expect(replyConfirmationCode(ambiguous, "bot", emptyStore)).toBeUndefined();
});
