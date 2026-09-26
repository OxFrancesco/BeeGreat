import { mock } from "bun:test";
import { strict as assert } from "node:assert";
const address = "0x1111111111111111111111111111111111111111";
const submissions: unknown[] = [];
let approvals = 0;
let walletReads = 0;
let signerInitializations = 0;
let rejectNext = false;
const wallet = {
  address, chain: "base", useSigner: async () => { signerInitializations++; },
  signer: { locator: () => "server:fixture" },
  apiClient: { createTransaction: async (locator: string, request: Parameters<import("@crossmint/wallets-sdk").Wallet<"base">["apiClient"]["createTransaction"]>[1]) => { submissions.push({ locator, request }); return { id: "one-batch" }; } },
  approve: async () => { approvals++; return {}; },
};
mock.module("@crossmint/wallets-sdk", () => ({
  createCrossmint: () => ({}), CrossmintWallets: { from: () => ({ getWallet: async () => { walletReads++; if (rejectNext) { rejectNext = false; throw new Error("Retryable read"); } return wallet; } }) },
  EVMWallet: { from: () => { throw new Error("Batch must not use single-call sendTransaction"); } },
  WalletNotAvailableError: class extends Error {},
}));
const { WalletService } = await import("../../src/wallet");
const service = new WalletService({ crossmintApiKey: "fixture", crossmintWalletSecret: "fixture" }, {
  wallet: () => ({ address, locator: address }), saveWallet: () => {},
});
const calls = [{ role: "action", from: address, to: "0x2222222222222222222222222222222222222222", data: "0x12345678", value: "4" }, { role: "action", from: address, to: "0x3333333333333333333333333333333333333333", data: "0x87654321", value: "6" }] satisfies import("../../src/domain").PlannedCall[];
assert.deepEqual(await service.prepareBatch("owner", calls), { transactionId: "one-batch" });
assert.equal(approvals, 0);
assert.deepEqual(submissions, [{ locator: address, request: { params: { chain: "base", signer: "server:fixture", calls: calls.map(({ to, data, value }) => ({ to, data, value })) } } }]);
await assert.rejects(service.prepareBatch("owner", [{ ...calls[0], from: "0x4444444444444444444444444444444444444444" }]), /Invalid wallet batch/);
assert.equal(submissions.length, 1);
const { turnTrace } = await import("../../src/turn-trace");
const before = walletReads;
const signerBefore = signerInitializations;
const trace = { traceId: "turn-one", sessionId: "session", startedAt: Date.now() };
await turnTrace.run(trace, async () => {
  await Promise.all([service.getOrCreate("owner"), service.getOrCreate("owner")]);
  await service.getOrCreate("owner");
});
await turnTrace.run(trace, () => service.getOrCreate("owner"));
assert.equal(walletReads - before, 1);
assert.equal(signerInitializations - signerBefore, 1);
await turnTrace.run({ ...trace, traceId: "turn-two" }, () => service.getOrCreate("owner"));
assert.equal(walletReads - before, 2);
await turnTrace.run({ ...trace, traceId: "turn-three" }, async () => {
  rejectNext = true;
  await assert.rejects(service.getOrCreate("owner"), /Retryable read/);
  await service.getOrCreate("owner");
  await service.getOrCreate("other-sender");
});
assert.equal(walletReads - before, 5);
