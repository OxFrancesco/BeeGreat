import { afterEach, describe, expect, test } from "bun:test";
import { PecuAgent, type AgentServices } from "../src/agent";
import { Store } from "../src/store";
import type { PlannedCall, VerifiedMessage } from "../src/domain";
import type { StockBasketPlanResult } from "../src/aerodrome";
import { awaitingApproval, confirmedOutcome, services, submittedTransaction } from "./fixtures/agent-services";

const wallet = "0x1111111111111111111111111111111111111111";
const usdc = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const router = "0x5555555555555555555555555555555555555555";
const stores: Store[] = [];
afterEach(() => { for (const store of stores.splice(0)) store.close(); });

const trades = [
  { side: "buy", stock: "NVDAc", amount: "1" },
  { side: "buy", stock: "AAPLc", amount: "2" },
] as const;

const basketPlan: StockBasketPlanResult = {
  kind: "transaction",
  action: "stock_basket",
  parameters: { trades: [...trades], slippage: 0.01 },
  context: {
    allocation: [],
    slippage: 0.01,
    trades: [
      { from: "USDC", to: "NVDAc", amount: "1", expected: "0.005", minimum: "0.00495" },
      { from: "USDC", to: "AAPLc", amount: "2", expected: "0.01", minimum: "0.0099" },
    ],
  },
  calls: [
    { role: "approval", from: wallet, to: usdc, data: `0x095ea7b3${"0".repeat(128)}`, value: "0" },
    { role: "action", from: wallet, to: router, data: "0x24856bc3", value: "0" },
  ],
};

function fixture(overrides: { aerodrome?: AgentServices["aerodrome"]; balances?: string } = {}) {
  const store = new Store(":memory:");
  stores.push(store);
  const prepared: PlannedCall[] = [];
  const approved: string[] = [];
  const records = new Map<string, ReturnType<typeof awaitingApproval>>();
  const agent = new PecuAgent(
    { enableMainnetExecution: true, maxSlippageBps: 100, quoteTtlSeconds: 120, depositRelayMaxUsd: 500, depositRelayDailyMaxUsd: 2000 },
    store,
    {
      getOrCreate: async () => ({ address: wallet }),
      usdcBalanceUnits: async () => 0n,
      balances: async () => overrides.balances ?? "ETH: 0.5\nUSDC: 0.01\nAERO: 0.008976",
      prepare: async (_senderId, call) => {
        prepared.push(call);
        const id = `tx-${prepared.length}`;
        records.set(id, awaitingApproval(id, wallet));
        return { transactionId: id };
      },
      approve: async (_senderId, id) => {
        approved.push(id);
        records.set(id, submittedTransaction(id, wallet, `0x${approved.length.toString().padStart(64, "0")}`));
        return { hash: records.get(id)?.hash };
      },
      transaction: async (_senderId, id) => {
        const record = records.get(id);
        if (!record) throw new Error(`unknown transaction ${id}`);
        return record;
      },
    },
    services({ aerodrome: overrides.aerodrome ?? {
      run: async () => { throw new Error("unexpected aero call"); },
      basket: async () => basketPlan,
    }, verifyUserOperation: async (reference) => confirmedOutcome(reference.hash) }),
    { respond: async () => { throw new Error("unexpected model call"); } },
  );
  const message = (text: string, eventId = crypto.randomUUID()): VerifiedMessage => ({
    eventId, senderId: "owner", conversationId: "chat", text, encodedEvent: "verified-event",
  });
  return { agent, store, prepared, approved, message };
}

describe("stock basket proposals", () => {
  test("a basket preview lists every trade and confirms into one plan", async () => {
    const { agent, store, prepared, approved, message } = fixture();
    const request = message("Buy $1 of NVDAc and $2 of AAPLc");
    const reply = await agent.capabilitiesFor(request).stockTrades(trades);
    expect(reply).toContain("1 USDC → about 0.005 NVDAc");
    expect(reply).toContain("Minimum received: 0.00495 NVDAc");
    expect(reply).toContain("2 USDC → about 0.01 AAPLc");
    expect(reply).toContain("Minimum received: 0.0099 AAPLc");
    expect(reply).toContain("Network fee: not estimated yet");
    const code = reply.match(/\/confirm ([A-Z0-9]{6})/)?.[1];
    expect(code).toBeDefined();
    expect(prepared).toHaveLength(0);

    const intent = store.intentForCode(await sha256(code!), "owner", "chat");
    expect(intent?.family).toBe("stocks");
    expect(intent?.action).toBe("stock_basket");
    expect(intent?.parameters).toEqual({ trades: [...trades], slippage: 0.01 });
    expect(intent?.sourceEventId).toBe(request.eventId);
    expect(reply).toContain("Transactions:\n1. Revoke 0x0000…0000's permission to spend USDC\n2. Call 0x5555…5555\n\nReply to this message");
    expect(store.transactionPlan(intent!.id)?.steps.map((step) => step.kind)).toEqual(["approval", "call"]);

    const confirmed = await agent.handle(message(`/confirm ${code}`));
    expect(confirmed).toContain("Stock trades confirmed on Base mainnet.");
    expect(prepared).toHaveLength(2);
    expect(prepared.map((call) => call.role)).toEqual(["approval", "action"]);
    expect(approved).toEqual(["tx-1", "tx-2"]);
    expect(store.intentForCode(await sha256(code!), "owner", "chat")?.state).toBe("succeeded");
  });

  test("an insufficient USDC basket error asks how to fund the purchase", async () => {
    const { agent, message } = fixture({ aerodrome: {
      run: async () => { throw new Error("unexpected aero call"); },
      basket: async () => { throw new Error("Insufficient USDC balance: this needs 3 USDC and the wallet holds 0.01 USDC"); },
    } });
    const reply = await agent.capabilitiesFor(message("Buy $1 of NVDAc and $2 of AAPLc")).stockTrades(trades);
    expect(reply).toContain("You don't have enough USDC");
    expect(reply).toContain("ETH");
    expect(reply).toContain("Deposit USDC");
    expect(reply).toContain("?");
  });

  test("the persisted intent round-trips through the store", async () => {
    const { agent, store, message } = fixture();
    const request = message("Buy $1 of NVDAc and $2 of AAPLc");
    const reply = await agent.capabilitiesFor(request).stockTrades(trades);
    const code = reply.match(/\/confirm ([A-Z0-9]{6})/)![1]!;
    const stored = store.intentForCode(await sha256(code), "owner", "chat");
    expect(stored?.family).toBe("stocks");
    if (stored?.family !== "stocks") throw new Error("expected stocks family");
    expect(stored.parameters.trades).toEqual([...trades]);
    expect(stored.parameters.slippage).toBe(0.01);
    expect(store.intentForSource(request.eventId)?.id).toBe(stored.id);
    expect(store.steps(stored.id).map((step) => step.call.role)).toEqual(["approval", "action"]);
  });
});

async function sha256(value: string): Promise<string> {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
