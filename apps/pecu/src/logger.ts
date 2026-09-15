const redact = /token|secret|authorization|api.?key|pin/i;

function safe(fields: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, redact.test(key) ? "[redacted]" : value]));
}

export function log(level: "info" | "warn" | "error", message: string, fields: Record<string, unknown> = {}): void {
  const body = { timestamp: new Date().toISOString(), level, message, ...safe(fields) };
  const line = JSON.stringify(body);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}
