export function isTransactionReadPermissionError(cause: unknown): boolean {
  const message = cause instanceof Error ? cause.message : String(cause);
  return /required scopes/i.test(message) && /wallets:transactions\.read/.test(message);
}
