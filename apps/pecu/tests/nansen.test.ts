import { afterEach, describe, expect, test } from "bun:test";
import { PecuAgent } from "../src/agent";
import type { AgentHarness } from "../src/harness";
import { Store } from "../src/store";
import type { NansenEndpointName, NansenQuery } from "../src/integrations/nansen";
import { services } from "./fixtures/agent-services";

const stores: Store[] = [];
afterEach(() => { for (const store of stores.splice(0)) store.close(); });

const address = "0x1111111111111111111111111111111111111111";

const message = (text: string) => ({
  eventId: crypto.randomUUID(),
  conversationId: "conversation",
  senderId: "verified-x-user",
  text,
  encodedEvent: "signed-event",
});

function agentFor(nansen?: { calls: { endpoint: string; input: NansenQuery; wallet: string }[] }) {
  const store = new Store(":memory:");
  stores.push(store);
  const harness = {
    respond: async () => {
      throw new Error("nansen requests must not reach the model");
    },
  } satisfies AgentHarness;
  const agent = new PecuAgent(
    { enableMainnetExecution: false, maxSlippageBps: 100, quoteTtlSeconds: 120, depositRelayMaxUsd: 500, depositRelayDailyMaxUsd: 2000 },
    store,
    {
      getOrCreate: async () => ({ address }),
      balances: async () => "unused",
      usdcBalanceUnits: async () => 0n,
      prepare: async () => { throw new Error("unexpected prepare"); },
      approve: async () => { throw new Error("unexpected approve"); },
      transaction: async () => { throw new Error("unexpected transaction"); },
    },
    services(nansen ? {
        nansen: {
          call: async (endpoint: NansenEndpointName, input: NansenQuery, context: { wallet: `0x${string}` }) => {
            nansen.calls.push({ endpoint, input, wallet: context.wallet });
            return { endpoint, text: "balances text\nData: Nansen (nansen.ai)", data: { sample: true }, credits: {} };
          },
        },
      } : {}),
    harness,
  );
  return { agent, store };
}

describe("nansen commands", () => {
  test("/nansen wallet passes the sender wallet as context and saves details", async () => {
    const calls: { endpoint: string; input: NansenQuery; wallet: string }[] = [];
    const { agent, store } = agentFor({ calls });
    const reply = await agent.handle(message("/nansen wallet"));
    expect(reply).toContain("balances text");
    expect(reply).toContain("Data: Nansen (nansen.ai)");
    expect(calls).toEqual([{ endpoint: "wallet_balances", input: {}, wallet: address }]);
    expect(store.chatDetails("verified-x-user", "conversation")).toContain("sample");
  });

  test("an unconfigured service returns the not-configured reply", async () => {
    const { agent } = agentFor();
    await expect(agent.handle(message("/nansen wallet"))).resolves.toBe("Nansen analytics is not configured yet.");
  });

  test("/nansen help lists the commands and attribution without the model", async () => {
    const { agent } = agentFor();
    const reply = await agent.handle(message("/nansen help"));
    expect(reply).toContain("/nansen token 0xTOKEN");
    expect(reply).toContain("nansen.ai");
  });
});
