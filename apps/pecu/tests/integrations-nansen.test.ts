import { describe, expect, test } from "bun:test";
import { NansenService, nansenEndpoints } from "../src/integrations/nansen";

const wallet = "0x1111111111111111111111111111111111111111" as const;
const token = "0x2222222222222222222222222222222222222222";

function fakeFetch(status: number, body: unknown, headers: Record<string, string> = {}) {
  const calls: { url: string; init: RequestInit }[] = [];
  const request = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...headers } });
  }) as typeof fetch;
  return { calls, request };
}

const service = (request: typeof fetch, apiKey = "nansen_key") => new NansenService(apiKey, "https://nansen.test/api/v1", request);

describe("NansenService", () => {
  test("resolves the incident's parallel AERO requests before reaching Nansen", async () => {
    const { calls, request } = fakeFetch(200, { data: {} });
    const nansen = service(request);
    await Promise.all([
      nansen.call("token_info", { token: "AERO" }, { wallet }),
      nansen.call("token_flow_intelligence", { token: "aero", timeframe: "7d" }, { wallet }),
      nansen.call("token_flow_intelligence", { token: "AERO", timeframe: "1d" }, { wallet }),
    ]);
    expect(calls).toHaveLength(3);
    for (const call of calls) expect(JSON.parse(String(call.init.body)).token_address.toLowerCase()).toBe("0x940181a94a35a4569e4529a3cdfb74e38fd98631");
  });

  test("resolves symbols only on their chain and rejects unknown EVM references before HTTP", async () => {
    const { calls, request } = fakeFetch(200, { data: {} });
    const nansen = service(request);
    await nansen.call("token_info", { token: "USDC", chain: "optimism" }, { wallet });
    expect(JSON.parse(String(calls[0]?.init.body)).token_address.toLowerCase()).toBe("0x0b2c639c533813f4aa9d7837caf62653d097ff85");
    for (const input of [{ token: "AERO", chain: "ethereum" }, { token: "UNKNOWN" }, { token: "0x123" }, { token: "ETH" }]) {
      await expect(nansen.call("token_info", input, { wallet })).rejects.toThrow("contract address");
    }
    expect(calls).toHaveLength(1);
  });

  test("token_info posts the apikey header, exact body, and ends with attribution", async () => {
    const { calls, request } = fakeFetch(200, { data: { name: "Aerodrome", symbol: "AERO", contract_address: token, logo: null, token_details: null, spot_metrics: null } });
    const result = await service(request).call("token_info", { token }, { wallet });
    expect(result.text).toContain("Aerodrome (AERO)");
    expect(result.text.endsWith("Data: Nansen (nansen.ai)")).toBe(true);
    const call = calls[0];
    expect(call?.url).toBe("https://nansen.test/api/v1/tgm/token-information");
    expect(new Headers(call?.init.headers).get("apikey")).toBe("nansen_key");
    expect(JSON.parse(String(call?.init.body))).toEqual({ chain: "base", token_address: token, timeframe: "1d" });
  });

  test("token_info summarizes the nested token-details and spot-metrics shape", async () => {
    const { request } = fakeFetch(200, {
      data: {
        name: "Aerodrome", symbol: "AERO", contract_address: token, logo: null,
        token_details: {
          token_deployment_date: "2023-08-28T00:00:00Z", website: "https://aero.test", x: "https://x.test/aero", telegram: null,
          market_cap_usd: 1_200_000, fdv_usd: 2_400_000, circulating_supply: 800_000, total_supply: 1_000_000,
        },
        spot_metrics: {
          volume_total_usd: 500_000, buy_volume_usd: 300_000, sell_volume_usd: 200_000,
          total_buys: 40, total_sells: 25, unique_buyers: 30, unique_sellers: 18,
          liquidity_usd: 2_000_000, total_holders: 12_345,
        },
      },
    });
    const result = await service(request).call("token_info", { token }, { wallet });
    expect(result.text).toContain("Aerodrome (AERO)");
    expect(result.text).toContain("Market cap: $1.20M");
    expect(result.text).toContain("Volume: $500.0K (buy $300.0K / sell $200.0K)");
    expect(result.text).toContain("Trades: 40 buys / 25 sells");
    expect(result.text).toContain("Unique traders: 30 buyers / 18 sellers");
    expect(result.text).toContain("Holders: 12.3K");
    expect(result.text).toContain("Deployed: 2023-08-28");
    expect(result.text.endsWith("Data: Nansen (nansen.ai)")).toBe(true);
  });

  test("token_info prints only the title when details and metrics are null", async () => {
    const { request } = fakeFetch(200, {
      data: { name: "Aerodrome", symbol: "AERO", contract_address: token, logo: null, token_details: null, spot_metrics: null },
    });
    const result = await service(request).call("token_info", { token }, { wallet });
    expect(result.text).toBe("Aerodrome (AERO)\nData: Nansen (nansen.ai)");
  });

  test("wallet_balances defaults to the context wallet, hides spam, and caps per_page at 25", async () => {
    const { calls, request } = fakeFetch(200, { data: [{ token_symbol: "USDC", token_amount: 5, value_usd: 5 }] });
    await service(request).call("wallet_balances", {}, { wallet });
    expect(JSON.parse(String(calls[0]?.init.body))).toEqual({ address: wallet, chain: "base", hide_spam_token: true, pagination: { page: 1, per_page: 10 } });
    await service(request).call("wallet_balances", { limit: 25 }, { wallet });
    expect(JSON.parse(String(calls[1]?.init.body)).pagination.per_page).toBe(25);
    await expect(service(request).call("wallet_balances", { limit: 26 }, { wallet })).rejects.toThrow();
  });

  test("token_dex_trades always sends only_smart_money false", async () => {
    const { calls, request } = fakeFetch(200, { data: [] });
    await service(request).call("token_dex_trades", { token }, { wallet });
    expect(JSON.parse(String(calls[0]?.init.body)).only_smart_money).toBe(false);
  });

  test("maps Nansen error envelopes to user-safe messages", async () => {
    const busy = fakeFetch(429, { code: "rate_limit_exceeded", message: "slow down", retry_after: 30 });
    await expect(service(busy.request).call("token_info", { token }, { wallet })).rejects.toThrow("Try again in 30 seconds");
    const credits = fakeFetch(402, { code: "insufficient_credits", message: "nope" });
    await expect(service(credits.request).call("token_info", { token }, { wallet })).rejects.toThrow("credits are exhausted");
    const rejected = fakeFetch(400, { code: "invalid_address_format", message: "bad address" });
    await expect(service(rejected.request).call("token_info", { token }, { wallet })).rejects.toThrow("rejected the request: bad address");
    const down = fakeFetch(503, "not json");
    await expect(service(down.request).call("token_info", { token }, { wallet })).rejects.toThrow("unavailable right now (503)");
  });

  test("the catalog only wires endpoints allowed by the redistribution policy", () => {
    const allowed = new Set([
      "tgm/token-information", "tgm/flow-intelligence", "tgm/flows", "tgm/who-bought-sold",
      "tgm/transfers", "tgm/dex-trades", "token-screener", "tgm/token-ohlcv",
      "profiler/address/current-balance", "profiler/address/transactions", "profiler/address/pnl-summary",
      "profiler/address/counterparties", "profiler/address/related-wallets", "profiler/address/pnl",
      "prediction-market/market-screener", "prediction-market/event-screener", "prediction-market/orderbook",
      "prediction-market/trades-by-market", "prediction-market/top-holders", "prediction-market/pnl-by-market",
      "prediction-market/address-summary",
    ]);
    for (const entry of Object.values(nansenEndpoints)) {
      expect(allowed.has(entry.path)).toBe(true);
      expect(entry.path).not.toMatch(/smart-money|labels|leaderboard|tgm\/holders/);
    }
  });

  test("wallet_pnl treats win_rate as a fraction only within 0..1", async () => {
    const fraction = fakeFetch(200, { realized_pnl_usd: 1_234, realized_pnl_percent: 12.3, win_rate: 0.6, traded_token_count: 9, traded_times: 20, top5_tokens: [] });
    const low = await service(fraction.request).call("wallet_pnl", {}, { wallet });
    expect(low.text).toContain("Win rate: 60%");
    const count = fakeFetch(200, { realized_pnl_usd: 1_234, realized_pnl_percent: 12.3, win_rate: 42, traded_token_count: 9, traded_times: 20, top5_tokens: [] });
    const high = await service(count.request).call("wallet_pnl", {}, { wallet });
    expect(high.text).toContain("Win rate: 42");
    expect(high.text).not.toContain("4200%");
  });

  test("wallet_pnl accepts a response with fields at the top level and no data key", async () => {
    const { request } = fakeFetch(200, {
      realized_pnl_usd: 1_234.56, realized_pnl_percent: 12.3, win_rate: 0.5,
      traded_token_count: 9, traded_times: 20,
      top5_tokens: [{ token_symbol: "AERO", token_address: token, chain: "base", realized_pnl: 500, realized_roi: 25 }],
    });
    const result = await service(request).call("wallet_pnl", {}, { wallet });
    expect(result.text).toContain("Realized PnL: $1,234.56");
    expect(result.text).toContain("AERO: $500.00");
    expect(result.text.endsWith("Data: Nansen (nansen.ai)")).toBe(true);
  });

  test("a missing key surfaces the not-configured message", async () => {
    const { request } = fakeFetch(200, {});
    await expect(new NansenService(undefined, "https://nansen.test/api/v1", request).call("token_info", { token }, { wallet })).rejects.toThrow("not configured yet");
  });

  test("date ranges cover the requested number of days", async () => {
    const { calls, request } = fakeFetch(200, { data: [] });
    await service(request).call("token_transfers", { token, days: 7 }, { wallet });
    const date = JSON.parse(String(calls[0]?.init.body)).date;
    expect(Date.parse(date.to) - Date.parse(date.from)).toBe(7 * 86_400_000);
  });
});
