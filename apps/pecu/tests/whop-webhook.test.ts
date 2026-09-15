import { describe, expect, test } from "bun:test";
import { verifyWhopWebhook, whopLedgerActivitySchema } from "../src/whop-webhook";

const secret = "ws_testsecret_1234567890";
const body = JSON.stringify({ id: "evt_1", type: "deposit.succeeded", account_id: "biz_abc", data: {} });

async function sign(webhookId: string, timestamp: string, rawBody: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${webhookId}.${timestamp}.${rawBody}`));
  return btoa(String.fromCharCode(...new Uint8Array(signature)));
}

async function headers(rawBody = body, timestamp = String(Math.floor(Date.now() / 1000))): Promise<Headers> {
  return new Headers({
    "webhook-id": "msg_1",
    "webhook-timestamp": timestamp,
    "webhook-signature": `v1,${await sign("msg_1", timestamp, rawBody)}`,
  });
}

describe("Whop webhook verification", () => {
  test("accepts a valid raw-secret HMAC signature", async () => {
    expect(await verifyWhopWebhook(body, await headers(), secret)).toBe(true);
  });

  test("rejects a tampered body", async () => {
    const signed = await headers();
    expect(await verifyWhopWebhook(body.replace("evt_1", "evt_2"), signed, secret)).toBe(false);
  });

  test("rejects a timestamp six minutes old", async () => {
    const stale = String(Math.floor(Date.now() / 1000) - 360);
    expect(await verifyWhopWebhook(body, await headers(body, stale), secret)).toBe(false);
  });

  test("accepts any valid v1 entry among multiple signatures", async () => {
    const timestamp = String(Math.floor(Date.now() / 1000));
    const good = await sign("msg_1", timestamp, body);
    const signed = new Headers({
      "webhook-id": "msg_1",
      "webhook-timestamp": timestamp,
      "webhook-signature": `v1,AAAA v1,${good}`,
    });
    expect(await verifyWhopWebhook(body, signed, secret)).toBe(true);
  });

  test("rejects missing headers", async () => {
    expect(await verifyWhopWebhook(body, new Headers({ "webhook-id": "msg_1" }), secret)).toBe(false);
    expect(await verifyWhopWebhook(body, new Headers(), secret)).toBe(false);
  });
});

describe("Whop ledger activity schema", () => {
  test("parses a loose deposit.succeeded ledger activity", () => {
    const parsed = whopLedgerActivitySchema.parse({
      id: "la_1",
      object: "ledger_activity",
      line_type: "deposit",
      amount: "5000",
      usd_amount: "50.00",
      currency: { code: "USD", precision: "2", extra: true },
      posted_at: "2026-01-01T00:00:00Z",
      available_at: null,
      resource: { whatever: true },
      source: { id: "dep_1", object: "deposit", tx_hash: null, chain: "base", risk_review_hold: false, status: "completed" },
    });
    expect(parsed.id).toBe("la_1");
    expect(parsed.usd_amount).toBe("50.00");
  });
});
