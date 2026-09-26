import { Database, type SQLQueryBindings } from "bun:sqlite";
import { afterEach, expect, test } from "bun:test";
import { getAddress } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { PecuAgent } from "../src/agent";
import { LinkedWalletError, LinkedWallets } from "../src/linked-wallets";
import { Store } from "../src/store";
import { WebAgent, type WebSql } from "../src/web";
import { services, unusedEvm } from "./fixtures/agent-services";

const identity = { userId: "user_alice", senderId: "web-user_alice" };
const pecuWallet = getAddress("0x1111111111111111111111111111111111111111");
const owner = privateKeyToAccount(`0x${"61".repeat(32)}`);
const stranger = getAddress("0x9999999999999999999999999999999999999999");
const open: Array<{ close(): void }> = [];
afterEach(() => {
  for (const handle of open.splice(0)) handle.close();
});

async function harness() {
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
  const linked = new LinkedWallets(sql);
  const { challenge, message } = linked.challenge(identity.senderId, owner.address, "https://pecu.app");
  await linked.link(identity.senderId, challenge, await owner.signMessage({ message }));
  const reads: string[] = [];
  const unused = async (): Promise<never> => { throw new Error("Pecu must not sign in this test"); };
  const wallets = { getOrCreate: async () => ({ address: pecuWallet }), balances: async () => "", usdcBalanceUnits: async () => 0n, prepare: unused, prepareBatch: unused, approve: unused, transaction: unused };
  const agent = new PecuAgent(
    { enableMainnetExecution: false, maxSlippageBps: 100, quoteTtlSeconds: 600, depositRelayMaxUsd: 500, depositRelayDailyMaxUsd: 2000 },
    store,
    wallets,
    services({
      evm: { ...unusedEvm, tokenBalance: async (wallet, token) => { reads.push(wallet); return { kind: "read", command: "token", output: { token, address: wallet, amount: "2" } }; } },
      linkedWallets: linked,
    }),
    { respond: async () => { throw new Error("unexpected model call"); } },
  );
  return { web: new WebAgent(agent, store, sql, linked), reads };
}

test("balances and P&L read the Pecu wallet or a linked wallet, and nothing else", async () => {
  const { web, reads } = await harness();
  expect((await web.portfolio(identity, { tokens: ["ETH"], stocks: false })).wallet).toBe(pecuWallet);
  expect((await web.portfolio(identity, { tokens: ["ETH"], stocks: false, wallet: `0x${owner.address.slice(2).toLowerCase()}` })).wallet).toBe(owner.address);
  expect(reads).toEqual([pecuWallet, owner.address]);
  await expect(web.portfolio(identity, { tokens: ["ETH"], stocks: false, wallet: stranger })).rejects.toBeInstanceOf(LinkedWalletError);
  await expect(web.portfolio({ userId: "user_bob", senderId: "web-user_bob" }, { tokens: ["ETH"], stocks: false, wallet: owner.address })).rejects.toThrow("isn't linked");
  await expect(web.pnl(identity, 30, stranger)).rejects.toBeInstanceOf(LinkedWalletError);
  await expect(web.pnl(identity, 30, owner.address)).rejects.toThrow("Nansen analytics is not configured");
  expect(reads).toHaveLength(2);
});
