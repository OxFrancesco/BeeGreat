import { expect, test } from "bun:test";
import { analyticsResultsSchema, analyticsText, type PolymarketSnapshot } from "../src/analytics-contract";
import { polymarketAnalytics } from "../src/integrations/polymarket/analytics";
import type { PolymarketRead } from "../src/integrations/polymarket/client";
import { PecuAgent } from "../src/agent";
import { Store } from "../src/store";
import { services } from "./fixtures/agent-services";
import { polymarketReads } from "./fixtures/polymarket-reads";

const read = (name: keyof typeof polymarketReads, next: PolymarketRead["next"] = null): PolymarketRead => ({ ...structuredClone(polymarketReads[name]) as PolymarketRead, next });
function snapshot<K extends PolymarketSnapshot["kind"]>(kind: K, input: Record<string, unknown>, result: PolymarketRead) {
  const value = polymarketAnalytics(input, result);
  if (value?.kind !== kind) throw new Error(`Expected ${kind}, got ${value?.kind}`);
  return value as Extract<PolymarketSnapshot, { kind: K }>;
}

test("markets and events become market-implied odds with Polymarket links", () => {
  const market = snapshot("pm_odds", { slug: "will-the-us-invade-iran-before-2027" }, read("market_by_slug"));
  expect(market.rows).toEqual([{ label: "Yes", probability: 0.145 }, { label: "No", probability: 0.855 }]);
  expect(market.url).toBe("https://polymarket.com/event/will-the-us-invade-iran-before-2027");
  expect(market.liquidityUsd).toBeCloseTo(1152377.03, 1);
  const event = snapshot("pm_odds", {}, read("event_by_slug"));
  expect(event.title).toBe("Fed Decision in October?");
  expect(event.rows[0]).toEqual({ label: "25 bps increase", probability: 0.535 });
  expect(event.rows.map((row) => row.probability)).toEqual([...event.rows.map((row) => row.probability)].sort((a, b) => (b ?? 0) - (a ?? 0)));
  const text = analyticsText(event);
  expect(text).toContain("25 bps increase: 53.5%");
  expect(text).toContain("market-implied odds");
  expect(text.endsWith("Data: Polymarket (polymarket.com)")).toBe(true);
});

test("lists, history, books, boards and traders keep units, nulls and pages honest", () => {
  const markets = snapshot("pm_markets", { closed: false }, read("markets", { endpoint: "markets", input: { after_cursor: "x" } }));
  expect(markets.rows).toHaveLength(3);
  expect(markets.partial).toBe(false);
  expect(markets.rows[0]?.leader).toBe("Conventus Stellarum");
  const search = snapshot("pm_markets", { q: "bitcoin" }, read("search"));
  expect(search.subject).toBe("bitcoin");
  expect(search.rows[0]?.leader).toBe("↑ 92,500");
  const history = snapshot("pm_history", { token_id: "123", interval: "1m" }, read("prices_history"));
  expect(history.points[0]).toEqual({ t: 1787571000, p: 0.165 });
  expect(history.period).toBe("Past month");
  const book = snapshot("pm_book", { token_id: "123" }, read("book"));
  expect(book.bids[0]?.price).toBe(0.14);
  expect(book.asks[0]?.price).toBe(0.15);
  expect(book.bids.map((level) => level.price)).toEqual([...book.bids.map((level) => level.price)].sort((a, b) => b - a));
  expect(book.midpoint).toBeCloseTo(0.145, 5);
  expect(book.spread).toBeCloseTo(0.01, 5);
  expect(book.lastTrade).toBe(0.14);
  const board = snapshot("pm_leaderboard", { time_period: "week" }, read("leaderboard"));
  expect(board.board).toBe("pnl");
  expect(board.rows[0]).toMatchObject({ rank: 1, name: "totoro3miyazaki" });
  expect(analyticsText(board)).toContain("shares");
  expect(polymarketAnalytics({ user: "0x0f6f76ced62a911bccef92f50faaff143854d977" }, read("leaderboard"))).toBeUndefined();
  const wins = snapshot("pm_wins", { time_period: "week" }, read("biggest_winners"));
  expect(wins.rows[0]).toMatchObject({ rank: 1, name: "timetowander", url: "https://polymarket.com/event/fed-decision-in-september-762" });
  const trader = snapshot("pm_trader", { user: "0x0f6f76ced62a911bccef92f50faaff143854d977", interval: "1m" }, read("user_pnl"));
  expect(trader.points).toHaveLength(4);
  const positions = snapshot("pm_positions", { user: "0x0f6f76ced62a911bccef92f50faaff143854d977" }, read("positions", { endpoint: "positions", input: { cursor: "x" } }));
  expect(positions.partial).toBe(true);
  expect(positions.rows[0]?.outcome).toBe("Alex Michelsen");
  expect(analyticsText(positions)).toContain("More results are available");
  expect(polymarketAnalytics({}, read("positions"))).toBeUndefined();
  expect(analyticsResultsSchema.parse([markets, history, book, board, wins, trader, positions].map((value) => ({ snapshot: value, text: analyticsText(value) })))).toHaveLength(7);
});

test("unexpected shapes and out-of-range prices never become cards", () => {
  expect(polymarketAnalytics({}, { ...read("book"), data: { bids: "nope" } })).toBeUndefined();
  expect(polymarketAnalytics({}, { ...read("markets"), endpoint: "status" })).toBeUndefined();
  const market = read("market_by_slug");
  const broken: PolymarketRead = { ...market, data: { ...(market.data as object), outcomePrices: "[\"1.7\", \"oops\"]" } };
  expect(snapshot("pm_odds", {}, broken).rows.map((row) => row.probability)).toEqual([null, null]);
  const sparse = read("event_by_slug");
  const event = sparse.data as { markets: Record<string, unknown>[] };
  event.markets = event.markets.map(({ liquidityNum: _l, liquidity: _q, volume24hr: _v, ...market }, index) => index === 0 ? { ...market, closed: true } : market);
  const odds = snapshot("pm_odds", {}, sparse);
  expect(odds.rows).toHaveLength(event.markets.length - 1);
});

test("Polymarket reads attach saved cards to commands and model tool calls", async () => {
  const store = new Store(":memory:");
  const address = "0x1111111111111111111111111111111111111111";
  store.saveWallet("sender", address, address);
  const unexpected = async (): Promise<never> => { throw new Error("Unexpected wallet action"); };
  const agent = new PecuAgent(
    { enableMainnetExecution: false, maxSlippageBps: 100, quoteTtlSeconds: 120, depositRelayMaxUsd: 500, depositRelayDailyMaxUsd: 2000 },
    store,
    { getOrCreate: async () => ({ address }), balances: unexpected, prepare: unexpected, approve: unexpected, transaction: unexpected, usdcBalanceUnits: unexpected },
    { ...services({}), polymarketRead: async (endpoint) => read(endpoint === "book" ? "book" : "event_by_slug"), polymarket: { research: unexpected } },
    { respond: async (_message, capabilities) => { await capabilities.polymarketRead("book", { token_id: "123" }); return "The book is thin near the midpoint."; } },
    { classify: async () => ({ kind: "mixed" }) },
  );
  try {
    const command = { eventId: "event-command", senderId: "sender", conversationId: "chat", text: "/polymarket read event_by_slug {\"slug\":\"fed-decision-in-october-20260617190323537\"}", encodedEvent: "verified" };
    const reply = await agent.handle(command);
    const saved = store.analytics("event-command");
    expect(saved).toHaveLength(1);
    expect(saved[0]?.snapshot.kind).toBe("pm_odds");
    expect(reply).toBe(saved[0]?.text);
    const model = { eventId: "event-model", senderId: "sender", conversationId: "chat", text: "How deep is the order book?", encodedEvent: "verified" };
    expect(await agent.handle(model)).toBe("The book is thin near the midpoint.");
    expect(store.analytics("event-model").map((result) => result.snapshot.kind)).toEqual(["pm_book"]);
  } finally { store.close(); }
});
