import { expect, test } from "bun:test";
import { turnPresentation, type TurnMessage } from "../src/lib/turns";

const RESULT =
  "Aerodrome swap confirmed on Base mainnet.\nhttps://basescan.org/tx/0x933d8f8cb5584d9667fd2c845e7977bf67ece4f430dbb5389e63427cb999a716";

function message(text: string, reply: TurnMessage["reply"] = null): TurnMessage {
  return { id: `m:${text}`, text, createdAt: 1, reply };
}

const preview = (over: Record<string, unknown> = {}) => ({
  code: "A1B2C3",
  title: "Swap",
  text: "Swap 0.001 ETH for about 3.9 USDC on Base.",
  state: "succeeded" as const,
  expiresAt: 1,
  ...over,
});

const target = message("Swap 0.001 ETH to USDC", {
  text: RESULT,
  preview: preview({ result: RESULT }),
});

test("a regular message is a chat turn", () => {
  const turn = message("What's my balance?", { text: "ETH: 0.5", preview: null });
  expect(turnPresentation(turn, [turn])).toEqual({ kind: "chat" });
});

test("a confirm reply that repeats the card result stays hidden", () => {
  const turn = message("/confirm A1B2C3", { text: RESULT, preview: null });
  expect(turnPresentation(turn, [target, turn])).toEqual({
    kind: "command",
    command: { kind: "confirm", code: "A1B2C3" },
    showReply: false,
  });
});

test("a confirm reply with an error stays visible", () => {
  for (const text of [
    "This preview is already being processed.",
    "Confirmation code not found for this X account and conversation.",
    "Pecu submitted the transaction and is waiting for the receipt.",
  ]) {
    const turn = message("/confirm A1B2C3", { text, preview: null });
    expect(turnPresentation(turn, [target, turn])).toEqual({
      kind: "command",
      command: { kind: "confirm", code: "A1B2C3" },
      showReply: true,
    });
  }
});

test("a confirm turn without a reply yet stays visible", () => {
  const turn = message("/confirm A1B2C3");
  expect(turnPresentation(turn, [target, turn])).toEqual({
    kind: "command",
    command: { kind: "confirm", code: "A1B2C3" },
    showReply: true,
  });
});

test("a cancel reply that repeats a cancelled card stays hidden", () => {
  const cancelled = message("Send 1 USDC", {
    text: "Preview",
    preview: preview({ code: "D4E5F6", state: "cancelled" }),
  });
  const turn = message("/cancel D4E5F6", {
    text: "Proposal cancelled. Nothing was sent.",
    preview: null,
  });
  expect(turnPresentation(turn, [cancelled, turn])).toEqual({
    kind: "command",
    command: { kind: "cancel", code: "D4E5F6" },
    showReply: false,
  });
});

test("a cancel reply stays visible when the card is not cancelled or the code is unknown", () => {
  const turn = message("/cancel D4E5F6", {
    text: "Confirmation code not found for this X account and conversation.",
    preview: null,
  });
  expect(turnPresentation(turn, [target, turn])).toMatchObject({
    kind: "command",
    showReply: true,
  });
});
