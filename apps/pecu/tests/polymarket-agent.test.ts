import { expect, test } from "bun:test";
import { PecuAgent } from "../src/agent";
import { Store } from "../src/store";
import { services } from "./fixtures/agent-services";
import { polymarketRead } from "../src/integrations/polymarket/client";

const address = "0x1111111111111111111111111111111111111111";
const message = (text: string) => ({ eventId: crypto.randomUUID(), senderId: "sender", conversationId: "chat", text, encodedEvent: "verified" });
const unexpected = async (): Promise<never> => { throw new Error("Unexpected wallet action"); };

test("commands and natural-language capabilities share direct reads, save evidence, and never call Exa", async () => {
  const store = new Store(":memory:");
  store.saveWallet("sender", address, address);
  const calls: Array<{ endpoint: string; input: unknown }> = [];
  const direct: typeof polymarketRead = async (endpoint, input) => {
    calls.push({ endpoint, input });
    return { endpoint, source: "https://gamma-api.polymarket.com/public-search?q=Fed", observedAt: "2026-09-23T10:00:00.000Z", data: { events: [{ id: "123", title: "Fed rate decision", slug: "fed-decision" }] }, next: null };
  };
  const agent = new PecuAgent(
    { enableMainnetExecution: false, maxSlippageBps: 100, quoteTtlSeconds: 120, depositRelayMaxUsd: 500, depositRelayDailyMaxUsd: 2000 },
    store,
    { getOrCreate: async () => ({ address }), balances: unexpected, prepareBatch: async () => { throw new Error("unexpected batch preparation"); }, prepare: unexpected, approve: unexpected, transaction: unexpected, usdcBalanceUnits: unexpected },
    { ...services({}), polymarketRead: direct, polymarket: { research: unexpected } },
    { respond: async (_message, capabilities) => capabilities.polymarketRead("search", { q: "Fed" }) },
    { classify: async () => ({ kind: "mixed" }) },
  );
  try {
    const command = message("/polymarket Fed");
    const reply = await agent.handle(command);
    expect(reply).toContain("Fed rate decision");
    expect(reply).toContain("https://polymarket.com/event/fed-decision");
    expect(reply).not.toContain('"events":');
    await agent.handle(command);
    expect(calls).toHaveLength(1);
    const structured = await agent.handle(message("Find a prediction market about interest rates"));
    if (structured === undefined) throw new Error("Expected a model reply");
    expect(JSON.parse(structured).source).toContain("gamma-api.polymarket.com");
    expect(calls).toEqual([{ endpoint: "search", input: { q: "Fed", limit_per_type: 5 } }, { endpoint: "search", input: { q: "Fed" } }]);
    expect(store.chatDetails("sender", "chat")).toContain("observedAt");
  } finally { store.close(); }
});

const btcMarket = (year: number, price: string) => ({
  id: String(year), question: `Will Bitcoin hit $100k by December 31, ${year}?`, slug: `btc-100k-${year}`,
  endDate: `${year + 1}-01-01T05:00:00Z`, conditionId: `condition-${year}`, active: true, closed: false,
  outcomes: '["Yes","No"]', outcomePrices: JSON.stringify([price, String(1 - Number(price))]),
  clobTokenIds: JSON.stringify([`yes-${year}`, `no-${year}`]),
  description: 'Unnecessary repeated upstream metadata. '.repeat(4000),
});

test("identical in-flight reads share work, without caching later reads, failures or other turns", async () => {
  const store = new Store(":memory:");
  let gate = Promise.withResolvers<void>();
  let calls = 0;
  let fail = false;
  const direct: typeof polymarketRead = async (endpoint) => {
    calls++;
    await gate.promise;
    if (fail) throw new Error("Polymarket unavailable");
    return {endpoint,source:"https://gamma-api.polymarket.com/public-search",observedAt:new Date().toISOString(),next:null,data:{events:[]}};
  };
  const agent = new PecuAgent(
    {enableMainnetExecution:false,maxSlippageBps:100,quoteTtlSeconds:120,depositRelayMaxUsd:500,depositRelayDailyMaxUsd:2000}, store,
    {getOrCreate:async()=>({address}),balances:unexpected,prepareBatch:unexpected,prepare:unexpected,approve:unexpected,transaction:unexpected,usdcBalanceUnits:unexpected},
    {...services({}),polymarketRead:direct}, {respond:unexpected},
  );
  const turn = message("Polymarket Bitcoin");
  const read = () => agent.capabilitiesFor(turn).polymarketRead("search",{q:"Bitcoin"});
  try {
    const first = read();
    const duplicate = read();
    const otherTurn = agent.capabilitiesFor(message("Polymarket Bitcoin")).polymarketRead("search",{q:"Bitcoin"});
    expect(calls).toBe(2);
    gate.resolve();
    const results = await Promise.all([first,duplicate,otherTurn]);
    expect(results[0]).toBe(results[1]);
    await read();
    expect(calls).toBe(3);
    gate = Promise.withResolvers<void>();
    fail = true;
    const failed = Promise.allSettled([read(),read()]);
    expect(calls).toBe(4);
    gate.resolve();
    expect((await failed).map(result=>result.status)).toEqual(["rejected","rejected"]);
    fail = false;
    await read();
    expect(calls).toBe(5);
  } finally { store.close(); }
});

test("large discoveries remain usable and parallel selected reads attach only exact-market cards", async () => {
  const store = new Store(":memory:");
  store.saveWallet("sender", address, address);
  const turn = message("Will BTC hit 100k this year?");
  const waiting = Promise.withResolvers<void>();
  const started: string[] = [];
  const direct: typeof polymarketRead = async (endpoint) => {
    const base = { endpoint, source: "https://gamma-api.polymarket.com/public-search", observedAt: "2026-09-24T07:13:40.000Z", next: null };
    if (endpoint === "search") return { ...base, data: { events: [{ id: "event", title: "When will Bitcoin hit $100k?", slug: "btc-100k", markets: [btcMarket(2027, "0.84"), btcMarket(2026, "0.37")] }] } };
    started.push(endpoint);
    if (started.length === 2) waiting.resolve();
    await waiting.promise;
    return { ...base, data: endpoint === "midpoint" ? { mid: "0.37" } : { asset_id: "yes-2026", bids: [{price:"0.36",size:"10"}], asks: [{price:"0.38",size:"10"}] } };
  };
  const agent = new PecuAgent(
    { enableMainnetExecution: false, maxSlippageBps: 100, quoteTtlSeconds: 120, depositRelayMaxUsd: 500, depositRelayDailyMaxUsd: 2000 }, store,
    { getOrCreate: async () => ({ address }), balances: unexpected, prepareBatch: async () => { throw new Error("unexpected batch preparation"); }, prepare: unexpected, approve: unexpected, transaction: unexpected, usdcBalanceUnits: unexpected },
    { ...services({}), polymarketRead: direct },
    { respond: async (_message, capabilities) => {
      const discovery = await capabilities.polymarketRead("search", {q:"Bitcoin 100k"});
      expect(Buffer.byteLength(discovery)).toBeLessThan(40_000);
      expect(discovery).toContain("yes-2026");
      expect(discovery).toContain("December 31, 2026");
      expect(store.analytics(turn.eventId)).toEqual([]);
      await Promise.all([capabilities.polymarketRead("midpoint", {token_id:"yes-2026"}), capabilities.polymarketRead("book", {token_id:"yes-2026"})]);
      return "37%";
    } }, { classify: async () => ({kind:"mixed"}) },
  );
  try {
    expect(await agent.handle(turn)).toBe("37%");
    expect(started).toEqual(["midpoint", "book"]);
    const saved = store.analytics(turn.eventId);
    expect(saved.map(x=>x.snapshot.kind).sort()).toEqual(["pm_book", "pm_odds"]);
    expect(JSON.stringify(saved)).not.toContain("2027 leads");
    expect(saved.find(x=>x.snapshot.kind==="pm_odds")?.snapshot).toMatchObject({title:btcMarket(2026,"0.37").question,rows:[{label:"Yes",probability:0.37}]});
    expect(saved.find(x=>x.snapshot.kind==="pm_book")?.snapshot).toMatchObject({title:btcMarket(2026,"0.37").question,outcome:"Yes"});
    expect(store.analytics(message("other event").eventId)).toEqual([]);
  } finally { store.close(); }
});
