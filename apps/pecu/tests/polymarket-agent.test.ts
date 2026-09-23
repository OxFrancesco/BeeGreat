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
    { getOrCreate: async () => ({ address }), balances: unexpected, prepare: unexpected, approve: unexpected, transaction: unexpected, usdcBalanceUnits: unexpected },
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
