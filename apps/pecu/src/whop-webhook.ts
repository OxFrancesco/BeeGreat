import { z } from "zod";

export const whopWebhookEnvelopeSchema = z.object({
  id: z.string(),
  type: z.string(),
  account_id: z.string().nullable(),
  data: z.unknown(),
}).passthrough();

export const whopLedgerActivitySchema = z.object({
  id: z.string(),
  object: z.literal("ledger_activity"),
  line_type: z.string(),
  amount: z.string(),
  usd_amount: z.string().nullable(),
  currency: z.object({ code: z.string(), precision: z.string() }).passthrough(),
  posted_at: z.string(),
  available_at: z.string().nullable(),
  source: z.object({
    tx_hash: z.string().nullish(),
    chain: z.string().nullish(),
    risk_review_hold: z.boolean().nullish(),
    status: z.string().nullish(),
  }).passthrough().nullable(),
}).passthrough();

export const whopDepositForwardSchema = z.strictObject({
  webhookId: z.string().min(1),
  accountId: z.string().nullable(),
  data: z.unknown(),
});

const toleranceMs = 300_000;

export async function verifyWhopWebhook(rawBody: string, headers: Headers, secret: string, now = Date.now()): Promise<boolean> {
  const webhookId = headers.get("webhook-id");
  const timestamp = headers.get("webhook-timestamp");
  const signature = headers.get("webhook-signature");
  if (!webhookId || !timestamp || !signature) return false;
  const seconds = Number(timestamp);
  if (!Number.isFinite(seconds) || Math.abs(now - seconds * 1_000) > toleranceMs) return false;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
  const signed = encoder.encode(`${webhookId}.${timestamp}.${rawBody}`);
  for (const entry of signature.split(" ")) {
    const separator = entry.indexOf(",");
    if (separator < 0 || entry.slice(0, separator) !== "v1") continue;
    let bytes: Uint8Array<ArrayBuffer>;
    try {
      const binary = atob(entry.slice(separator + 1));
      bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    } catch {
      continue;
    }
    if (await crypto.subtle.verify("HMAC", key, bytes, signed)) return true;
  }
  return false;
}
