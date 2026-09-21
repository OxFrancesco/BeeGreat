import { describe, expect, test } from "bun:test";
import { analyticsResultsSchema, analyticsText } from "../src/analytics-contract";
import { nansenAnalytics } from "../src/integrations/nansen-analytics";
import { NansenService } from "../src/integrations/nansen";
import { parseCommand } from "../src/domain";
import { Store } from "../src/store";

const address = "0x1111111111111111111111111111111111111111";
const request = { address, chain: "base", date: { from: "2026-08-22T00:00:00Z", to: "2026-09-21T00:00:00Z" } };
const pagination = { page: 1, per_page: 1000, is_last_page: true };
const pnl = { pagination, data: [
  { token_address: "0x2222", token_symbol: "A", pnl_usd_realised: 10, pnl_usd_unrealised: -5 },
  { token_address: "0x3333", token_symbol: "B", pnl_usd_realised: -8, pnl_usd_unrealised: null },
] };
const balances = { pagination, data: [{ chain: "base", token_address: "0x2222", token_symbol: "USDC", token_amount: 100, value_usd: 100 }] };
const defi = { summary: { total_assets_usd: 50, total_debts_usd: 70, total_rewards_usd: 1, total_value_usd: -20 }, protocols: [{ protocol_name: "Lending", chain: "base", total_assets_usd: 50, total_debts_usd: 70, total_value_usd: -20 }] };

describe("Nansen analytics", () => {
  test("flows keep zero, negative and missing data distinct and suppress undocumented wallet counts", () => {
    const snapshot = nansenAnalytics("token_flow_intelligence", { chain: "base", token_address: address, timeframe: "1d" }, { data: [{ smart_trader_net_flow_usd: 0, smart_trader_wallet_count: 0, exchange_net_flow_usd: -30, exchange_wallet_count: 0, whale_net_flow_usd: null, fresh_wallets_net_flow_usd: "50" }] }, 1);
    expect(snapshot?.kind).toBe("flows");
    if (snapshot?.kind !== "flows") throw new Error("Missing flows");
    expect(snapshot.rows[0]).toEqual({ label: "Smart traders", netUsd: 0, wallets: 0 });
    expect(snapshot.rows[1]?.netUsd).toBeNull();
    expect(snapshot.rows[2]).toEqual({ label: "Exchanges", netUsd: -30, wallets: null });
    expect(snapshot.rows[3]?.netUsd).toBeNull();
    expect(snapshot.partial).toBe(true);
    expect(analyticsText(snapshot)).toContain("Groups may overlap");
    expect(analyticsText(snapshot)).not.toContain("Exchanges: -$30.00 net, 0 wallets");
  });
  test("detailed P&L preserves losses, request scope and missing valuations", () => {
    const snapshot = nansenAnalytics("wallet_pnl_breakdown", request, pnl, 10);
    if (snapshot?.kind !== "pnl") throw new Error("Missing P&L");
    expect(snapshot.period).toBe("2026-08-22 to 2026-09-21");
    expect(snapshot.rows[1]).toEqual({ chain: "base", address: "0x3333", symbol: "B", realizedUsd: -8, unrealizedUsd: null });
    expect(snapshot.partial).toBe(true);
    expect(nansenAnalytics("wallet_pnl_breakdown", request, { data: [{ token_address: "A", token_symbol: "A", pnl_usd_realised: Infinity }] }, 1)).toBeUndefined();
  });
  test("empty complete responses differ from missing or truncated responses", () => {
    const empty = nansenAnalytics("wallet_pnl_breakdown", request, { pagination, data: [] }, 1);
    expect(empty?.partial).toBe(false);
    const truncated = nansenAnalytics("wallet_pnl_breakdown", request, { pagination: { ...pagination, is_last_page: false }, data: [] }, 1);
    expect(truncated?.partial).toBe(true);
    expect(nansenAnalytics("wallet_pnl_breakdown", request, {}, 1)).toBeUndefined();
  });
  test("portfolio preserves debt and separate sources instead of inventing a combined total", () => {
    const snapshot = nansenAnalytics("wallet_portfolio", { address, chain: "all" }, { balances, defi }, 1);
    if (snapshot?.kind !== "portfolio") throw new Error("Missing portfolio");
    expect(snapshot.defi?.netUsd).toBe(-20);
    expect(snapshot.balances?.[0]?.valueUsd).toBe(100);
    expect(snapshot.partial).toBe(false);
    expect(analyticsText(snapshot)).toContain("receipt tokens can overlap");
    const partial = nansenAnalytics("wallet_portfolio", { address, chain: "all" }, { balances: null, defi }, 1);
    expect(partial?.partial).toBe(true);
    expect(nansenAnalytics("wallet_portfolio", { address }, { balances: null, defi: null }, 1)).toBeUndefined();
  });
  test("portfolio calls the documented endpoints using the verified wallet and retains a successful source", async () => {
    const calls: { url: string; body: unknown }[] = [];
    const fetcher: typeof fetch = Object.assign(async (input: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(input), body: JSON.parse(String(init?.body)) });
      return String(input).endsWith("defi-holdings") ? Response.json({ code: "upstream_unavailable" }, { status: 503 }) : Response.json(balances);
    }, { preconnect: fetch.preconnect });
    const service = new NansenService("test-key", "https://nansen.test/api/v1", fetcher);
    const result = await service.call("wallet_portfolio", {}, { wallet: address });
    expect(calls).toHaveLength(2);
    expect(calls[0]?.body).toMatchObject({ address, chain: "all", pagination: { page: 1, per_page: 1000 } });
    expect(calls[1]).toEqual({ url: "https://nansen.test/api/v1/portfolio/defi-holdings", body: { wallet_address: address } });
    expect(result.analytics?.snapshot.partial).toBe(true);
    expect(result.text).toContain("DeFi positions are unavailable");
  });
  test("snapshots survive store reconstruction, remain event-scoped and replace repeated reads", () => {
    const store = new Store(":memory:");
    try {
      const snapshot = nansenAnalytics("wallet_pnl_breakdown", request, pnl, 1);
      if (!snapshot) throw new Error("Missing snapshot");
      store.saveAnalytics("a", { snapshot, text: analyticsText(snapshot) });
      store.saveAnalytics("a", { snapshot: { ...snapshot, observedAt: 2 }, text: analyticsText(snapshot) });
      expect(store.analytics("a")).toHaveLength(1);
      expect(store.analytics("a")[0]?.snapshot.observedAt).toBe(2);
      expect(store.analytics("b")).toEqual([]);
      expect(analyticsResultsSchema.parse(JSON.parse(JSON.stringify(store.analytics("a"))))).toEqual(store.analytics("a"));
    } finally { store.close(); }
  });
  test("commands expose the chart reads without requiring model routing", () => {
    expect(parseCommand("/nansen portfolio")).toEqual({ type: "nansen", endpoint: "wallet_portfolio", input: {} });
    expect(parseCommand(`/nansen flows ${address} base 7d`)).toEqual({ type: "nansen", endpoint: "token_flow_intelligence", input: { token: address, chain: "base", timeframe: "7d" } });
    expect(parseCommand("/nansen pnl base")).toEqual({ type: "nansen", endpoint: "wallet_pnl_breakdown", input: { chain: "base" } });
  });
});
