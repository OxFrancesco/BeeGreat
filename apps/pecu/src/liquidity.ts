import { ADDRESS_ZERO, KNOWN_TOKENS, applySlippage, tokenEquals, tokenContractAddress, tickToPrice, type LiquidityPool, type SugarClient, type SugarAction, type SugarParameters, type SugarJson } from "@beegreat/sugar";
import { formatUnits, parseUnits } from "viem";
import { z } from "zod";
import { plannedCallSchema } from "./domain";
import { liquidityPlanSchema, type LiquidityRequest, type LiquidityPlan } from "./liquidity-contract";

type Client = Pick<SugarClient, "getToken" | "getTokenBalance" | "getPoolByAddress" | "poolSpec" | "quoteConcentratedDeposit" | "deposit">;
const baseTokens = new Map(Object.values(KNOWN_TOKENS[8453]).map(token => [token.symbol.toLowerCase(), token.tokenAddress]));

type RunAction = (action: SugarAction, parameters: SugarParameters) => Promise<SugarJson>;
const swapSchema = z.object({
  quote: z.object({ min_amount_out: z.coerce.bigint().positive() }),
  transaction_steps: z.array(z.object({ role: z.enum(["approval", "action"]), transaction: plannedCallSchema.omit({ role: true }) })).min(1),
});
const quoteSchema = z.object({ amount_out: z.coerce.bigint().positive() });

export async function liquidityPlan(client: Client, run: RunAction, wallet: `0x${string}`, request: LiquidityRequest): Promise<LiquidityPlan> {
  const getToken = (reference: string) => client.getToken(baseTokens.get(reference.toLowerCase()) ?? reference);
  const funding = await getToken(request.funding_token);
  if (!funding) throw new Error("Funding token was not found on Base");
  const balance = await client.getTokenBalance(funding, wallet);
  if (request.budget.kind === "amount" && (request.budget.amount.split(".")[1]?.length ?? 0) > funding.decimals) throw new Error("Budget has too many decimal places for the funding token");
  const budget = request.budget.kind === "amount" ? parseUnits(request.budget.amount, funding.decimals) : balance * BigInt(request.budget.bps) / 10000n;
  if (budget <= 1n || budget > balance) throw new Error("Liquidity budget must be positive and within the available balance");
  const nativeFunding = funding.wrappedTokenAddress !== undefined;
  if (nativeFunding && budget >= balance) throw new Error("Leave some native ETH available for network fees");

  const selection = request.selection;
  let pool: LiquidityPool;
  if (selection.kind === "pool") {
    const found = await client.getPoolByAddress(selection.pool);
    if (!found) throw new Error("Selected pool was not found");
    pool = found;
  } else {
    const [token0, token1] = await Promise.all([getToken(selection.token0), getToken(selection.token1)]);
    if (!token0 || !token1) throw new Error("Pool tokens were not found on Base");
    pool = await client.poolSpec(token0, token1, { tickSpacing: selection.tick_spacing });
  }
  if (!pool.isCl) throw new Error("Budget liquidity currently supports concentrated-liquidity pools");
  const funds0 = tokenEquals(funding, pool.token0);
  if (!funds0 && !tokenEquals(funding, pool.token1)) throw new Error("Choose one of the pool tokens, or native ETH for a WETH pool, as the funding token");
  const tokens = [pool.token0, pool.token1].map(token => ({ address: tokenContractAddress(token), symbol: token.symbol, decimals: token.decimals }));
  // The SDK's native deposit path wraps ETH inside the mint multicall.
  if (nativeFunding) pool = funds0 ? { ...pool, token0: funding } : { ...pool, token1: funding };
  const other = funds0 ? pool.token1 : pool.token0;
  const initialPrice = pool.sqrtRatio === 0n && selection.kind === "pair" ? selection.initial_price : undefined;
  const price = pool.sqrtRatio === 0n ? initialPrice : tickToPrice(pool.tick, pool.token0.decimals, pool.token1.decimals);
  if (price === undefined || !Number.isFinite(price) || price <= 0) throw new Error("A new uninitialized pool needs a verified initial market price");
  const lower = request.range?.lower ?? price * 0.8;
  const upper = request.range?.upper ?? price * 1.2;
  if (!(lower < price && price < upper)) throw new Error("The liquidity range must contain the current price for this two-sided budget plan");
  const bounds = { priceLower: lower, priceUpper: upper, initialPrice };
  const quoteDeposit = (amount: bigint, fundingSide: boolean) => client.quoteConcentratedDeposit(pool, {
    ...bounds,
    ...(funds0 === fundingSide ? { amountToken0: amount } : { amountToken1: amount }),
  });
  const otherAmount = (quote: Awaited<ReturnType<typeof quoteDeposit>>) => funds0 ? quote.amountToken1 : quote.amountToken0;
  const fundingAmount = (quote: Awaited<ReturnType<typeof quoteDeposit>>) => funds0 ? quote.amountToken0 : quote.amountToken1;
  const whole = await quoteDeposit(budget, true);
  const probeAmount = budget / 2n;
  const swapParameters = (amount: bigint): SugarParameters => ({
    chain: 8453, from_token: funding.tokenAddress, to_token: other.tokenAddress,
    amount: formatUnits(amount, funding.decimals), use_decimals: true,
  });
  const probe = quoteSchema.parse(await run("quote", swapParameters(probeAmount)));
  const probeMinimum = applySlippage(probe.amount_out, request.slippage);
  const needed = otherAmount(whole);
  if (needed <= 0n || probeMinimum <= 0n) throw new Error("Budget is too small to fund both sides of this range");
  const swapAmount = budget * needed / (needed + probeMinimum * budget / probeAmount);
  if (swapAmount <= 0n || swapAmount >= budget) throw new Error("Budget is too small to fund both sides of this range");
  const swap = swapSchema.parse(await run("swap", { ...swapParameters(swapAmount), wallet, slippage: request.slippage }));
  const remaining = budget - swapAmount;
  let deposit = await quoteDeposit(remaining, true);
  if (otherAmount(deposit) > swap.quote.min_amount_out) deposit = await quoteDeposit(swap.quote.min_amount_out, false);
  if (fundingAmount(deposit) > remaining || otherAmount(deposit) > swap.quote.min_amount_out || deposit.amountToken0 <= 0n || deposit.amountToken1 <= 0n) {
    throw new Error("The quoted deposit does not fit the budget and minimum swap output; request a fresh plan");
  }
  if (deposit.tickLower === undefined || deposit.tickUpper === undefined) throw new Error("Missing concentrated-liquidity range in deposit quote");
  const transactions = await client.deposit(deposit, 10, request.slippage);
  const swapCalls = swap.transaction_steps.map(step => ({ ...step.transaction, role: step.role }));
  const depositCalls = transactions.map((call, index) => ({ ...call, value: String(call.value), role: index === transactions.length - 1 ? "action" : "approval" }));
  if (nativeFunding && [...swapCalls, ...depositCalls].reduce((sum, call) => sum + BigInt(call.value), 0n) > budget) throw new Error("Native transaction values exceed the funding budget");
  const label = pool.lp === ADDRESS_ZERO ? "Create a concentrated-liquidity pool" : "Add a concentrated-liquidity position";
  const preview = [
    `${label} on Base with a budget of ${formatUnits(budget, funding.decimals)} ${funding.symbol}.`,
    `Swap ${formatUnits(swapAmount, funding.decimals)} ${funding.symbol} for at least ${formatUnits(swap.quote.min_amount_out, other.decimals)} ${other.symbol}.`,
    `Deposit ${formatUnits(deposit.amountToken0, pool.token0.decimals)} ${pool.token0.symbol} and ${formatUnits(deposit.amountToken1, pool.token1.decimals)} ${pool.token1.symbol}.`,
    `Range: ${tickToPrice(deposit.tickLower, pool.token0.decimals, pool.token1.decimals)} to ${tickToPrice(deposit.tickUpper, pool.token0.decimals, pool.token1.decimals)} ${pool.token1.symbol} per ${pool.token0.symbol}. Tick spacing: ${pool.type}.`,
    `Pool: ${pool.lp === ADDRESS_ZERO ? `${tokenContractAddress(pool.token0)} / ${tokenContractAddress(pool.token1)}` : pool.lp}`,
    "The funding swap, token approvals and deposit are submitted together. Unused tokens stay in your wallet. Fees stop outside the range and token exposure changes.",
    "Network fee: not estimated yet.",
  ].join("\n");
  return liquidityPlanSchema.parse({ parameters: { request, groups: [{ action: "swap", count: swapCalls.length }, { action: "deposit", count: depositCalls.length }] }, calls: [...swapCalls, ...depositCalls], preview, tokens });
}
