import { afterEach, expect, test } from "bun:test";
import { PecuAgent } from "../src/agent";
import type { ResponseMode } from "../src/harness";
import type { RequestRoute } from "../src/request-classifier";
import { Store } from "../src/store";
import { services } from "./fixtures/agent-services";

const stores: Store[] = [];
afterEach(() => { for (const store of stores.splice(0)) store.close(); });
const message = (text: string) => ({ eventId: crypto.randomUUID(), senderId: "sender", conversationId: "chat", text, encodedEvent: "verified" });

function fixture(route: RequestRoute) {
  const store = new Store(":memory:");
  stores.push(store);
  const address = "0x1111111111111111111111111111111111111111";
  store.saveWallet("sender", address, address);
  const modes: (ResponseMode | undefined)[] = [];
  let classifications = 0;
  let reads = 0;
  const unused = async (): Promise<never> => { throw new Error("unexpected transaction"); };
  const agent = new PecuAgent(
    { enableMainnetExecution: false, maxSlippageBps: 100, quoteTtlSeconds: 120, depositRelayMaxUsd: 500, depositRelayDailyMaxUsd: 2000 },
    store,
    { getOrCreate: async () => ({ address }), balances: async () => { reads++; return "USDC: 5"; }, prepare: unused, approve: unused, transaction: unused, usdcBalanceUnits: unused },
    services({}),
    { respond: async (_message, _capabilities, mode) => { modes.push(mode); return "model reply"; } },
    { classify: async () => { classifications++; return route; } },
  );
  return { agent, store, modes, classifications: () => classifications, reads: () => reads };
}

test("classified commands skip inference and event replays do not repeat reads", async () => {
  const f = fixture({ kind: "command", command: "balance" });
  const input = message("Please fetch the funds I currently hold");
  expect(await f.agent.handle(input)).toBe("USDC: 5");
  expect(await f.agent.handle(input)).toBe("USDC: 5");
  expect(f.modes).toEqual([]);
  expect(f.reads()).toBe(1);
  expect(f.classifications()).toBe(1);
});

test.each(["response", "mixed", "fallback"] as const)("%s reaches inference with the correct mode", async (kind) => {
  const f = fixture({ kind });
  expect(await f.agent.handle(message("Explain slippage"))).toBe("model reply");
  expect(f.modes).toEqual([kind === "fallback" ? undefined : kind]);
});

test.each(["/balance", "b/balance", "show my balance", "/invalid"])("%s bypasses the classifier", async (text) => {
  const f = fixture({ kind: "response" });
  await f.agent.handle(message(text));
  expect(f.classifications()).toBe(0);
  expect(f.modes).toEqual([]);
});

test("retry and pending clarification preserve the original inference path", async () => {
  const f = fixture({ kind: "command", command: "balance" });
  await f.agent.handle({ ...message("Explain that"), retryContext: "prior conversation" });
  const first = message("Choose funding");
  f.store.saveQuestion(first, { question: "Which token?", options: ["USDC", "ETH"] });
  await f.agent.handle(message("USDC"));
  expect(f.classifications()).toBe(0);
  expect(f.modes).toEqual([undefined, undefined]);
});

test("requests starting with help do not lose the rest of the question", async () => {
  const f = fixture({ kind: "response" });
  expect(await f.agent.handle(message("Help me understand slippage"))).toBe("model reply");
  expect(f.classifications()).toBe(1);
  expect(f.modes).toEqual(["response"]);
});
