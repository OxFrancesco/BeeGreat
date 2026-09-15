export function isTransactionReadPermissionError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /required scopes/i.test(message) && /wallets:transactions\.read/.test(message);
}
