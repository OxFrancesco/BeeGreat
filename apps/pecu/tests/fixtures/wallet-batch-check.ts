import { mock } from "bun:test";
import { strict as assert } from "node:assert";
const address = "0x1111111111111111111111111111111111111111";
const submissions: unknown[] = [];
let approvals = 0;
const wallet = {
  address, chain: "base", useSigner: async () => {},
  signer: { locator: () => "server:fixture" },
  apiClient: { createTransaction: async (locator: string, request: Parameters<import("@crossmint/wallets-sdk").Wallet<"base">["apiClient"]["createTransaction"]>[1]) => { submissions.push({ locator, request }); return { id: "one-batch" }; } },
  approve: async () => { approvals++; return {}; },
};
mock.module("@crossmint/wallets-sdk", () => ({
  createCrossmint: () => ({}), CrossmintWallets: { from: () => ({ getWallet: async () => wallet }) },
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
