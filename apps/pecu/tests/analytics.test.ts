import { afterEach, expect, test } from "bun:test";
import { PecuAgent } from "../src/agent";
import { analyticsIdentity, analyticsPath } from "../src/analytics-config";
import type { AgentAnalyticsEvent } from "../src/analytics";
import { Store } from "../src/store";
import { services } from "./fixtures/agent-services";

const stores: Store[] = [];
afterEach(() => { for (const store of stores.splice(0)) store.close(); });

function fixture({ failWallet = false, failAnalytics = false } = {}) {
  const store = new Store(":memory:");
  stores.push(store);
  const events: AgentAnalyticsEvent[] = [];
  const unused = async (): Promise<never> => { throw new Error("Unexpected transaction"); };
  const agent = new PecuAgent(
    { enableMainnetExecution: false, maxSlippageBps: 100, quoteTtlSeconds: 120, depositRelayMaxUsd: 500, depositRelayDailyMaxUsd: 2000 },
    store,
    {
      getOrCreate: async (senderId) => {
        if (failWallet) throw new Error("secret-bearing upstream error");
        const address = "0x1111111111111111111111111111111111111111";
        store.saveWallet(senderId, address, address);
        return { address };
      },
      balances: unused, prepare: unused, approve: unused, transaction: unused, usdcBalanceUnits: unused,
    },
    { ...services({}), analytics: (_sender, event) => {
      if (failAnalytics) throw new Error("Analytics unavailable");
      events.push(event);
    } },
    { respond: async () => "Hello!" },
  );
  return { agent, events };
}

const message = (conversationId = "x-chat") => ({
  eventId: crypto.randomUUID(), conversationId, senderId: "123456789", text: "private chat text", encodedEvent: "encrypted payload",
});

test("events cover web and X without duplicating replays or wallet provisioning", async () => {
  const { agent, events } = fixture();
  const first = message();
  await agent.handle(first);
  await agent.handle(first);
  await agent.handle(message("stocks:user_test:123456789"));
  expect(events.map((entry) => entry.event)).toEqual([
    "pecu_message_received", "pecu_wallet_provisioned", "pecu_message_completed",
    "pecu_message_received", "pecu_message_completed",
  ]);
  expect(events[0]).toEqual({ event: "pecu_message_received", channel: "x" });
  expect(events[3]).toEqual({ event: "pecu_message_received", channel: "web" });
  expect(JSON.stringify(events)).not.toMatch(/private|encrypted|123456789|0x111/);
});

test("failed onboarding emits failure without an upstream error or success event", async () => {
  const { agent, events } = fixture({ failWallet: true });
  await agent.handle(message());
  expect(events.map((entry) => entry.event)).toEqual(["pecu_message_received", "pecu_message_failed"]);
  expect(JSON.stringify(events)).not.toContain("secret-bearing");
});

test("analytics failures cannot change the reply or event deduplication", async () => {
  const { agent } = fixture({ failAnalytics: true });
  const first = message();
  expect(await agent.handle(first)).toBe("Hello!");
  expect(await agent.handle(first)).toBe("Hello!");
});

test("identities are deterministic and do not expose X or Clerk IDs", async () => {
  const id = await analyticsIdentity("123456789");
  expect(id).toMatch(/^pecu_[a-f0-9]{64}$/);
  expect(id).toBe(await analyticsIdentity("123456789"));
  expect(id).not.toBe(await analyticsIdentity("web-user_example"));
});

test("dynamic routes cannot leak identifiers into page properties", () => {
  expect(analyticsPath("/agent/private-thread")).toBe("/agent");
  expect(analyticsPath("/profile/safe/0x5afe000000000000000000000000000000000001")).toBe("/profile");
  expect(analyticsPath("/aero/stocks/private-wallet")).toBe("/aero/stocks");
  for (const path of ["/stocks", "/un-aerosdk", "/un-aerosdk/docs", "/evmsdk", "/docs/pecu", "/docs/aero", "/docs/evm", "/docs"]) {
    expect(analyticsPath(`${path}/private-token`)).toBe(path);
  }
  expect(analyticsPath("/private-token")).toBe("/other");
});
