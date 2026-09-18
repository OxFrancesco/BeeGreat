import { afterEach, expect, test } from "bun:test";
import { PecuAgent } from "../src/agent";
import type { AgentHarness } from "../src/harness";
import { Store } from "../src/store";
import type { WalletService } from "../src/wallet";
import { services } from "./fixtures/agent-services";

const stores: Store[] = [];
afterEach(() => { for (const store of stores.splice(0)) store.close(); });
const message = (text: string) => ({ eventId: crypto.randomUUID(), senderId: "user", conversationId: "thread", text, encodedEvent: "signed" });
function fixture(respond: AgentHarness["respond"], balances = "ETH: 0.001979\nUSDC: 0.036614\nAERO: 0.008976") {
  const store = new Store(":memory:");
  stores.push(store);
  let runs = 0;
  const agent = new PecuAgent(
    { enableMainnetExecution: false, maxSlippageBps: 100, quoteTtlSeconds: 120, depositRelayMaxUsd: 500, depositRelayDailyMaxUsd: 2000 },
    store,
    { getOrCreate: async () => ({ address: `0x${"1".repeat(40)}` }), balances: async () => balances } as unknown as WalletService,
    services({ aerodrome: {
      run: async () => { runs++; throw new Error("Insufficient USDC balance"); },
      basket: async () => { throw new Error("unexpected aero basket call"); },
    } }),
    { respond },
  );
  return { agent, runs: () => runs };
}

test("insufficient stock funds asks about held tokens and stops further proposals", async () => {
  const { agent, runs } = fixture(async (_message, tools) => {
    await tools.aeroPropose("stock_buy", { symbol: "NVDA", amount: "1" });
    await expect(tools.aeroPropose("swap", {})).rejects.toThrow("reply");
    return "Fund the wallet first.";
  });
  const reply = await agent.handle(message("Buy one dollar of NVIDIA"));
  expect(reply).toContain("ETH");
  expect(reply).toContain("AERO");
  expect(reply).toContain("?");
  expect(runs()).toBe(1);
});

test("ask_user returns the question even when the model emits no final text", async () => {
  const { agent } = fixture(async (_message, tools) => {
    await tools.askUser("Which token should fund the purchase?", ["ETH", "Cancel"]);
    throw new Error("OpenCode returned no text response");
  });
  expect(await agent.handle(message("Buy stock"))).toBe("Which token should fund the purchase?\n\n1. ETH\n2. Cancel");
});

test("questions do not authorize transactions or leak into the next turn", async () => {
  let turns = 0;
  const { agent } = fixture(async (_message, tools) => {
    if (++turns === 1) return tools.askUser("Use ETH?", ["Yes", "Cancel"]);
    return "Please specify how much ETH to swap. I will prepare a preview.";
  });
  await agent.handle(message("Buy stock"));
  expect(await agent.handle(message("ETH"))).toContain("preview");
});

test("does not offer empty token balances as funding sources", async () => {
  const { agent } = fixture(async (_message, tools) => tools.aeroPropose("stock_buy", { symbol: "NVDA", amount: "1" }), "ETH: 0\nUSDC: 0.01\nAERO: 0");
  const reply = await agent.handle(message("Buy stock"));
  expect(reply).not.toContain("swap ETH");
  expect(reply).toContain("deposit");
});

test("a typed Cancel answer stops a pending clarification without confirmation-code instructions", async () => {
  let calls = 0;
  const { agent } = fixture(async (_message, tools) => {
    calls++;
    return tools.askUser("Use ETH?", ["ETH", "Cancel"]);
  });
  await agent.handle(message("Buy stock"));
  const reply = await agent.handle(message("Cancel"));
  expect(reply).toBe("Cancelled. No new transaction was sent.");
  expect(calls).toBe(1);
});
