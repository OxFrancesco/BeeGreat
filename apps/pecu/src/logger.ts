import { turnTrace } from "./turn-trace";

type LogValue = string | number | boolean | null | undefined | readonly LogValue[];
type LogFields = Record<string, LogValue>;

const redact = /token|secret|authorization|api.?key|pin/i;

function safe(fields: LogFields): LogFields {
  return Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, redact.test(key) ? "[redacted]" : value]));
}

export function log(level: "info" | "warn" | "error", message: string, fields: LogFields = {}): void {
  const body = { timestamp: new Date().toISOString(), level, message, trace_id: turnTrace.getStore()?.traceId, ...safe(fields) };
  const line = JSON.stringify(body);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}
