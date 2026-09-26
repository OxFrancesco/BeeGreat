import type { JsonFields } from "../src/json-contract";
import type { AgentServices } from "../src/agent";
import { afterEach, describe, expect, test } from "bun:test";
import { PecuAgent } from "../src/agent";
import { BASE_USDC_ADDRESS, plannedCallSchema } from "../src/domain";
import type { PlannedCall } from "../src/domain";
import { Store } from "../src/store";
import type { DepositRecord } from "../src/state";
import { treasurySenderId } from "../src/wallet";
import type { WalletTransaction } from "../src/wallet";
import type { WhopDeposit } from "../src/integrations/whop";
import type { UserOperationOutcome } from "../src/receipt";
import { awaitingApproval, confirmedOutcome, pendingOutcome, services, submittedTransaction } from "./fixtures/agent-services";

const userWallet = "0x1111111111111111111111111111111111111111";
const treasury = "0x2222222222222222222222222222222222222222";
const stores: Store[] = [];
afterEach(() => { for (const store of stores.splice(0)) store.close(); });

const whopDepositResponse: WhopDeposit = {
  account_id: "biz_owner",
  hosted_url: "https://whop.test/pay/dep_1",
  methods: {
    bank: {
      currencies: [{
        currency: "usd", account_number: "123456", routing_number: "987654",
        deposit_bank_name: "Test Bank", deposit_bank_address: null,
        deposit_beneficiary_name: "Pecu", deposit_reference: "ref-1", swift_bic: null,
        rails: ["ach"],
      }],
    },
    crypto: [
      { name: "Base", deposit_address: "0xbase", icon_url: null, supported_currencies: [{ name: "USDC", icon_url: null }] },
      { name: "Ethereum", deposit_address: "0xeth", icon_url: null, supported_currencies: [{ name: "USDC", icon_url: null }] },
    ],
  },
};

type FixtureOptions = Readonly<{
  enableMainnetExecution?: boolean;
  treasuryUnits?: bigint;
  maxUsd?: number;
  dailyMaxUsd?: number;
  whop?: boolean;
  outcomes?: UserOperationOutcome[];
}>;

function fixture(options: FixtureOptions = {}) {
  const store = new Store(":memory:");
  stores.push(store);
  const prepared: { senderId: string; call: PlannedCall }[] = [];
  const approved: string[] = [];
  const records = new Map<string, WalletTransaction>();
  const accountCalls: Parameters<NonNullable<AgentServices["whop"]>["createAccount"]>[0][] = [];
  const depositCalls: Parameters<NonNullable<AgentServices["whop"]>["createDeposit"]>[0][] = [];
  const outcomes = [...(options.outcomes ?? [])];
  let balanceChecks = 0;
  const whop: NonNullable<AgentServices["whop"]> = {
    createAccount: async (input) => {
      accountCalls.push(input);
      return { id: `biz_${input.metadata.pecu_sender_id}` };
    },
    createDeposit: async (input) => {
      depositCalls.push(input);
      return whopDepositResponse;
    },
  };
  const agent = new PecuAgent(
    {
      enableMainnetExecution: options.enableMainnetExecution ?? true,
      maxSlippageBps: 100,
      quoteTtlSeconds: 120,
      depositRelayMaxUsd: options.maxUsd ?? 500,
      depositRelayDailyMaxUsd: options.dailyMaxUsd ?? 2000,
    },
    store,
    {
      getOrCreate: async (senderId) => ({ address: senderId === treasurySenderId ? treasury : userWallet }),
      usdcBalanceUnits: async () => {
        balanceChecks++;
        return options.treasuryUnits ?? 1_000_000_000_000n;
      },
      balances: async () => "unused",
      prepareBatch: async () => { throw new Error("unexpected batch preparation"); }, prepare: async (senderId, call) => {
        prepared.push({ senderId, call });
        const id = `tx-${prepared.length}`;
        records.set(id, awaitingApproval(id, senderId === treasurySenderId ? treasury : userWallet));
        return { transactionId: id };
      },
      approve: async (senderId, id) => {
        approved.push(id);
        records.set(id, submittedTransaction(id, senderId === treasurySenderId ? treasury : userWallet, `0x${approved.length.toString(16).padStart(64, "0")}`));
        return { hash: records.get(id)?.hash };
      },
      transaction: async (_senderId, id) => {
        const record = records.get(id);
        if (!record) throw new Error(`unknown transaction ${id}`);
        return record;
      },
    },
    {
      ...services({ verifyUserOperation: async (reference) => outcomes.shift() ?? confirmedOutcome(reference.hash) }),
      whop: options.whop === false ? undefined : whop,
    },
    { respond: async () => { throw new Error("unexpected model call"); } },
  );
  const send = (text: string, senderId = "owner", conversationId = "chat", eventId = crypto.randomUUID(), replyConfirmationCode?: string) =>
    agent.handle({ text, senderId, conversationId, eventId, replyConfirmationCode, encodedEvent: "verified-event" });
  const setup = async () => {
    await send("/deposit setup owner@example.com");
    return store.fundingAccount("owner")!;
  };
  const ledger = (id: string, overrides: JsonFields = {}) => ({
    id,
    object: "ledger_activity",
    line_type: "deposit",
    amount: "5000",
    usd_amount: "50.00",
    currency: { code: "USD", precision: "2" },
    posted_at: new Date().toISOString(),
    available_at: null,
    source: null,
    ...overrides,
  });
  const ingest = async (id: string, overrides: JsonFields = {}, accountId: string | null = "biz_owner") => {
    const result = agent.recordWhopDeposit({ webhookId: `wh_${id}`, accountId, data: ledger(id, overrides) });
    if (result.depositId) await agent.relayDeposit(result.depositId);
    return result;
  };
  return { store, agent, prepared, approved, records, accountCalls, depositCalls, send, setup, ingest, balanceChecks: () => balanceChecks };
}

describe("deposit commands", () => {
  test("/deposit without a funding account asks for an email", async () => {
    const { send, accountCalls } = fixture();
    const reply = await send("/deposit");
    expect(reply).toContain("funding account with Whop");
    expect(reply).toContain("/deposit setup you@example.com");
    expect(accountCalls).toHaveLength(0);
  });

  test("/deposit is not configured without a Whop service", async () => {
    const { send } = fixture({ whop: false });
    expect(await send("/deposit")).toContain("not configured");
  });

  test("/deposit setup rejects an invalid email", async () => {
    const { send, accountCalls } = fixture();
    expect(await send("/deposit setup not-an-email")).toContain("Usage: /deposit setup");
    expect(accountCalls).toHaveLength(0);
  });

  test("/deposit setup creates the Whop account once and reuses it", async () => {
    const { send, accountCalls, depositCalls, store } = fixture();
    const first = await send("/deposit setup owner@example.com");
    expect(accountCalls).toHaveLength(1);
    expect(accountCalls[0]!.email).toBe("owner@example.com");
    expect(accountCalls[0]!.metadata.pecu_sender_id).toBe("owner");
    expect(store.fundingAccount("owner")?.whopAccountId).toBe("biz_owner");
    expect(first).toContain("Add funds to your Pecu wallet");
    await send("/deposit setup other@example.com");
    expect(accountCalls).toHaveLength(1);
    expect(depositCalls).toHaveLength(2);
  });

  test("/deposit 50 passes the amount and returns funding details", async () => {
    const { send, setup, depositCalls } = fixture();
    await setup();
    const reply = await send("/deposit 50");
    expect(depositCalls.at(-1)).toEqual({ destination: "biz_owner", amount: 50, idempotencyKey: expect.stringMatching(/^pecu-deposit-/) });
    expect(reply).toContain("https://whop.test/pay/dep_1");
    expect(reply).toContain(userWallet);
    expect(reply).toContain("/deposit status");
    expect(reply).toContain("Test Bank");
    expect(reply).toContain("Ethereum: 0xeth");
    expect(reply).not.toContain("0xbase");
  });

  test("natural 'add funds' routes without the model", async () => {
    const { send, setup } = fixture();
    await setup();
    const reply = await send("how do I add money to my wallet?");
    expect(reply).toContain("Add funds to your Pecu wallet");
  });
});

describe("deposit relay", () => {
  test("relays a confirmed deposit as an exact USDC transfer from the treasury", async () => {
    const { store, setup, ingest, prepared, approved } = fixture();
    await setup();
    const result = await ingest("la_1");
    expect(result.status).toBe("recorded");
    expect(prepared).toHaveLength(1);
    const [{ senderId, call }] = prepared;
    expect(senderId).toBe(treasurySenderId);
    expect(call.from).toBe(treasury);
    expect(call.to).toBe(BASE_USDC_ADDRESS);
    expect(call.value).toBe("0");
    expect(call.data).toBe(`0xa9059cbb${userWallet.slice(2).padStart(64, "0")}${(50_000_000).toString(16).padStart(64, "0")}`);
    expect(approved).toEqual(["tx-1"]);
    const deposit = store.deposit("la_1")!;
    expect(deposit.state).toBe("relayed");
    expect(deposit.relayUsdcUnits).toBe("50000000");
    const intent = store.intentForSource("deposit:la_1")!;
    expect(intent.family).toBe("deposit");
    expect(intent.state).toBe("succeeded");
    const replies = store.pendingReplies();
    expect(replies).toHaveLength(1);
    expect(replies[0]?.replyToEvent).toBe("verified-event");
    expect(replies[0]?.text).toContain("50 USDC");
    expect(replies[0]?.text).toContain("basescan.org/tx/0x");
  });

  test("ignores a duplicate ledger id", async () => {
    const { store, setup, ingest, prepared } = fixture();
    await setup();
    await ingest("la_1");
    expect((await ingest("la_1")).status).toBe("duplicate");
    expect(prepared).toHaveLength(1);
    expect(store.deposit("la_1")?.state).toBe("relayed");
  });

  test("holds deposits for unknown Whop accounts without relaying", async () => {
    const { store, ingest, prepared } = fixture();
    const result = await ingest("la_unknown", {}, "biz_stranger");
    expect(result.status).toBe("recorded");
    expect(store.deposit("la_unknown")?.state).toBe("held");
    expect(store.deposit("la_unknown")?.holdReason).toBe("unknown_account");
    expect(prepared).toHaveLength(0);
  });

  test("holds deposits above the automatic limit for manual review", async () => {
    const { store, setup, ingest, prepared } = fixture();
    await setup();
    await ingest("la_big", { usd_amount: "5000" });
    const deposit = store.deposit("la_big")!;
    expect(deposit.state).toBe("held");
    expect(deposit.holdReason).toBe("over_limit");
    expect(prepared).toHaveLength(0);
    expect(store.pendingReplies()[0]?.text).toContain("manual review");
  });

  test("holds unsettled deposits and relays once Whop releases the funds", async () => {
    const { store, agent, setup, ingest, prepared } = fixture();
    await setup();
    await ingest("la_settle", { available_at: new Date(Date.now() + 150).toISOString() });
    expect(store.deposit("la_settle")?.state).toBe("held");
    expect(store.deposit("la_settle")?.holdReason).toBe("pending_settlement");
    await agent.relayPendingDeposits();
    expect(prepared).toHaveLength(0);
    await new Promise((resolve) => setTimeout(resolve, 200));
    await agent.relayPendingDeposits();
    expect(store.deposit("la_settle")?.state).toBe("relayed");
    expect(prepared).toHaveLength(1);
  });

  test("a pending relay stays relaying and the sweep finishes it without resubmitting", async () => {
    const { store, agent, setup, ingest, prepared, approved } = fixture({ outcomes: [pendingOutcome] });
    await setup();
    await ingest("la_pending");
    const deposit = store.deposit("la_pending")!;
    expect(deposit.state).toBe("relaying");
    const intent = store.intentForSource("deposit:la_pending")!;
    expect(intent.state).toBe("executing");
    expect(store.steps(intent.id).map((step) => step.state)).toEqual(["submitted"]);
    expect(store.pendingReplies()).toHaveLength(0);
    await agent.relayPendingDeposits();
    expect(store.deposit("la_pending")?.state).toBe("relayed");
    expect(prepared).toHaveLength(1);
    expect(approved).toEqual(["tx-1"]);
    expect(store.pendingReplies()[0]?.text).toContain("50 USDC");
  });

  test("holds when the treasury lacks USDC", async () => {
    const { store, setup, ingest, prepared } = fixture({ treasuryUnits: 10_000_000n });
    await setup();
    await ingest("la_poor", { usd_amount: "50.00" });
    expect(store.deposit("la_poor")?.state).toBe("held");
    expect(store.deposit("la_poor")?.holdReason).toBe("insufficient_treasury");
    expect(prepared).toHaveLength(0);
  });

  test("the sweep backs off an insufficient-treasury recheck for ten minutes", async () => {
    const { store, agent, setup, ingest, balanceChecks } = fixture({ treasuryUnits: 10_000_000n });
    await setup();
    await ingest("la_poor");
    const checks = balanceChecks();
    expect(checks).toBeGreaterThan(0);
    await agent.relayPendingDeposits();
    expect(balanceChecks()).toBe(checks);
    expect(store.deposit("la_poor")?.state).toBe("held");
    await agent.forceRelay("la_poor");
    expect(balanceChecks()).toBe(checks + 1);
  });

  test("holds while mainnet execution is locked", async () => {
    const { store, setup, ingest, prepared } = fixture({ enableMainnetExecution: false });
    await setup();
    await ingest("la_locked");
    expect(store.deposit("la_locked")?.state).toBe("held");
    expect(store.deposit("la_locked")?.holdReason).toBe("execution_locked");
    expect(prepared).toHaveLength(0);
  });

  test("ignores non-positive ledger amounts", async () => {
    const { setup, ingest, store } = fixture();
    await setup();
    expect((await ingest("la_neg", { usd_amount: "-5.00" })).status).toBe("ignored");
    expect(store.deposit("la_neg")).toBeUndefined();
  });

  test("/deposit status lists recent deposits", async () => {
    const { send, setup, ingest } = fixture();
    await setup();
    await ingest("la_1");
    const reply = await send("/deposit status");
    expect(reply).toContain("$50.00 USD");
    expect(reply).toContain("sent 50 USDC");
    expect(reply).toContain("basescan.org/tx/");
  });

  test("/deposit status with none invites /deposit", async () => {
    const { send } = fixture();
    expect(await send("/deposit status")).toContain("No deposits yet");
  });

  test("a deposit relay intent cannot be confirmed by the user", async () => {
    const { store, send, setup } = fixture();
    await setup();
    const code = "ABC123";
    const codeHash = await sha256(code);
    store.createIntent({
      id: "dep-intent", codeHash, senderId: "owner", conversationId: "chat",
      sourceEventId: "deposit:la_x", state: "executing", family: "deposit", action: "deposit_relay",
      parameters: { depositId: "la_x", recipient: userWallet, usdcUnits: "50000000", whopAccountId: "biz_owner" },
      preview: "preview", planDigest: "digest", expiresAt: Date.now() + 60_000,
    }, []);
    expect(await send(`/confirm ${code}`)).toContain("automatic deposit relay");
    expect(await send(`/cancel ${code}`)).toContain("automatic deposit relay");
  });

  test("recovery completes a relaying deposit from a submitted step", async () => {
    const { store, agent, setup, records } = fixture();
    await setup();
    records.set("tx-recover", submittedTransaction("tx-recover", treasury, `0x${"ab".repeat(32)}`));
    const call: PlannedCall = {
      role: "action", from: treasury, to: BASE_USDC_ADDRESS,
      data: `0xa9059cbb${userWallet.slice(2).padStart(64, "0")}${(50_000_000).toString(16).padStart(64, "0")}`,
      value: "0",
    };
    const intentId = "dep-recover";
    store.createIntent({
      id: intentId, codeHash: await sha256("unused"), senderId: "owner", conversationId: "chat",
      sourceEventId: "deposit:la_recover", state: "executing", family: "deposit", action: "deposit_relay",
      parameters: { depositId: "la_recover", recipient: userWallet, usdcUnits: "50000000", whopAccountId: "biz_owner" },
      preview: "preview", planDigest: await planDigest([call]), expiresAt: Date.now() + 60_000,
    }, [call]);
    store.markStepPrepared(intentId, 0, "tx-recover");
    store.markStepSubmitted(intentId, 0, `0x${"ab".repeat(32)}`);
    store.recordDeposit(depositRecord("la_recover", { state: "relaying", intentId, relayUsdcUnits: "50000000" }));
    await agent.resumeExecuting();
    expect(store.deposit("la_recover")?.state).toBe("relayed");
    expect(store.intentForSource("deposit:la_recover")?.state).toBe("succeeded");
  });
});

function depositRecord(id: string, overrides: Partial<DepositRecord> = {}) {
  return {
    id, webhookId: "wh", whopAccountId: "biz_owner", senderId: "owner",
    amount: "5000", currency: "usd", precision: "2", usdAmount: "50.00",
    state: "received" as const, postedAt: Date.now(), ...overrides,
  };
}

async function sha256(value: string): Promise<string> {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function planDigest(calls: readonly PlannedCall[]): Promise<string> {
  return sha256(JSON.stringify(calls.map((call) => plannedCallSchema.parse(call))));
}
