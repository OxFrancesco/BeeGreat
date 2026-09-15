export function isInvalidXChatPinError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  return /\breason=InvalidPin\b/.test(message);
}
