import { z } from "zod";
import { confirmationCommand, webMessageSchema } from "../../../../src/web-contract";

export type TurnMessage = z.infer<typeof webMessageSchema>;

export type TurnPresentation =
  | Readonly<{ kind: "chat" }>
  | Readonly<{
      kind: "command";
      command: { kind: "confirm" | "cancel"; code: string };
      showReply: boolean;
    }>;

/**
 * /confirm and /cancel turns are hidden in the web chat: the original preview
 * card already shows the outcome. Their replies only stay visible when they
 * carry information the card does not (errors, or a reply that is still
 * pending).
 */
export function turnPresentation(
  message: TurnMessage,
  messages: readonly TurnMessage[],
): TurnPresentation {
  const command = confirmationCommand(message.text);
  if (!command) return { kind: "chat" };
  const target = messages.find(
    (candidate) => candidate.reply?.preview?.code === command.code,
  );
  const preview = target?.reply?.preview;
  let showReply = true;
  if (preview && message.reply) {
    if (
      command.kind === "confirm" &&
      preview.result !== undefined &&
      message.reply.text === preview.result
    ) {
      showReply = false;
    } else if (
      command.kind === "cancel" &&
      preview.state === "cancelled" &&
      message.reply.text.startsWith("Proposal cancelled")
    ) {
      showReply = false;
    }
  }
  return { kind: "command", command, showReply };
}
