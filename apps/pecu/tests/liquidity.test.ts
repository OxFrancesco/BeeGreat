import { afterEach, expect, test } from "bun:test";
import { ADDRESS_ZERO, KNOWN_TOKENS, createPoolSpec, getChainSettings, priceToTick, type Token, type LiquidityPool, type SugarJson, validateSugarRequest, type DepositQuote, type SugarParameters } from "@beegreat/sugar";
import { liquidityPlan } from "../src/liquidity";
import { liquidityRequestSchema } from "../src/liquidity-contract";
import { validateIntentPlan } from "../src/policy";
import { PecuAgent } from "../src/agent";
import { Store } from "../src/store";
import { digest } from "../src/plan-digest";
import { awaitingApproval, submittedTransaction, services, unusedWalletActions } from "./fixtures/agent-services";
import type { PlannedCall, VerifiedMessage } from "../src/domain";
import type { UserOperationOutcome } from "../src/receipt";

const wallet = "0x1111111111111111111111111111111111111111";
const target = "0x2222222222222222222222222222222222222222";
const { eth, usdc } = KNOWN_TOKENS[8453];
const weth: Token = { ...eth, symbol: "WETH", tokenAddress: "0x4200000000000000000000000000000000000006", wrappedTokenAddress: undefined };
const request = liquidityRequestSchema.parse({ selection: { kind: "pool", pool: target }, funding_token: "ETH", budget: { kind: "fraction", bps: 5000 } });
const stores: Store[] = [];
afterEach(() => { for (const store of stores.splice(0)) store.close(); });

function planner(options: { balance?: bigint; reverse?: boolean; empty?: boolean } = {}) {
  const token0 = options.reverse ? usdc : weth;
  const token1 = options.reverse ? weth : usdc;
  const spec = createPoolSpec(getChainSettings(8453), weth, usdc, { tickSpacing: 100 });
  const pool: LiquidityPool = { ...spec, token0, token1, lp: target, tick: priceToTick(options.reverse ? 1 / 2000 : 2000, token0.decimals, token1.decimals), sqrtRatio: options.empty ? 0n : 1n };
  const swaps: SugarParameters[] = [];
  const deposits: DepositQuote[] = [];
  const call = (value: bigint): PlannedCall => ({ role: "action", from: wallet, to: target, data: "0x12345678", value: String(value) });
  const client: Parameters<typeof liquidityPlan>[0] = {
    getToken: async ref => [eth, weth, usdc].find(t => t.symbol === ref || t.tokenAddress === ref),
    getTokenBalance: async () => options.balance ?? 1_000_000_000_000_000n,
    getPoolByAddress: async () => pool,
    poolSpec: async () => ({ ...pool, lp: ADDRESS_ZERO, sqrtRatio: 0n }),
    quoteConcentratedDeposit: async (selected, input) => {
      const eth0 = selected.token0.symbol !== "USDC";
      const ethAmount = eth0 ? input.amountToken0 : input.amountToken1;
      const usdAmount = eth0 ? input.amountToken1 : input.amountToken0;
      const native = ethAmount ?? (usdAmount ?? 0n) * 500_000_000n;
      const usd = usdAmount ?? native / 500_000_000n;
      return { pool: selected, amountToken0: eth0 ? native : usd, amountToken1: eth0 ? usd : native, tickLower: pool.tick - 2000, tickUpper: pool.tick + 2000, sqrtPriceX96: 0n };
    },
    deposit: async quote => { deposits.push(quote); return [{ ...call(options.reverse ? quote.amountToken1 : quote.amountToken0), value: options.reverse ? quote.amountToken1 : quote.amountToken0 }]; },
  };
  const run: Parameters<typeof liquidityPlan>[1] = async (action, parameters): Promise<SugarJson> => {
    validateSugarRequest(action, parameters);
    const input = BigInt(Math.round(Number(parameters.amount) * 1e18));
    const output = input / 500_000_000n;
    if (action === "quote") return { amount_out: String(output) };
    swaps.push(parameters);
    return { quote: { min_amount_out: String(output * 995n / 1000n) }, transaction_steps: [{ role: "action", transaction: call(input) }] };
  };
  return { client, run, swaps, deposits };
}

test.each([false, true])("half ETH funds both sides within one total budget, reverse order %s", async reverse => {
  const fixture = planner({ reverse });
  const result = await liquidityPlan(fixture.client, fixture.run, wallet, request);
  expect(result.calls).toHaveLength(2);
  expect(result.calls.reduce((sum, call) => sum + BigInt(call.value), 0n)).toBeLessThanOrEqual(500_000_000_000_000n);
  expect(result.preview).toContain("budget of 0.0005 ETH");
  expect(fixture.deposits[0]?.pool[reverse ? "token1" : "token0"].symbol).toBe("ETH");
  validateIntentPlan({ family: "liquidity", action: "liquidity_budget", parameters: result.parameters }, wallet, result.calls);
  expect(() => validateIntentPlan({ family: "liquidity", action: "liquidity_budget", parameters: result.parameters }, wallet, [...result.calls, result.calls[0]!])).toThrow("partition");
});

test("rejects over-budget, dust, all native balance, and unavailable initial price", async () => {
  const f = planner();
  for (const budget of [{ kind: "amount", amount: "2" }, { kind: "fraction", bps: 10000 }, { kind: "amount", amount: "0.000000000000000001" }]) {
    await expect(liquidityPlan(f.client, f.run, wallet, liquidityRequestSchema.parse({ ...request, budget }))).rejects.toThrow();
  }
  const fresh = planner({ empty: true });
  await expect(liquidityPlan(fresh.client, fresh.run, wallet, request)).rejects.toThrow("initial market price");
  expect(f.swaps).toHaveLength(0);
});

test("confirmed liquidity is one provider batch; pending receipt retries and recovery never resend", async () => {
  const f = planner();
  const plan = await liquidityPlan(f.client, f.run, wallet, request);
  const store = new Store(":memory:"); stores.push(store);
  let prepared = 0, approved = 0;
  let record = awaitingApproval("batch", wallet);
  let outcome: UserOperationOutcome = { status: "pending" };
  const agent = new PecuAgent({ enableMainnetExecution: true, maxSlippageBps: 100, quoteTtlSeconds: 120, depositRelayMaxUsd: 500, depositRelayDailyMaxUsd: 2000 }, store, {
    ...unusedWalletActions, getOrCreate: async () => ({ address: wallet }), balances: async () => "ETH: 0.001",
    prepareBatch: async (_sender, calls) => { prepared++; expect(calls).toEqual(plan.calls); return { transactionId: "batch" }; },
    transaction: async () => record,
    approve: async () => { approved++; record = submittedTransaction("batch", wallet); return {}; },
  }, services({ aerodrome: { run: async () => { throw new Error("unexpected individual action"); }, basket: async () => { throw new Error("unexpected stocks"); }, liquidity: async () => plan }, verifyUserOperation: async () => outcome }), { respond: async () => "unused" });
  const message = (text: string): VerifiedMessage => ({ eventId: crypto.randomUUID(), senderId: "owner", conversationId: "chat", text, encodedEvent: "verified" });
  const preview = await agent.capabilitiesFor(message("use half my ETH")).liquidity(request);
  const code = preview.match(/\/confirm ([A-Z0-9]{6})/)?.[1];
  if (!code) throw new Error("Missing confirmation code");
  expect(prepared).toBe(0);
  await agent.handle(message(`/confirm ${code}`));
  await agent.handle(message(`/confirm ${code}`));
  expect(prepared).toBe(1); expect(approved).toBe(1);
  const intent = store.intentForCode(await digest(code), "owner", "chat");
  if (!intent) throw new Error("Missing intent");
  expect(store.steps(intent.id).filter(step => step.transactionId)).toHaveLength(1);
  outcome = { status: "confirmed", hash: "0xabc", block: "1", gasUsed: "1" };
  await agent.resumeExecuting();
  expect(store.steps(intent.id).every(step => step.state === "succeeded")).toBe(true);
  expect(store.intentForCode(await digest(code), "owner", "chat")?.state).toBe("succeeded");
  expect(prepared).toBe(1); expect(approved).toBe(1);
});

test("wallet adapter prepares one ordered batch without signing", async () => {
  const child = Bun.spawn(["bun", "run", new URL("./fixtures/wallet-batch-check.ts", import.meta.url).pathname], { stdout: "pipe", stderr: "pipe" });
  const [code, stderr] = await Promise.all([child.exited, new Response(child.stderr).text()]);
  expect(stderr).toBe("");
  expect(code).toBe(0);
});
