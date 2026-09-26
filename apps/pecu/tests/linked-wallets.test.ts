import { Database, type SQLQueryBindings } from "bun:sqlite";
import { afterEach, expect, spyOn, test } from "bun:test";
import { getAddress } from "viem";
import { privateKeyToAccount, type PrivateKeyAccount } from "viem/accounts";
import { PecuAgent } from "../src/agent";
import type { AeroResult } from "../src/aerodrome";
import type { PlannedCall } from "../src/domain";
import type { EvmPlanResult } from "../src/evm";
import type { JsonValue } from "../src/json-contract";
import { LinkedExecution, linkedWalletRequest } from "../src/linked-execution";
import { linkedWalletLimit, linkedWalletResultSchema } from "../src/linked-wallet-contract";
import { LinkedWallets } from "../src/linked-wallets";
import { digest } from "../src/plan-digest";
import { verifyWalletTransaction, WalletTransactionMismatchError, type JsonRpc } from "../src/receipt";
import { Store } from "../src/store";
import { WebAgent, type WebSql } from "../src/web";
import { webConversation } from "../src/web-identity";
import { services, unusedEvm } from "./fixtures/agent-services";

const identity = { userId: "user_alice", senderId: "web-user_alice" };
const conversation = webConversation(identity);
const pecuWallet = getAddress("0x1111111111111111111111111111111111111111");
const pool = getAddress("0x2222222222222222222222222222222222222222");
const recipient = getAddress("0x3333333333333333333333333333333333333333");
const usdc = getAddress("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913");
const owner = privateKeyToAccount(`0x${"51".repeat(32)}`);
const stranger = privateKeyToAccount(`0x${"52".repeat(32)}`);
const canonicalBlock = `0x${"b".repeat(64)}`;
const addressWord = (address: string) => address.slice(2).toLowerCase().padStart(64, "0");
const amountWord = (amount: bigint) => amount.toString(16).padStart(64, "0");
const hash = (n: number) => `0x${n.toString(16).padStart(64, "0")}` as const;

class FakeBase {
  transactions = new Map<string, JsonValue>();
  receipts = new Map<string, JsonValue>();
  block = canonicalBlock;
  rpc: JsonRpc = async (method, params) => {
    const key = String(params[0]).toLowerCase();
    if (method === "eth_getTransactionByHash") return this.transactions.get(key) ?? null;
    if (method === "eth_getTransactionReceipt") return this.receipts.get(key) ?? null;
    if (method === "eth_getBlockByNumber") return { hash: this.block };
    throw new Error(`unexpected ${method}`);
  };
  broadcast(txHash: string, call: Pick<PlannedCall, "from" | "to" | "data" | "value">) {
    this.transactions.set(txHash.toLowerCase(), { from: call.from.toLowerCase(), to: call.to.toLowerCase(), input: call.data, value: `0x${BigInt(call.value).toString(16)}` });
  }
  mine(txHash: string, call: Pick<PlannedCall, "from" | "to" | "data" | "value">, status: "0x1" | "0x0" = "0x1") {
    this.broadcast(txHash, call);
    this.receipts.set(txHash.toLowerCase(), { transactionHash: txHash, blockNumber: "0x10", blockHash: canonicalBlock, status, gasUsed: "0x5208", logs: [] });
  }
}

const open: Array<{ close(): void }> = [];
afterEach(() => {
  for (const handle of open.splice(0)) handle.close();
});

function harness() {
  const db = new Database(":memory:");
  const store = new Store(":memory:");
  open.push(db, store);
  const sql: WebSql = {
    exec: <Row extends Record<string, SqlStorageValue>>(query: string, ...params: SqlStorageValue[]) => {
      const rows = db.query<Row, SQLQueryBindings[]>(query).all(...params.map((p) => (p instanceof ArrayBuffer ? new Uint8Array(p) : p)));
      return { toArray: () => rows };
    },
  };
  store.saveWallet(identity.senderId, pecuWallet, pecuWallet);
  const wallets = new LinkedWallets(sql);
  const base = new FakeBase();
  const prepared: PlannedCall[] = [];
  const balanceReads: string[] = [];
  const propose = async (wallet: `0x${string}`): Promise<EvmPlanResult> => ({
    kind: "transaction", action: "transfer", parameters: { to: recipient, amount: "5", token: "USDC" }, summary: "Send 5 USDC", context: {},
    calls: [{ role: "action", from: wallet, to: usdc, data: `0xa9059cbb${addressWord(recipient)}${amountWord(5_000_000n)}`, value: "0" }],
  });
  const stake = (wallet: `0x${string}`): AeroResult => ({
    kind: "transaction", action: "stake", parameters: { chain: 8453, wallet, pool }, context: {},
    calls: [
      { role: "approval", from: wallet, to: usdc, data: `0x095ea7b3${addressWord(pool)}${amountWord(1n)}`, value: "0" },
      { role: "action", from: wallet, to: pool, data: "0x12345678", value: "0" },
    ],
  });
  const agent = new PecuAgent(
    { enableMainnetExecution: true, maxSlippageBps: 100, quoteTtlSeconds: 600, depositRelayMaxUsd: 500, depositRelayDailyMaxUsd: 2000 },
    store,
    {
      getOrCreate: async () => ({ address: pecuWallet }),
      balances: async () => "Address: pecu\nETH: 9\nUSDC: 9\nAERO: 9",
      usdcBalanceUnits: async () => 0n,
      prepareBatch: async () => { throw new Error("unexpected batch preparation"); }, prepare: async (_sender, call) => { prepared.push(call); throw new Error("Pecu must not sign in this test"); },
      approve: async () => { throw new Error("Pecu must not sign in this test"); },
      transaction: async () => { throw new Error("Pecu must not sign in this test"); },
    },
    services({
      evm: {
        ...unusedEvm,
        propose,
        tokenBalance: async (wallet, token) => {
          balanceReads.push(wallet);
          return { kind: "read", command: "token", output: { token, address: wallet, amount: "1.5" } };
        },
      },
      aerodrome: { run: async (wallet) => stake(wallet), liquidity: async () => { throw new Error("unexpected liquidity plan"); }, basket: async () => { throw new Error("unexpected basket"); } },
      linkedWallets: wallets,
    }),
    { respond: async () => { throw new Error("unexpected model call"); } },
  );
  const execution = new LinkedExecution({ store, wallets, rpc: base.rpc, enabled: true });
  const web = new WebAgent(agent, store, sql, wallets);
  const link = async (account: PrivateKeyAccount = owner, senderId = identity.senderId) => {
    const { challenge, message } = wallets.challenge(senderId, account.address, "https://pecu.app");
    return wallets.link(senderId, challenge, await account.signMessage({ message }));
  };
  const send = async (text: string, conversationId = conversation) => {
    const eventId = crypto.randomUUID();
    const reply = await agent.handle({ senderId: identity.senderId, conversationId, eventId, text, encodedEvent: "" });
    return { reply: reply ?? "", eventId, code: reply?.match(/\/cancel ([A-Z0-9]{6})/)?.[1] ?? "" };
  };
  const intent = async (code: string, conversationId = conversation) => store.intentForCode(await digest(code), identity.senderId, conversationId);
  return { store, wallets, base, prepared, balanceReads, agent, execution, web, link, send, intent };
}

test("a wallet links only with its own fresh Sign-In with Ethereum signature, once", async () => {
  const { wallets, link } = harness();
  const { challenge, message, expiresAt } = wallets.challenge(identity.senderId, owner.address.toLowerCase(), "https://pecu.app");
  expect(message).toStartWith("pecu.app wants you to sign in with your Ethereum account:\n" + owner.address);
  expect(message).toContain("Link this wallet to your Pecu account. Signing is free and does not send a transaction.");
  expect(message).toContain("URI: https://pecu.app");
  expect(message).toContain("Chain ID: 8453");
  expect(message).toContain(`Nonce: ${challenge}`);
  expect(expiresAt - Date.now()).toBeLessThanOrEqual(5 * 60_000);
  await expect(wallets.link("web-user_mallory", challenge, await owner.signMessage({ message }))).rejects.toThrow("no longer available");
  await expect(wallets.link(identity.senderId, challenge, await stranger.signMessage({ message }))).rejects.toThrow("doesn't come from this wallet");
  await expect(wallets.link(identity.senderId, challenge, await owner.signMessage({ message }))).rejects.toThrow("no longer available");
  expect(wallets.list(identity.senderId)).toEqual([]);

  const linked = await link();
  expect(linked).toEqual([{ address: owner.address, name: null, linkedAt: expect.any(Number) }]);
  expect(() => wallets.challenge(identity.senderId, owner.address, "https://pecu.app")).toThrow("already linked");
  expect(wallets.list("web-user_bob")).toEqual([]);

  const late = wallets.challenge(identity.senderId, stranger.address, "https://pecu.app");
  const clock = spyOn(Date, "now").mockReturnValue(Date.now() + 5 * 60_000 + 1);
  try {
    await expect(wallets.link(identity.senderId, late.challenge, await stranger.signMessage({ message: late.message }))).rejects.toThrow("expired");
  } finally { clock.mockRestore(); }
});

test("names, thread choices and unlinking stay scoped to the account and have a way back", async () => {
  const { wallets, link } = harness();
  await link();
  expect(() => wallets.use(identity.senderId, conversation, stranger.address)).toThrow("isn't linked");
  wallets.use(identity.senderId, conversation, owner.address);
  expect(wallets.signer(identity.senderId, conversation)).toBe(owner.address);
  expect(wallets.signer(identity.senderId, `${conversation}#other`)).toBeUndefined();
  expect(wallets.rename(identity.senderId, owner.address, "Rabby")[0]?.name).toBe("Rabby");
  wallets.use(identity.senderId, conversation, null);
  expect(wallets.signer(identity.senderId, conversation)).toBeUndefined();
  wallets.use(identity.senderId, conversation, owner.address);
  expect(wallets.unlink(identity.senderId, owner.address)).toEqual([]);
  expect(wallets.signer(identity.senderId, conversation)).toBeUndefined();
  for (let index = 0; index < linkedWalletLimit; index += 1) await link(privateKeyToAccount(`0x${(index + 1).toString(16).padStart(64, "a")}`));
  expect(() => wallets.challenge(identity.senderId, owner.address, "https://pecu.app")).toThrow(`up to ${linkedWalletLimit}`);
});

test("a web thread using a linked wallet reads and plans for that wallet and never lets Pecu sign", async () => {
  const f = harness();
  await f.link();
  f.wallets.use(identity.senderId, conversation, owner.address);

  expect((await f.send("/balance")).reply).toBe("ETH: 1.5\nUSDC: 1.5\nAERO: 1.5");
  expect(f.balanceReads).toEqual([owner.address, owner.address, owner.address]);
  expect((await f.send("/wallet")).reply).toBe(`This thread uses your linked wallet:\n${owner.address}`);

  const transfer = await f.send(`/send 5 USDC to ${recipient}`);
  expect(transfer.reply).toContain(`Wallet: ${owner.address}`);
  expect(transfer.reply).toContain("Confirm in this preview to sign with your wallet.");
  expect(transfer.reply).not.toContain("/confirm");
  const saved = await f.intent(transfer.code);
  expect(saved?.signer).toBe(owner.address);
  expect(f.store.steps(saved!.id).map((step) => step.call.from)).toEqual([owner.address]);

  expect((await f.send(`/confirm ${transfer.code}`)).reply).toContain("signs with your wallet");
  expect((await f.intent(transfer.code))?.state).toBe("pending");
  await f.send("/yolo on");
  const yolo = await f.send(`/send 5 USDC to ${recipient}`);
  expect(yolo.reply).toContain("YOLO doesn't apply to your own wallet");
  expect((await f.intent(yolo.code))?.state).toBe("pending");
  expect(f.prepared).toEqual([]);

  const x = await f.send(`/send 5 USDC to ${recipient}`, "x-chat");
  expect((await f.intent(x.code, "x-chat"))?.signer).toBeUndefined();
  expect(x.reply).toContain(`/confirm ${x.code}`);
  expect((await f.send("/wallet", "profile:user_alice:web-user_alice")).reply).toBe(`Your Base wallet:\n${pecuWallet}`);
});

test("the browser wallet sends each exact step in order and Base settles it", async () => {
  const f = harness();
  await f.link();
  f.wallets.use(identity.senderId, conversation, owner.address);
  const { code } = await f.send(`/aero stake --pool ${pool}`);
  const [approval, action] = f.store.steps((await f.intent(code))!.id).map((step) => step.call);

  const first = await f.execution.step(identity.senderId, conversation, code);
  expect(first).toEqual({ kind: "send", position: 0, total: 2, chainId: 8453, transaction: { from: owner.address, to: approval!.to, data: approval!.data, value: "0" } });
  expect((await f.intent(code))?.state).toBe("executing");
  expect(await f.execution.step(identity.senderId, conversation, code)).toEqual({ kind: "unreported", position: 0 });
  expect((await f.execution.step(identity.senderId, conversation, code, true)).kind).toBe("send");
  await expect(f.execution.submitted(identity.senderId, conversation, code, 1, hash(1))).rejects.toThrow("order");
  await expect(f.execution.step(identity.senderId, "stocks:user_alice:web-user_alice#other", code)).rejects.toThrow("isn't available");

  expect(await f.execution.submitted(identity.senderId, conversation, code, 0, hash(1))).toEqual({ kind: "waiting", position: 0, hash: hash(1) });
  expect(await f.execution.submitted(identity.senderId, conversation, code, 0, hash(1))).toEqual({ kind: "waiting", position: 0, hash: hash(1) });
  expect(await f.execution.step(identity.senderId, conversation, code)).toEqual({ kind: "waiting", position: 0, hash: hash(1) });
  f.base.mine(hash(1), approval!);
  const second = await f.execution.step(identity.senderId, conversation, code);
  expect(second).toMatchObject({ kind: "send", position: 1, transaction: { to: action!.to, data: action!.data } });

  f.base.broadcast(hash(2), { ...action!, data: "0x87654321" });
  await expect(f.execution.submitted(identity.senderId, conversation, code, 1, hash(2))).rejects.toThrow("doesn't match this preview");
  await f.execution.submitted(identity.senderId, conversation, code, 1, hash(3));
  f.base.mine(hash(3), action!);
  const done = await f.execution.step(identity.senderId, conversation, code);
  expect(done).toMatchObject({ kind: "status", state: "succeeded" });
  const settled = await f.intent(code);
  expect(settled?.state).toBe("succeeded");
  expect(settled?.result).toContain(`https://basescan.org/tx/${hash(1)}`);
  expect(settled?.result).toContain(`https://basescan.org/tx/${hash(3)}`);
  expect(f.store.steps(settled!.id).map((step) => [step.state, step.hash])).toEqual([["succeeded", hash(1)], ["succeeded", hash(3)]]);
  expect(f.prepared).toEqual([]);
});

test("declines, reverts, mismatches and expiry close a linked preview honestly", async () => {
  const f = harness();
  await f.link();
  f.wallets.use(identity.senderId, conversation, owner.address);

  const declined = await f.send(`/send 5 USDC to ${recipient}`);
  await f.execution.step(identity.senderId, conversation, declined.code);
  expect(await f.execution.declined(identity.senderId, conversation, declined.code, 0)).toEqual({ kind: "status", state: "pending", message: "You declined in your wallet. Nothing was sent." });
  expect((await f.intent(declined.code))?.state).toBe("pending");
  const retry = await f.execution.step(identity.senderId, conversation, declined.code);
  expect(retry.kind).toBe("send");
  if (retry.kind !== "send") throw new Error("expected a transaction to send");
  await f.execution.submitted(identity.senderId, conversation, declined.code, 0, hash(10));
  await expect(f.execution.declined(identity.senderId, conversation, declined.code, 0)).rejects.toThrow("already sent");
  f.base.mine(hash(10), retry.transaction, "0x0");
  expect(await f.execution.step(identity.senderId, conversation, declined.code)).toMatchObject({ kind: "status", state: "failed", message: expect.stringContaining("reverted on Base") });

  const swapped = await f.send(`/send 5 USDC to ${recipient}`);
  await f.execution.step(identity.senderId, conversation, swapped.code);
  await f.execution.submitted(identity.senderId, conversation, swapped.code, 0, hash(11));
  f.base.mine(hash(11), { from: owner.address, to: usdc, data: `0xa9059cbb${addressWord(stranger.address)}${amountWord(5_000_000n)}`, value: "0" });
  expect(await f.execution.step(identity.senderId, conversation, swapped.code)).toMatchObject({ kind: "status", state: "failed", message: "The transaction your wallet reported doesn't match this preview." });

  const stale = await f.send(`/send 5 USDC to ${recipient}`);
  const staged = await f.send(`/aero stake --pool ${pool}`);
  const approval = await f.execution.step(identity.senderId, conversation, staged.code);
  if (approval.kind !== "send") throw new Error("expected the approval");
  await f.execution.submitted(identity.senderId, conversation, staged.code, 0, hash(12));
  f.base.mine(hash(12), approval.transaction);
  const clock = spyOn(Date, "now").mockReturnValue(Date.now() + 11 * 60_000);
  try {
    expect(await f.execution.step(identity.senderId, conversation, stale.code)).toMatchObject({ kind: "status", state: "expired" });
    expect(await f.execution.step(identity.senderId, conversation, staged.code)).toMatchObject({ kind: "status", state: "failed", message: expect.stringContaining("expired before transaction 2") });
  } finally { clock.mockRestore(); }
  expect(f.prepared).toEqual([]);
});

test("a linked plan in flight blocks unlinking and restart recovery leaves it to the wallet", async () => {
  const f = harness();
  await f.link();
  f.wallets.use(identity.senderId, conversation, owner.address);
  const { code } = await f.send(`/send 5 USDC to ${recipient}`);
  await f.execution.step(identity.senderId, conversation, code);
  const request = { identity, origin: "https://pecu.app", action: { op: "unlink" as const, address: owner.address } };
  await expect(linkedWalletRequest({ wallets: f.wallets, execution: f.execution }, request)).rejects.toThrow("still in progress");
  await f.agent.resumeExecuting();
  expect((await f.intent(code))?.state).toBe("executing");
  expect(f.prepared).toEqual([]);
  await f.execution.declined(identity.senderId, conversation, code, 0);
  const result = linkedWalletResultSchema.parse(await linkedWalletRequest({ wallets: f.wallets, execution: f.execution }, request));
  expect(result).toEqual({ kind: "wallets", wallets: [] });
  await expect(f.execution.step(identity.senderId, conversation, code)).rejects.toThrow("Link this wallet again");
});

test("web state shows the thread's wallet and which wallet signs each preview", async () => {
  const f = harness();
  await f.link();
  const choose = await linkedWalletRequest({ wallets: f.wallets, execution: f.execution }, { identity, origin: "https://pecu.app", action: { op: "use", threadId: null, address: owner.address } });
  expect(choose.kind).toBe("wallets");
  await f.web.handle({ ...identity, requestId: crypto.randomUUID(), text: `/send 5 USDC to ${recipient}` });
  const state = f.web.state(identity);
  expect(state.signer).toBe(owner.address);
  expect(state.messages.at(-1)?.reply?.preview).toMatchObject({ signer: owner.address, state: "pending" });
  expect(f.web.state({ ...identity, threadId: "fresh" }).signer).toBeNull();
});

test("wallet transaction verification needs the exact call and a canonical receipt", async () => {
  const base = new FakeBase();
  const call: Pick<PlannedCall, "from" | "to" | "data" | "value"> = { from: owner.address, to: usdc, data: "0x12345678", value: "7" };
  expect(await verifyWalletTransaction(base.rpc, hash(20), call)).toEqual({ status: "pending" });
  base.mine(hash(20), call);
  expect(await verifyWalletTransaction(base.rpc, hash(20), call)).toEqual({ status: "confirmed", hash: hash(20), block: "16" });
  base.block = `0x${"c".repeat(64)}`;
  expect(await verifyWalletTransaction(base.rpc, hash(20), call)).toEqual({ status: "pending" });
  await expect(verifyWalletTransaction(base.rpc, hash(20), { ...call, value: "8" })).rejects.toBeInstanceOf(WalletTransactionMismatchError);
});

test("the background sweep settles sent steps from Base and closes linked plans left past expiry", async () => {
  const f = harness();
  await f.link();
  f.wallets.use(identity.senderId, conversation, owner.address);
  const sent = await f.send(`/send 5 USDC to ${recipient}`);
  const transfer = await f.execution.step(identity.senderId, conversation, sent.code);
  if (transfer.kind !== "send") throw new Error("expected the transfer");
  await f.execution.submitted(identity.senderId, conversation, sent.code, 0, hash(30));
  const left = await f.send(`/aero stake --pool ${pool}`);
  const approval = await f.execution.step(identity.senderId, conversation, left.code);
  if (approval.kind !== "send") throw new Error("expected the approval");
  await f.execution.submitted(identity.senderId, conversation, left.code, 0, hash(31));
  f.base.mine(hash(31), approval.transaction);
  await f.execution.step(identity.senderId, conversation, left.code);
  await f.execution.declined(identity.senderId, conversation, left.code, 1);

  await f.execution.sweep();
  expect((await f.intent(sent.code))?.state).toBe("executing");
  expect((await f.intent(left.code))?.state).toBe("executing");
  f.base.mine(hash(30), transfer.transaction);
  const clock = spyOn(Date, "now").mockReturnValue(Date.now() + 11 * 60_000);
  try {
    await f.execution.sweep();
  } finally { clock.mockRestore(); }
  expect((await f.intent(sent.code))?.state).toBe("succeeded");
  expect((await f.intent(left.code))).toMatchObject({ state: "failed", result: expect.stringContaining("expired before transaction 2") });
  const request = { identity, origin: "https://pecu.app", action: { op: "unlink" as const, address: owner.address } };
  expect((await linkedWalletRequest({ wallets: f.wallets, execution: f.execution }, request)).kind).toBe("wallets");
});
