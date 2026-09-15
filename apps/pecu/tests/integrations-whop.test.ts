import { describe, expect, test } from "bun:test";
import { WhopService } from "../src/integrations/whop";

const config = { apiKey: "whop_key", apiUrl: "https://api.whop.test/api/v1", apiVersionDate: "2026-09-13" };

function fakeFetch(status: number, body: unknown) {
  const calls: { url: string; init: RequestInit }[] = [];
  const request = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
  }) as typeof fetch;
  return { calls, request };
}

describe("WhopService", () => {
  test("pins only the matching webhook and never returns its secret", async () => {
    const url = "https://pecu.test/whop/webhook";
    const hook = { id: "hook_test", url, api_version_date: null, enabled: true, child_resource_events: true, events: ["deposit.succeeded"], secret: "private-signing-value" };
    const calls: RequestInit[] = [];
    const request = (async (_url: unknown, init: RequestInit) => {
      calls.push(init);
      return Response.json(calls.length === 1 ? { data: [hook], page_info: { has_next_page: false } } : { ...hook, api_version_date: config.apiVersionDate });
    }) as typeof fetch;
    const result = await new WhopService(config, request).configureWebhook("biz_test", url);
    expect(calls.map((call) => call.method)).toEqual(["GET", "PATCH"]);
    expect(JSON.parse(String(calls[1]?.body))).toEqual({ api_version_date: config.apiVersionDate, child_resource_events: true, enabled: true, events: ["deposit.succeeded"] });
    expect(result).not.toHaveProperty("secret");
  });

  test("refuses ambiguous or incomplete webhook listings before any update", async () => {
    const hook = { id: "hook_test", url: "https://pecu.test/whop/webhook", api_version_date: null, enabled: true, child_resource_events: true, events: [] };
    for (const [data, more] of [[[], false], [[hook, hook], false], [[hook], true]] as const) {
      const { calls, request } = fakeFetch(200, { data, page_info: { has_next_page: more } });
      await expect(new WhopService(config, request).configureWebhook("biz_test", hook.url)).rejects.toThrow("exactly one");
      expect(calls).toHaveLength(1);
    }
  });

  test("createAccount posts headers, idempotency key, and the exact account body", async () => {
    const { calls, request } = fakeFetch(201, { id: "biz_abc123", extra: "ignored" });
    const service = new WhopService(config, request);
    const account = await service.createAccount({ email: "user@example.com", title: "Pecu wallet 1", metadata: { pecu_sender_id: "1" }, idempotencyKey: "pecu-account-1" });
    expect(account).toEqual({ id: "biz_abc123" });
    const call = calls[0];
    expect(call?.url).toBe("https://api.whop.test/api/v1/accounts");
    const headers = new Headers(call?.init.headers);
    expect(headers.get("Authorization")).toBe("Bearer whop_key");
    expect(headers.get("Api-Version-Date")).toBe("2026-09-13");
    expect(headers.get("Idempotency-Key")).toBe("pecu-account-1");
    expect(JSON.parse(String(call?.init.body))).toEqual({
      email: "user@example.com",
      title: "Pecu wallet 1",
      metadata: { pecu_sender_id: "1" },
      send_customer_emails: false,
    });
  });

  test("createAccount rejects a non-biz id", async () => {
    const { request } = fakeFetch(201, { id: "user_abc" });
    await expect(new WhopService(config, request).createAccount({ email: "a@b.co", title: "t", metadata: {}, idempotencyKey: "k" })).rejects.toThrow();
  });

  test("createDeposit posts destination and amount and parses methods with nulls", async () => {
    const { calls, request } = fakeFetch(201, {
      account_id: "biz_abc123",
      amount: "50",
      hosted_url: "https://whop.test/pay/dep_1",
      methods: {
        bank: {
          currencies: [{
            currency: "usd",
            account_number: "123456",
            routing_number: "987654",
            deposit_bank_name: "Bank",
            deposit_bank_address: null,
            deposit_beneficiary_name: "Pecu",
            deposit_reference: "ref-1",
            swift_bic: null,
            rails: ["ach"],
          }],
        },
        crypto: [{
          name: "Base",
          deposit_address: "0xdeposit",
          icon_url: null,
          supported_currencies: [{ name: "USDC", icon_url: null }],
        }, {
          name: "Ethereum",
          deposit_address: null,
          icon_url: null,
          supported_currencies: [],
        }],
      },
    });
    const service = new WhopService(config, request);
    const deposit = await service.createDeposit({ destination: "biz_abc123", amount: 50, idempotencyKey: "pecu-deposit-evt" });
    expect(deposit.hosted_url).toBe("https://whop.test/pay/dep_1");
    expect(deposit.methods.bank?.currencies[0]?.account_number).toBe("123456");
    expect(deposit.methods.crypto?.[1]?.deposit_address).toBeNull();
    const call = calls[0];
    expect(call?.url).toBe("https://api.whop.test/api/v1/deposits");
    expect(JSON.parse(String(call?.init.body))).toEqual({ destination: "biz_abc123", amount: 50 });
    expect(new Headers(call?.init.headers).get("Idempotency-Key")).toBe("pecu-deposit-evt");
  });

  test("createDeposit omits amount when not given", async () => {
    const { calls, request } = fakeFetch(201, { account_id: null, hosted_url: null, methods: { bank: null, crypto: null } });
    const deposit = await new WhopService(config, request).createDeposit({ destination: "biz_abc123", idempotencyKey: "k" });
    expect(deposit.hosted_url).toBeNull();
    expect(JSON.parse(String(calls[0]?.init.body))).toEqual({ destination: "biz_abc123" });
  });

  test("maps a 500 to a user-safe error", async () => {
    const { request } = fakeFetch(500, { error: "boom" });
    await expect(new WhopService(config, request).createDeposit({ destination: "biz_abc123", idempotencyKey: "k" })).rejects.toThrow("Whop is unavailable");
  });
});
