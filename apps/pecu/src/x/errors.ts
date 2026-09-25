import { z } from "zod";

export function isInvalidXChatPinError(cause: unknown): boolean {
  const message = cause instanceof Error ? cause.message : z.string().catch("").parse(cause);
  return /\breason=InvalidPin\b/.test(message);
}
