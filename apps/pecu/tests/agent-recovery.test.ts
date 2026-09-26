import { afterEach, describe, expect, spyOn, test } from "bun:test";
import { PecuAgent } from "../src/agent";
import { AerodromeService } from "../src/aerodrome";
import { Store } from "../src/store";
import type { WalletService } from "../src/wallet";
import type { PlannedCall } from "../src/domain";
import { services } from "./fixtures/agent-services";

const call: PlannedCall = {
  role: "action", from: "0x1111111111111111111111111111111111111111",
  to: "0x2222222222222222222222222222222222222222", data: "0x12345678", value: "0",
};
const stores: Store[] = [];
afterEach(() => { for (const store of stores.splice(0)) store.close(); });

function fixture(enabled: boolean, expiresAt = Date.now() + 60_000) {
  const store = new Store(":memory:");
  stores.push(store);
  store.createIntent({
    id: "recovery", codeHash: "code", senderId: "sender", conversationId: "chat", sourceEventId: "event",
    state: "pending", family: "aero", action: "stake", parameters: { chain: 8453, wallet: call.from, pool: call.to }, preview: "preview", planDigest: "tampered", expiresAt,
  }, [call]);
  store.transitionIntent("recovery", "pending", "executing");
  const wallets = {
    getOrCreate: async () => { throw new Error("unexpected wallet lookup"); },
    balances: async () => "unused",
    prepareBatch: async () => { throw new Error("unexpected batch preparation"); }, prepare: async () => { throw new Error("unexpected preparation"); },
    approve: async () => { throw new Error("unexpected approval"); },
    transaction: async () => { throw new Error("unexpected transaction lookup"); },
    usdcBalanceUnits: async () => 0n,
  } satisfies Pick<WalletService, "getOrCreate" | "balances" | "prepareBatch" | "prepare" | "approve" | "transaction" | "usdcBalanceUnits">;
  const prepare = spyOn(wallets, "prepare").mockImplementation(async () => { throw new Error("must not prepare"); });
  const approve = spyOn(wallets, "approve").mockImplementation(async () => { throw new Error("must not approve"); });
  const lookup = spyOn(wallets, "getOrCreate").mockImplementation(async () => { throw new Error("must not look up wallet"); });
  const agent = new PecuAgent(
    { enableMainnetExecution: enabled, maxSlippageBps: 100, quoteTtlSeconds: 120, depositRelayMaxUsd: 500, depositRelayDailyMaxUsd: 2000 }, store, wallets,
    services({ aerodrome: new AerodromeService({ baseRpcUrl: "https://mainnet.base.org", maxSlippageBps: 100 }) }),
    { respond: async () => "unused" },
  );
  return { store, prepare, approve, lookup, agent };
}

describe("interrupted transaction recovery", () => {
  test("keeps interrupted plans untouched while mainnet execution is locked", async () => {
    const { store, prepare, approve, lookup, agent } = fixture(false);
    await agent.resumeExecuting();
    expect(store.intentForCode("code", "sender", "chat")?.state).toBe("executing");
    expect(prepare).not.toHaveBeenCalled();
    expect(approve).not.toHaveBeenCalled();
    expect(lookup).not.toHaveBeenCalled();
  });
  test("does not revive an expired confirmation after a restart", async () => {
    const { store, prepare, approve, lookup, agent } = fixture(true, Date.now() - 1_000);
    await agent.resumeExecuting();
    expect(store.intentForCode("code", "sender", "chat")?.state).toBe("failed");
    expect(store.intentForCode("code", "sender", "chat")?.result).toContain("expired");
    expect(prepare).not.toHaveBeenCalled();
    expect(approve).not.toHaveBeenCalled();
    expect(lookup).not.toHaveBeenCalled();
  });

  test("rejects altered persisted plans before reaching Crossmint", async () => {
    const { store, prepare, approve, lookup, agent } = fixture(true);
    await agent.resumeExecuting();
    expect(store.intentForCode("code", "sender", "chat")?.state).toBe("failed");
    expect(store.intentForCode("code", "sender", "chat")?.result).toContain("digest mismatch");
    expect(prepare).not.toHaveBeenCalled();
    expect(approve).not.toHaveBeenCalled();
    expect(lookup).not.toHaveBeenCalled();
  });
});
