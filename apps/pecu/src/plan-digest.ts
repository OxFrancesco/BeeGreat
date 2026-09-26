import { plannedCallSchema, type PlannedCall } from "./domain";

export async function digest(value: string): Promise<string> {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** Fingerprint of the exact persisted calls; confirmation refuses a plan whose steps no longer match. */
export function planDigest(calls: readonly PlannedCall[]): Promise<string> {
  return digest(JSON.stringify(calls.map((call) => plannedCallSchema.parse(call))));
}
