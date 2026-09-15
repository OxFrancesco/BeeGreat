import { afterEach, describe, expect, test } from "bun:test";
import { BasedBotAgent } from "../src/agent";
import type { AgentHarness } from "../src/harness";
import { Store } from "../src/store";
import type { WalletService } from "../src/wallet";
import { services } from "./fixtures/agent-services";

const stores: Store[] = [];
afterEach(() => { for (const store of stores.splice(0)) store.close(); });

const address = "0x1111111111111111111111111111111111111111";

function agentFor(wallets: Pick<WalletService, "getOrCreate" | "balances">) {
  const store = new Store(":memory:");
  stores.push(store);
  const harness = {
    respond: async () => {
      throw new Error("natural wallet requests must not reach the model");
    },
  } satisfies AgentHarness;
  return new BasedBotAgent(
    { enableMainnetExecution: false, maxSlippageBps: 100, quoteTtlSeconds: 120 },
    store,
    wallets as WalletService,
    services({}),
    harness,
  );
}

const message = (text: string) => ({
  eventId: crypto.randomUUID(),
  conversationId: "conversation",
  senderId: "verified-x-user",
  text,
  encodedEvent: "signed-event",
});

describe("natural wallet handling", () => {
  test("returns the verified sender's wallet without model mediation", async () => {
    const agent = agentFor({
      getOrCreate: async (senderId) => {
        expect(senderId).toBe("verified-x-user");
        return { address } as Awaited<ReturnType<WalletService["getOrCreate"]>>;
      },
      balances: async () => "unused",
    });

    await expect(agent.handle(message("What's my address?"))).resolves.toContain(address);
  });

  test("returns the verified sender's balances without model mediation", async () => {
    const agent = agentFor({
      getOrCreate: async () => ({ address }) as Awaited<ReturnType<WalletService["getOrCreate"]>>,
      balances: async (senderId) => {
        expect(senderId).toBe("verified-x-user");
        return `Address: ${address}\nETH: 0`;
      },
    });

    await expect(agent.handle(message("Check my wallet balance"))).resolves.toContain("ETH: 0");
  });
});
