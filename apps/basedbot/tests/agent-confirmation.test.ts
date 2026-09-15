import { afterEach, describe, expect, spyOn, test } from "bun:test";
import { BasedBotAgent } from "../src/agent";
import { Store } from "../src/store";
import type { PlannedCall } from "../src/domain";
import type { AeroResult } from "../src/aerodrome";
import type { EvmPlanResult } from "../src/evm";
import type { UserOperationOutcome } from "../src/receipt";
import type { WalletTransaction } from "../src/wallet";
import { awaitingApproval, confirmedOutcome, evmStub, services, submittedTransaction } from "./fixtures/agent-services";

const wallet = "0x1111111111111111111111111111111111111111";
const pool = "0x2222222222222222222222222222222222222222";
const recipient = "0x3333333333333333333333333333333333333333";
const usdc = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const stores: Store[] = [];
afterEach(() => { for (const store of stores.splice(0)) store.close(); });

type FixtureOptions = Readonly<{
  quoteTtlSeconds?: number;
  enableMainnetExecution?: boolean;
  aeroResult?: AeroResult;
  evmResult?: EvmPlanResult;
  outcomes?: UserOperationOutcome[];
  transactionReadError?: () => Error | undefined;
}>;

function fixture(options: FixtureOptions = {}) {
  const store = new Store(":memory:");
  stores.push(store);
  const prepared: PlannedCall[] = [];
  const approved: string[] = [];
  const verified: string[] = [];
  const records = new Map<string, WalletTransaction>();
  const outcomes = [...(options.outcomes ?? [])];
  const agent = new BasedBotAgent(
    { enableMainnetExecution: options.enableMainnetExecution ?? true, maxSlippageBps: 100, quoteTtlSeconds: options.quoteTtlSeconds ?? 120 }, store,
    {
      getOrCreate: async () => ({ address: wallet }),
      balances: async () => "unused",
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
        const failure = options.transactionReadError?.();
        if (failure) throw failure;
        const record = records.get(id);
        if (!record) throw new Error(`unknown transaction ${id}`);
        return record;
      },
    },
    services({
      aero: options.aeroResult ?? {
        kind: "transaction", action: "stake", parameters: { chain: 8453, wallet, pool }, context: {},
        calls: [{ role: "action", from: wallet, to: pool, data: "0x12345678", value: "0" }],
      },
      evm: evmStub({
        propose: options.evmResult ?? {
          kind: "transaction", action: "transfer", parameters: { to: recipient, amount: "5", token: "USDC" }, summary: "Send 5 USDC", context: {},
          calls: [{ role: "action", from: wallet, to: usdc, data: `0xa9059cbb${recipient.slice(2).padStart(64, "0")}${(5_000_000).toString(16).padStart(64, "0")}`, value: "0" }],
        },
      }),
      verifyUserOperation: async (reference) => {
        verified.push(reference.hash);
        return outcomes.shift() ?? confirmedOutcome(reference.hash);
      },
    }),
    { respond: async () => { throw new Error("unexpected model call"); } },
  );
  const send = (text: string, senderId = "owner", conversationId = "chat", eventId = crypto.randomUUID(), replyConfirmationCode?: string) => agent.handle({
    text, senderId, conversationId, eventId, replyConfirmationCode, encodedEvent: "verified-event",
  });
  const propose = async (command = `/aero stake --pool ${pool}`) => {
    const reply = await send(command);
    const code = reply?.match(/\/cancel ([A-F0-9]{6})/)?.[1];
    if (!code) throw new Error(`proposal did not include a code: ${reply}`);
    return code;
  };
  return { store, prepared, approved, verified, records, send, propose };
}

describe("confirmation authorization and execution", () => {
  test("missing read permission keeps the prepared transaction recoverable without duplicate preparation", async () => {
    let blocked = true;
    const { send, propose, prepared, approved, store } = fixture({ transactionReadError: () => blocked ? new Error('{"error":true,"message":"The API key lacks required scopes: wallets:transactions.read"}') : undefined });
    const code = await propose();
    const response = await send(`/confirm ${code}`);
    expect(response).toContain("permission is missing");
    expect(response).not.toContain("{");
    expect(prepared).toHaveLength(1);
    expect(approved).toHaveLength(0);
    expect(store.intentForCode(await sha256(code))?.state).toBe("executing");
    blocked = false;
    expect(await send(`/confirm ${code}`)).toContain("confirmed on Base");
    expect(prepared).toHaveLength(1);
    expect(approved).toEqual(["tx-1"]);
  });
  test("a permission-blocked preview cannot be approved after expiry", async () => {
    let blocked = true;
    const { send, propose, prepared, approved } = fixture({ transactionReadError: () => blocked ? new Error("required scopes: wallets:transactions.read") : undefined });
    const code = await propose();
    await send(`/confirm ${code}`);
    blocked = false;
    const clock = spyOn(Date, "now").mockReturnValue(Date.now() + 300_000);
    try {
      expect(await send(`/confirm ${code}`)).toContain("expired before approval");
      expect(prepared).toHaveLength(1);
      expect(approved).toHaveLength(0);
    } finally { clock.mockRestore(); }
  });
  test("reply cancellation and expired replies never execute", async () => {
    const { send, propose, approved } = fixture();
    const code = await propose();
    expect(await send("cancel", "owner", "chat", crypto.randomUUID(), code)).toContain("cancelled");
    expect(await send("confirm", "owner", "chat", crypto.randomUUID(), code)).toContain("cancelled");
    expect(approved).toHaveLength(0);
    const expired = fixture({ quoteTtlSeconds: -1 });
    const oldCode = await expired.propose();
    expect(await expired.send("confirm", "owner", "chat", crypto.randomUUID(), oldCode)).toContain("expired");
    expect(expired.approved).toHaveLength(0);
  });
  test("reply confirmation selects the referenced plan and remains scoped and idempotent", async () => {
    const { propose, send, approved } = fixture();
    const code = await propose();
    await propose();
    expect(await send("confirm")).toContain("Reply to the transaction preview");
    expect(await send("confirm", "attacker", "chat", crypto.randomUUID(), code)).toContain("not found");
    expect(await send("confirm", "owner", "other", crypto.randomUUID(), code)).toContain("not found");
    expect(await send("confirm", "owner", "chat", crypto.randomUUID(), code)).toContain("confirmed on Base");
    await send("confirm", "owner", "chat", crypto.randomUUID(), code);
    expect(approved).toEqual(["tx-1"]);
  });
  test("YOLO is explicit, scoped, reversible, and deduplicates events", async () => {
    const { send, approved, store } = fixture();
    expect(await send("/yolo")).toContain("off");
    expect(await send("/yolo on")).toContain("on for you");
    expect(store.yoloEnabled("attacker", "chat")).toBe(false);
    expect(store.yoloEnabled("owner", "other")).toBe(false);
    const eventId = crypto.randomUUID();
    await send(`/aero stake --pool ${pool}`, "owner", "chat", eventId);
    await send(`/aero stake --pool ${pool}`, "owner", "chat", eventId);
    expect(approved).toEqual(["tx-1"]);
    await send("/yolo off");
    await send(`/aero stake --pool ${pool}`);
    expect(approved).toHaveLength(1);
  });
  test("YOLO cannot bypass the global execution lock", async () => {
    const { send, approved, prepared } = fixture({ enableMainnetExecution: false });
    await send("/yolo on");
    expect(await send(`/aero stake --pool ${pool}`)).toContain("disabled");
    expect(prepared).toHaveLength(0);
    expect(approved).toHaveLength(0);
  });

  test("verbose reveals only this sender's latest result and does not create or execute another plan", async () => {
    const { store, send, prepared, approved } = fixture();
    const persist = spyOn(store, "createIntent");
    const preview = await send(`/aero stake --pool ${pool}`);
    expect(preview).not.toContain("{");
    expect(preview).not.toContain("Plan ID");
    const verbose = await send("b/verbose");
    expect(JSON.parse(verbose ?? "null")).toMatchObject({ action: "stake", calls: [{ to: pool }] });
    expect(await send("b/verbose", "attacker")).toContain("No technical details yet");
    expect(await send("b/verbose", "owner", "other-chat")).toContain("No technical details yet");
    expect(await send("/verbose")).toBe(verbose);
    expect(persist).toHaveBeenCalledTimes(1);
    expect(prepared).toHaveLength(0);
    expect(approved).toHaveLength(0);
    const next = await send(`/aero stake --pool ${pool}`);
    expect(next).not.toContain("{");
  });
  test("an already balanced index creates no confirmation or persisted plan", async () => {
    const { store, prepared, approved, send } = fixture({ aeroResult: {
      kind: "unchanged", action: "index_rebalance", parameters: { allocations: "NVDAc=100" }, context: { trades: [] },
    } });
    const persist = spyOn(store, "createIntent");
    const reply = await send("/aero index-rebalance --allocations NVDAc=100");
    expect(reply).toContain("No transaction plan was created");
    expect(reply).not.toContain("/confirm");
    expect(persist).not.toHaveBeenCalled();
    expect(prepared).toHaveLength(0);
    expect(approved).toHaveLength(0);
  });
  test("previews without sending, then executes the persisted plan only once", async () => {
    const { prepared, approved, verified, propose, send } = fixture();
    const code = await propose();
    expect(prepared).toHaveLength(0);
    expect(approved).toHaveLength(0);
    expect(await send(`/confirm ${code}`)).toContain("confirmed on Base mainnet");
    expect(await send(`/confirm ${code}`)).toContain("confirmed on Base mainnet");
    expect(prepared).toEqual([{ role: "action", from: wallet, to: pool, data: "0x12345678", value: "0" }]);
    expect(approved).toEqual(["tx-1"]);
    expect(verified).toHaveLength(1);
  });

  test("rejects a valid code from another sender or conversation", async () => {
    const { prepared, approved, propose, send } = fixture();
    const code = await propose();
    expect(await send(`/confirm ${code}`, "attacker")).toContain("not found");
    expect(await send(`/confirm ${code}`, "owner", "other-chat")).toContain("not found");
    expect(prepared).toHaveLength(0);
    expect(approved).toHaveLength(0);
  });

  test("expired proposals never reach Crossmint", async () => {
    const { prepared, approved, propose, send } = fixture({ quoteTtlSeconds: -1 });
    const code = await propose();
    expect(await send(`/confirm ${code}`)).toContain("expired");
    expect(prepared).toHaveLength(0);
    expect(approved).toHaveLength(0);
  });

  test("cancellation prevents later confirmation", async () => {
    const { prepared, approved, propose, send } = fixture();
    const code = await propose();
    expect(await send(`/cancel ${code}`)).toContain("cancelled");
    expect(await send(`/confirm ${code}`)).toContain("cancelled");
    expect(prepared).toHaveLength(0);
    expect(approved).toHaveLength(0);
  });

  test("the execution lock applies even to a valid confirmation code", async () => {
    const { prepared, approved, propose, send } = fixture({ enableMainnetExecution: false });
    const code = await propose();
    expect(await send(`/confirm ${code}`)).toContain("locked");
    expect(prepared).toHaveLength(0);
    expect(approved).toHaveLength(0);
  });

  test("a reverted user operation fails the intent instead of reporting success", async () => {
    const { store, propose, send } = fixture({ outcomes: [{ status: "reverted", hash: "0xdead", block: "1", gasUsed: "1" }] });
    const code = await propose();
    expect(await send(`/confirm ${code}`)).toContain("reverted");
    const intent = store.intentForCode(await sha256(code));
    expect(intent?.state).toBe("failed");
    expect(store.steps(intent?.id ?? "").map((step) => step.state)).toEqual(["failed"]);
  });

  test("a pending inclusion keeps the intent executing and re-checks without resubmitting", async () => {
    const { store, approved, verified, propose, send } = fixture({ outcomes: [{ status: "pending" }] });
    const code = await propose();
    expect(await send(`/confirm ${code}`)).toContain("not verified yet");
    const intent = store.intentForCode(await sha256(code));
    expect(intent?.state).toBe("executing");
    expect(store.steps(intent?.id ?? "").map((step) => step.state)).toEqual(["submitted"]);
    expect(await send(`/confirm ${code}`)).toContain("confirmed on Base mainnet");
    expect(approved).toEqual(["tx-1"]);
    expect(verified).toHaveLength(2);
    expect(store.intentForCode(await sha256(code))?.state).toBe("succeeded");
  });

  test("/send previews an EVM transfer and confirms it through the same gate", async () => {
    const { store, prepared, approved, propose, send } = fixture();
    const code = await propose(`/send 5 USDC to ${recipient}`);
    expect(prepared).toHaveLength(0);
    const intent = store.intentForCode(await sha256(code));
    expect(intent?.family).toBe("evm");
    expect(intent?.action).toBe("transfer");
    expect(await send(`/confirm ${code}`)).toContain("EVM transfer confirmed on Base mainnet");
    expect(prepared.map((call) => call.to)).toEqual([usdc]);
    expect(approved).toEqual(["tx-1"]);
  });

  test("an EVM plan with the wrong sender is rejected before it is persisted", async () => {
    const { store, send } = fixture({ evmResult: {
      kind: "transaction", action: "transfer", parameters: { to: recipient, amount: "1" }, summary: "Send 1 ETH", context: {},
      calls: [{ role: "action", from: recipient, to: wallet, data: "0x", value: "1" }],
    } });
    const persist = spyOn(store, "createIntent");
    expect(await send(`/send 1 ETH to ${recipient}`)).toContain("wrong sender");
    expect(persist).not.toHaveBeenCalled();
  });
});

async function sha256(value: string): Promise<string> {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

test("YOLO executes a persisted plan regardless of provider property order", async () => {
  const f = fixture({ aeroResult: { kind: "transaction", action: "stake", parameters: { chain: 8453, wallet, pool }, context: {}, calls: [{ from: wallet, to: pool, data: "0x12345678", value: "0", role: "action" }] } });
  await f.send("/yolo on");
  const result = await f.send(`/aero stake --pool ${pool}`);
  expect(result).toContain("confirmed on Base");
  expect(f.approved).toHaveLength(1);
});
