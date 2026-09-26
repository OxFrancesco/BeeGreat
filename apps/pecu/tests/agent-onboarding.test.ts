import { afterEach, expect, test } from "bun:test";
import { PecuAgent } from "../src/agent";
import { Store } from "../src/store";
import { treasurySenderId } from "../src/wallet";
import { services } from "./fixtures/agent-services";

const address = "0x1111111111111111111111111111111111111111";
const stores: Store[] = [];
afterEach(() => { for (const store of stores.splice(0)) store.close(); });

function fixture() {
  const store = new Store(":memory:");
  stores.push(store);
  const requested: string[] = [];
  let unavailable = false;
  const unused = async (): Promise<never> => { throw new Error("unexpected wallet action"); };
  const agent = new PecuAgent(
    { enableMainnetExecution: false, maxSlippageBps: 100, quoteTtlSeconds: 120, depositRelayMaxUsd: 500, depositRelayDailyMaxUsd: 2000 },
    store,
    {
      getOrCreate: async (senderId) => {
        requested.push(senderId);
        if (unavailable) throw new Error("Wallet service unavailable");
        store.saveWallet(senderId, address, address);
        return { address };
      },
      balances: unused, prepareBatch: unused, prepare: unused, approve: unused, transaction: unused, usdcBalanceUnits: unused,
    },
    services({}),
    { respond: async (message) => {
      expect(store.wallet(message.senderId)?.address).toBe(address);
      return "Hello!";
    } },
  );
  return { agent, store, requested, fail: (value: boolean) => { unavailable = value; } };
}

const message = (text = "Hello!", senderId = "sender") => ({
  eventId: crypto.randomUUID(), conversationId: "chat", senderId, text, encodedEvent: "verified-event",
});

test("a greeting provisions the verified sender before the model replies", async () => {
  const f = fixture();
  const first = message();
  expect(await f.agent.handle(first)).toBe("Hello!");
  expect(await f.agent.handle(first)).toBe("Hello!");
  expect(await f.agent.handle({ ...message(), conversationId: "another-chat" })).toBe("Hello!");
  expect(f.requested).toEqual(["sender"]);
});

test("help as the first message also provisions a wallet", async () => {
  const f = fixture();
  await f.agent.handle(message("/help"));
  expect(f.store.wallet("sender")?.address).toBe(address);
  expect(f.requested).toEqual(["sender"]);
});

test("existing wallets skip onboarding and different senders provision independently", async () => {
  const f = fixture();
  f.store.saveWallet("sender", address, address);
  await f.agent.handle(message());
  await f.agent.handle(message("Hello!", "another-sender"));
  expect(f.requested).toEqual(["another-sender"]);
});

test("failed creation reports an error and retries on the next message", async () => {
  const f = fixture();
  f.fail(true);
  const first = message();
  expect(await f.agent.handle(first)).toContain("Wallet service unavailable");
  expect(f.store.wallet("sender")).toBeUndefined();
  await f.agent.handle(first);
  expect(f.requested).toEqual(["sender"]);
  f.fail(false);
  expect(await f.agent.handle(message())).toBe("Hello!");
  expect(f.requested).toEqual(["sender", "sender"]);
});

test("the reserved treasury sender cannot provision through chat", async () => {
  const f = fixture();
  expect(await f.agent.handle(message("Hello!", treasurySenderId))).toContain("reserved");
  expect(f.requested).toEqual([]);
});
