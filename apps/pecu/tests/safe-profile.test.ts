import { z } from "zod";
import { safeParameterSchemas, type SafeReadCommand } from "../src/safe";
import { validateEvmRequest, type EvmTxAction } from "../src/evm";
import type { JsonValue, JsonInput, JsonFields } from "../src/json-contract";
import { buildSignatureBytes, EthSafeSignature } from "@safe-global/protocol-kit";
import { Database, type SQLQueryBindings } from "bun:sqlite";
import { afterEach, expect, test } from "bun:test";
import { concatHex, decodeFunctionData, encodeFunctionData, encodeFunctionResult, erc20Abi, getAddress, keccak256, multicall3Abi, padHex, parseAbi, toBytes, zeroAddress } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { safeTransactionHash } from "../../../packages/evm/src/safe/transactions";
import { PecuAgent } from "../src/agent";
import type { PlannedCall } from "../src/domain";
import type { EvmPlanResult } from "../src/evm";
import type { JsonRpc } from "../src/receipt";
import { SafeChain } from "../src/safe-chain";
import { ProfileError, SafeProfile } from "../src/safe-profile";
import { profileActionSchema, profileOverviewSchema, profileSafeDetailSchema } from "../src/safe-profile-contract";
import { Store } from "../src/store";
import type { WebSql } from "../src/web";
import { services } from "./fixtures/agent-services";

const hex = z.templateLiteral(["0x", z.string().regex(/^[0-9a-fA-F]*$/)]);

const alice = { userId: "user_alice", senderId: "111" };
const bob = { userId: "user_bob", senderId: "web-user_bob" };
const aliceWallet = getAddress("0x1111111111111111111111111111111111111111");
const bobWallet = getAddress("0x2222222222222222222222222222222222222222");
const safe = getAddress("0x5afe000000000000000000000000000000000001");
const recipient = getAddress("0x3333333333333333333333333333333333333333");
const usdc = getAddress("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913");
const external = privateKeyToAccount(`0x${"42".repeat(32)}`);
const stranger = privateKeyToAccount(`0x${"43".repeat(32)}`);
const executionSuccess = keccak256(toBytes("ExecutionSuccess(bytes32,uint256)"));

const chainAbi = parseAbi([
  "function getOwners() view returns (address[])",
  "function getThreshold() view returns (uint256)",
  "function nonce() view returns (uint256)",
  "function getModulesPaginated(address start,uint256 pageSize) view returns (address[] array,address next)",
  "function approvedHashes(address owner,bytes32 hash) view returns (uint256)",
  "function getEthBalance(address addr) view returns (uint256)",
  "function balanceOf(address owner) view returns (uint256)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
]);

class FakeBase {
  owners: `0x${string}`[] = [aliceWallet, getAddress(external.address)];
  threshold = 2;
  nonce = 4n;
  approved = new Set<string>();
  receipts = new Map<string, JsonValue>();
  transactions = new Map<string, JsonValue>();
  logs: Array<{ transactionHash: string }> = [];
  logSearchFails = false;

  rpc: JsonRpc = async (method, params) => {
    if (method === "eth_blockNumber") return "0x64";
    if (method === "eth_getCode") return String(params[0]).toLowerCase() === safe.toLowerCase() ? "0x6080" : "0x";
    if (method === "eth_getTransactionReceipt") return this.receipts.get(String(params[0])) ?? null;
    if (method === "eth_getTransactionByHash") return this.transactions.get(String(params[0])) ?? null;
    if (method === "eth_getLogs") {
      if (this.logSearchFails) throw new Error("range too large");
      return this.logs;
    }
    if (method !== "eth_call") throw new Error(`unexpected ${method}`);
    const { data } = z.object({ data: hex }).parse(params[0]);
    const call = decodeFunctionData({ abi: multicall3Abi, data });
    if (call.functionName !== "aggregate3") throw new Error("expected aggregate3");
    return encodeFunctionResult({ abi: multicall3Abi, functionName: "aggregate3", result: call.args[0].map((inner) => this.answer(inner.target, inner.callData)) });
  };

  private answer(target: `0x${string}`, callData: `0x${string}`): { success: boolean; returnData: `0x${string}` } {
    const call = decodeFunctionData({ abi: chainAbi, data: callData });
    const ok = (returnData: `0x${string}`) => ({ success: true, returnData });
    switch (call.functionName) {
      case "getOwners": return ok(encodeFunctionResult({ abi: chainAbi, functionName: call.functionName, result: this.owners }));
      case "getThreshold": return ok(encodeFunctionResult({ abi: chainAbi, functionName: call.functionName, result: BigInt(this.threshold) }));
      case "nonce": return ok(encodeFunctionResult({ abi: chainAbi, functionName: call.functionName, result: this.nonce }));
      case "getModulesPaginated": return ok(encodeFunctionResult({ abi: chainAbi, functionName: call.functionName, result: [[], "0x0000000000000000000000000000000000000001"] }));
      case "approvedHashes": return ok(encodeFunctionResult({ abi: chainAbi, functionName: call.functionName, result: this.approved.has(`${String(call.args[0]).toLowerCase()}:${String(call.args[1]).toLowerCase()}`) ? 1n : 0n }));
      case "getEthBalance": return ok(encodeFunctionResult({ abi: chainAbi, functionName: call.functionName, result: 10n ** 16n }));
      case "balanceOf": return ok(encodeFunctionResult({ abi: chainAbi, functionName: call.functionName, result: target.toLowerCase() === usdc.toLowerCase() ? 25_500_000n : 0n }));
      case "symbol": return ok(encodeFunctionResult({ abi: chainAbi, functionName: call.functionName, result: target.toLowerCase() === usdc.toLowerCase() ? "USDC" : "AERO" }));
      case "decimals": return ok(encodeFunctionResult({ abi: chainAbi, functionName: call.functionName, result: target.toLowerCase() === usdc.toLowerCase() ? 6 : 18 }));
    }
  }
}

const open: Array<{ close(): void }> = [];
afterEach(() => {
  for (const h of open.splice(0)) h.close();
});

function harness() {
  const db = new Database(":memory:");
  const store = new Store(":memory:");
  const base = new FakeBase();
  const sql: WebSql = {
    exec: <Row extends Record<string, SqlStorageValue>>(query: string, ...params: SqlStorageValue[]) => {
      const rows = db.query<Row, SQLQueryBindings[]>(query).all(...params.map((p) => (p instanceof ArrayBuffer ? new Uint8Array(p) : p)));
      return { toArray: () => rows };
    },
  };
  const safeReads: Array<{ command: string; input: JsonFields }> = [];
  const proposals: Array<{ action: string; parameters: JsonInput }> = [];
  const propose = async (wallet: `0x${string}`, action: EvmTxAction, raw: JsonInput): Promise<EvmPlanResult> => {
    proposals.push({ action, parameters: raw });
    const parameters = validateEvmRequest(action, raw);
    let call: PlannedCall;
    if (action === "safe_execute_signatures") {
      const p = safeParameterSchemas.safe_execute_signatures.parse(parameters);
      const tx = p.transaction;
      const bytes = hex.parse(buildSignatureBytes(p.signatures.map((s) => new EthSafeSignature(s.owner, s.data, s.contract))));
      call = { from: wallet, to: tx.safe, value: "0", role: "action", data: encodeFunctionData({ abi: parseAbi(["function execTransaction(address to,uint256 value,bytes data,uint8 operation,uint256 safeTxGas,uint256 baseGas,uint256 gasPrice,address gasToken,address refundReceiver,bytes signatures) payable returns (bool)"]), functionName: "execTransaction", args: [tx.to, BigInt(tx.value), tx.data, 0, 0n, 0n, 0n, zeroAddress, zeroAddress, bytes] }) };
    } else if (action === "safe_approve") {
      const tx = safeParameterSchemas.safe_approve.parse(parameters).transaction;
      call = { from: wallet, to: tx.safe, value: "0", role: "action", data: encodeFunctionData({ abi: parseAbi(["function approveHash(bytes32 hash)"]), functionName: "approveHash", args: [hex.parse(tx.hash)] }) };
    } else if (action === "safe_create") {
      const p = safeParameterSchemas.safe_create.parse(parameters);
      const initializer = encodeFunctionData({ abi: parseAbi(["function setup(address[] owners,uint256 threshold,address to,bytes data,address fallbackHandler,address paymentToken,uint256 payment,address paymentReceiver)"]), functionName: "setup", args: [p.owners, BigInt(p.threshold), zeroAddress, "0x", zeroAddress, zeroAddress, 0n, zeroAddress] });
      call = { from: wallet, to: "0x4e1DCf7AD4e460CfD30791CCC4F9c8a4f820ec67", value: "0", role: "action", data: encodeFunctionData({ abi: parseAbi(["function createProxyWithNonce(address singleton,bytes initializer,uint256 saltNonce) returns (address)"]), functionName: "createProxyWithNonce", args: ["0x29fcB43b46531BcA003ddC8FCB67FFE91900C762", initializer, BigInt(p.saltNonce)] }) };
    } else throw new Error(`unexpected ${action}`);
    return { kind: "transaction", action, parameters, summary: `Prepared ${action}`, context: action === "safe_create" ? { safe: "0x5afe000000000000000000000000000000000002" } : { safe }, calls: [call] };
  };
  const agent = new PecuAgent(
    { enableMainnetExecution: false, maxSlippageBps: 100, quoteTtlSeconds: 600, depositRelayMaxUsd: 500, depositRelayDailyMaxUsd: 2000 },
    store,
    {
      getOrCreate: async () => { throw new Error("Must reuse existing wallet"); },
      balances: async () => "",
      usdcBalanceUnits: async () => 0n,
      prepareBatch: async () => { throw new Error("unexpected batch preparation"); }, prepare: async () => { throw new Error("No signing"); },
      approve: async () => { throw new Error("No signing"); },
      transaction: async () => { throw new Error("No signing"); },
    },
    services({ evm: { ...services({}).evm, propose } }),
    { respond: async () => "unused" },
  );
  const evm = {
    safeRead: async (command: SafeReadCommand, input: JsonFields) => {
      safeReads.push({ command, input });
      if (command === "safe-info") {
        if (input.safe !== safe) throw new Error("Unrecognized Safe contract code.");
        return { kind: "read" as const, command: "safe-info" as const, output: { safe } };
      }
      const nonce = base.nonce.toString();
      const tx = command === "safe-cancel-propose"
        ? { chainId: 8453 as const, safe, to: safe, value: "0", data: "0x" as const, nonce }
        : command === "safe-owner-propose"
          ? { chainId: 8453 as const, safe, to: safe, value: "0", data: encodeFunctionData({ abi: parseAbi(["function changeThreshold(uint256 threshold)"]), functionName: "changeThreshold", args: [1n] }), nonce }
          : { chainId: 8453 as const, safe, to: hex.parse(input.to), value: String(input.value), data: hex.parse(input.data), nonce };
      return { kind: "read" as const, command, output: { ...tx, hash: safeTransactionHash(tx) } };
    },
    describeSafeTransaction: async (tx: { data: string }) => tx.data === "0x" ? "cancel other transactions at the current wallet nonce" : "change the required approvals to 1",
  };
  store.saveWallet(alice.senderId, aliceWallet, aliceWallet);
  store.saveWallet(bob.senderId, bobWallet, bobWallet);
  const profile = new SafeProfile({ agent, store, evm, chain: new SafeChain(base.rpc), sql });
  return { profile, base, store, sql, safeReads, proposals, close: () => { db.close(); store.close(); } };
}
type Harness = ReturnType<typeof harness>;

function setup(): Harness {
  const h = harness();
  open.push(h);
  return h;
}

const act = (h: Harness, identity: typeof alice, raw: JsonInput) => h.profile.act(identity, profileActionSchema.parse(raw));

async function trackedSafe(h: Harness, identity = alice) {
  const { orgId } = await act(h, identity, { op: "org-create", name: "Treasury" });
  await act(h, identity, { op: "safe-add", orgId, safe, name: "Main" });
  return orgId!;
}

async function sendProposal(h: Harness, identity = alice) {
  const { proposal } = await act(h, identity, { op: "proposal-create", safe, action: { kind: "send", token: "USDC", to: recipient, amount: "10" } });
  return proposal!;
}

async function signAs(account: typeof external, hash: string) {
  return account.sign({ hash: hex.parse(hash) });
}

test("organizations, names and Safes belong to the signed-in sender and survive a restart", async () => {
  const h = setup();
  const orgId = await trackedSafe(h);
  await act(h, alice, { op: "contact-save", orgId, address: external.address, name: "Board" });
  const overview = profileOverviewSchema.parse(await h.profile.overview(alice));
  expect(overview.wallet).toBe(aliceWallet);
  expect(overview.balances?.map((balance) => `${balance.amount} ${balance.symbol}`)).toEqual(["0.01 ETH", "25.5 USDC", "0 AERO"]);
  expect(overview.orgs).toMatchObject([{ id: orgId, name: "Treasury", safes: [{ address: safe, name: "Main", status: "ready" }], contacts: [{ address: getAddress(external.address), name: "Board" }] }]);
  expect(h.safeReads[0]).toEqual({ command: "safe-info", input: { safe } });
  expect((await h.profile.overview(bob)).orgs).toEqual([]);
  await expect(h.profile.safe(bob, safe)).rejects.toThrow("Add this Safe");
  await expect(act(h, bob, { op: "org-rename", orgId, name: "Mine" })).rejects.toThrow(ProfileError);
  await expect(act(h, alice, { op: "safe-add", orgId, safe, name: "Again" })).rejects.toThrow("already in Treasury");
  await expect(act(h, alice, { op: "safe-add", orgId, safe: recipient, name: "Not a Safe" })).rejects.toThrow("isn't a supported Safe");
  const restarted = new SafeProfile({ agent: h.profile["deps"].agent, store: h.store, evm: h.profile["deps"].evm, chain: new SafeChain(h.base.rpc), sql: h.sql });
  expect((await restarted.overview(alice)).orgs[0]?.safes[0]?.name).toBe("Main");
  await act(h, alice, { op: "safe-remove", safe });
  await act(h, alice, { op: "org-delete", orgId });
  expect((await h.profile.overview(alice)).orgs).toEqual([]);
});

test("a send proposal is shared with every owner tracking the Safe, and only valid owner signatures count", async () => {
  const h = setup();
  await trackedSafe(h);
  await trackedSafe(h, bob);
  const hash = await sendProposal(h);
  expect(h.safeReads.at(-1)).toMatchObject({ command: "safe-propose", input: { safe, to: usdc, value: "0", data: encodeFunctionData({ abi: erc20Abi, functionName: "transfer", args: [recipient, 10_000_000n] }) } });
  const detail = profileSafeDetailSchema.parse(await h.profile.safe(alice, safe));
  expect(detail.queue).toMatchObject([{ hash, title: "Send 10 USDC", summary: `Send 10 USDC to ${recipient}`, kind: "send", proposer: "you", state: "queued", approvals: [] }]);
  expect(detail.balances.find((balance) => balance.symbol === "USDC")?.amount).toBe("25.5");
  expect((await h.profile.safe(bob, safe)).queue[0]).toMatchObject({ hash, proposer: "owner" });

  await expect(act(h, bob, { op: "proposal-sign", hash, owner: stranger.address, signature: await signAs(stranger, hash) })).rejects.toThrow("isn't an owner");
  await expect(act(h, bob, { op: "proposal-sign", hash, owner: external.address, signature: await signAs(stranger, hash) })).rejects.toThrow("doesn't match");
  const signature = await signAs(external, hash);
  const lowV = `${signature.slice(0, -2)}${(Number.parseInt(signature.slice(-2), 16) - 27).toString(16).padStart(2, "0")}`;
  await act(h, bob, { op: "proposal-sign", hash, owner: external.address, signature: lowV });
  h.base.approved.add(`${aliceWallet.toLowerCase()}:${hash}`);
  const signed = await h.profile.safe(alice, safe);
  expect(signed.queue[0]?.approvals).toEqual([{ owner: aliceWallet, via: "chain" }, { owner: getAddress(external.address), via: "signature" }]);
  expect(signed.queue[0]?.signatures).toEqual([{ owner: getAddress(external.address), data: signature }]);
  await expect(act(h, bob, { op: "proposal-delete", hash })).rejects.toThrow("Only the owner who proposed");
});

test("executing with the Pecu wallet counts its own approval, adds collected signatures and passes Pecu's plan checks", async () => {
  const h = setup();
  await trackedSafe(h);
  const hash = await sendProposal(h);
  await expect(act(h, alice, { op: "proposal-execute", requestId: crypto.randomUUID(), hash })).rejects.toThrow("needs 1 more approval");
  const signature = await signAs(external, hash);
  await act(h, alice, { op: "proposal-sign", hash, owner: external.address, signature });
  const requestId = crypto.randomUUID();
  const result = await act(h, alice, { op: "proposal-execute", requestId, hash });
  expect(result.intent).toMatchObject({ requestId, kind: "execute", preview: { title: "Execute Safe transaction", state: "pending" } });
  expect(result.intent?.preview.code).toMatch(/^[A-Z0-9]{6}$/);
  const sent = safeParameterSchemas.safe_execute_signatures.parse(h.proposals.at(-1)?.parameters);
  expect(sent.signatures).toEqual([
    { owner: aliceWallet, data: concatHex([padHex(aliceWallet, { size: 32 }), padHex("0x", { size: 32 }), "0x01"]), contract: false },
    { owner: getAddress(external.address), data: signature, contract: false },
  ]);
  expect((await act(h, alice, { op: "proposal-execute", requestId, hash })).intent?.preview.code).toBe(result.intent?.preview.code);
  expect(h.proposals).toHaveLength(1);
  expect((await h.profile.safe(alice, safe)).queue[0]?.intents).toHaveLength(1);

  const confirmed = await act(h, alice, { op: "intent-confirm", requestId: crypto.randomUUID(), code: result.intent!.preview.code });
  expect(confirmed.message).toContain("Mainnet execution is locked");
  await expect(act(h, bob, { op: "intent-confirm", requestId: crypto.randomUUID(), code: result.intent!.preview.code })).rejects.toThrow("no longer available");
  const cancelled = await act(h, alice, { op: "intent-cancel", requestId: crypto.randomUUID(), code: result.intent!.preview.code });
  expect(cancelled.intent?.preview.state).toBe("cancelled");
});

test("approving with the Pecu wallet and creating a Safe go through the same confirmation", async () => {
  const h = setup();
  const orgId = await trackedSafe(h);
  const hash = await sendProposal(h);
  const approval = await act(h, alice, { op: "proposal-approve", requestId: crypto.randomUUID(), hash });
  expect(approval.intent?.preview.title).toBe("Approve Safe transaction");
  const created = await act(h, alice, { op: "safe-create", requestId: crypto.randomUUID(), orgId, name: "Ops", owners: [aliceWallet, external.address], threshold: 2 });
  expect(created.safe).toBe(getAddress("0x5afe000000000000000000000000000000000002"));
  expect(h.proposals.at(-1)).toMatchObject({ action: "safe_create", parameters: { owners: [aliceWallet, getAddress(external.address)], threshold: 2 } });
  const overview = await h.profile.overview(alice);
  expect(overview.orgs[0]?.safes.map((row) => [row.name, row.status])).toEqual([["Main", "ready"], ["Ops", "creating"]]);
  const pending = await h.profile.safe(alice, created.safe!);
  expect(pending).toMatchObject({ status: "creating", owners: [aliceWallet, getAddress(external.address)], threshold: 2, creation: { kind: "create" } });
  await expect(act(h, alice, { op: "safe-remove", safe: created.safe! })).rejects.toThrow("still being created");
  await act(h, alice, { op: "intent-cancel", requestId: crypto.randomUUID(), code: pending.creation!.preview.code });
  expect((await h.profile.safe(alice, created.safe!)).status).toBe("not-created");
  await act(h, alice, { op: "safe-remove", safe: created.safe! });
  await expect(act(h, alice, { op: "safe-create", requestId: crypto.randomUUID(), orgId, name: "Bad", owners: [aliceWallet, aliceWallet], threshold: 1 })).rejects.toThrow("only once");
});

test("closed proposals settle from a verified receipt, a log search, or stay closed when the search fails", async () => {
  const h = setup();
  await trackedSafe(h);
  const executed = await sendProposal(h);
  const reject = (await act(h, alice, { op: "proposal-create", safe, action: { kind: "reject" } })).proposal!;
  const threshold = (await act(h, alice, { op: "proposal-create", safe, action: { kind: "threshold", threshold: 1 } })).proposal!;
  expect((await h.profile.safe(alice, safe)).queue.map((row) => row.title)).toEqual(["Send 10 USDC", "Reject pending transactions", "Change required approvals"]);
  const txHash = `0x${"ab".repeat(32)}`;
  const bogus = `0x${"ef".repeat(32)}`;
  h.base.transactions.set(bogus, { to: recipient, input: "0x6a761202" });
  await expect(act(h, alice, { op: "proposal-submitted", hash: executed, transaction: bogus })).rejects.toThrow("doesn't execute this Safe transaction");
  await act(h, alice, { op: "proposal-submitted", hash: reject, transaction: `0x${"12".repeat(32)}` });
  h.sql.exec("UPDATE basedbot_safe_proposals SET submitted_at=? WHERE hash=?", Date.now() - 11 * 60_000, reject);
  expect((await h.profile.safe(alice, safe)).queue.find((row) => row.hash === reject)?.state).toBe("queued");
  h.base.transactions.set(txHash, { to: safe, input: "0x6a761202" });
  await act(h, alice, { op: "proposal-submitted", hash: executed, transaction: txHash });
  expect((await h.profile.safe(alice, safe)).queue[0]?.state).toBe("submitted");
  h.base.receipts.set(txHash, { status: "0x1", logs: [{ address: safe, topics: [executionSuccess, executed], data: "0x" }] });
  h.base.nonce = 5n;
  h.base.logSearchFails = true;
  const settled = await h.profile.safe(alice, safe);
  expect(settled.queue).toEqual([]);
  expect(Object.fromEntries(settled.history.map((row) => [row.hash, [row.state, row.executedTransaction]]))).toEqual({
    [executed]: ["executed", txHash],
    [reject]: ["closed", null],
    [threshold]: ["closed", null],
  });
  h.base.logSearchFails = false;
  expect((await h.profile.safe(alice, safe)).history.find((row) => row.hash === reject)?.state).toBe("replaced");
});

test("chat reads the shared queue with a ready execution plan only when the sender's wallet completes the threshold", async () => {
  const h = setup();
  await trackedSafe(h);
  const hash = await sendProposal(h);
  const signature = await signAs(external, hash);
  await act(h, bob, { op: "org-create", name: "Mine" }).then(({ orgId }) => act(h, bob, { op: "safe-add", orgId, safe, name: "Shared" }));
  await act(h, bob, { op: "proposal-sign", hash, owner: external.address, signature });
  const forAlice = await h.profile.pending(alice.senderId, safe);
  expect(forAlice.pending).toHaveLength(1);
  expect(forAlice.pending[0]).toMatchObject({ title: "Send 10 USDC", signedOnWeb: [getAddress(external.address)], executeWith: { signatures: [{ owner: aliceWallet }, { owner: getAddress(external.address), data: signature }] } });
  const forBob = await h.profile.pending(bob.senderId, safe);
  expect(forBob.pending[0]).toMatchObject({ approvalsStillNeeded: 1 });
  expect(forBob.pending[0]).not.toHaveProperty("executeWith");
  await expect(h.profile.pending(alice.senderId, recipient)).rejects.toThrow("isn't deployed");
});

test("Safe proposals built in chat join the shared queue without duplicates", async () => {
  const h = setup();
  await trackedSafe(h);
  const output = (await h.profile["deps"].evm.safeRead("safe-cancel-propose", { safe })).output;
  await h.profile.shareProposal(bob.senderId, "safe-cancel-propose", output);
  await h.profile.shareProposal(bob.senderId, "safe-cancel-propose", output);
  await h.profile.shareProposal(bob.senderId, "safe-info", { safe });
  const queue = (await h.profile.safe(alice, safe)).queue;
  expect(queue).toMatchObject([{ title: "Reject pending transactions", kind: "reject", proposer: "other", summary: "Cancel other transactions at the current wallet nonce" }]);
});
