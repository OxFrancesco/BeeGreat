import { describe, expect, test } from "bun:test";
import { abis, getChainSettings, KNOWN_TOKENS, setupPlanner, type LiquidityPoolForSwap, type Quote, type Token } from "@beegreat/sugar";
import { concatHex, encodeFunctionData, erc20Abi, isAddress, maxUint256, type Address, type Hex } from "viem";
import type { PlannedCall } from "../src/domain";
import type { ExecutionStep, IntentAction } from "../src/state";
import { Store } from "../src/store";
import { intentPlan, planSummary, tokenHints, transactionPlan, withStepStates } from "../src/transaction-plan";

const base = getChainSettings(8453);
function contract(value: string): Address {
  if (!isAddress(value, { strict: false })) throw new Error(`Not an address: ${value}`);
  return value;
}
const swapper = contract(base.swapperContractAddress);
const router = contract(base.routerContractAddress);
const slipstreamFactory = contract(base.slipstreamFactoryAddress);
const wallet: Address = "0x1111111111111111111111111111111111111111";
const recipient: Address = "0x2222222222222222222222222222222222222222";
const usdcAddress: Address = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const wethAddress: Address = "0x4200000000000000000000000000000000000006";
const aeroAddress: Address = "0x940181a94A35A4569E4529A3CDfB74e38FD98631";
const cbbtcAddress: Address = "0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf";
const permit2: Address = "0x000000000022D473030F116dDEE9F6B43aC78BA3";
const positionManager: Address = "0x3333333333333333333333333333333333333333";
const nvda: Address = "0xb20000000000000000000078ee7ce2fe4908108c";
const aapl: Address = "0xb200000000000000000000c2e324d24d7eecd1fb";
const aero: IntentAction = { family: "aero", action: "swap", parameters: {} };
const stocks: IntentAction = { family: "stocks", action: "stock_basket", parameters: { trades: [{ side: "buy", stock: "NVDAc", amount: "100" }], slippage: 0.01 } };

const token = (symbol: string, tokenAddress: string, decimals: number, wrappedTokenAddress?: Address): Token => ({
  chainId: 8453, chainName: "Base", symbol, tokenAddress, decimals, listed: true, emerging: false, wrappedTokenAddress,
});
const USDC = token("USDC", usdcAddress, 6);
const WETH = token("WETH", wethAddress, 18);
const CBBTC = token("cbBTC", cbbtcAddress, 8);
const ETH = KNOWN_TOKENS[8453].eth;

function pool(token0: Address, token1: Address, type: number): LiquidityPoolForSwap {
  return {
    chainId: 8453, chainName: "Base", lp: "0x4444444444444444444444444444444444444444", type, token0Address: token0, token1Address: token1,
    factory: type > 0 ? slipstreamFactory : undefined, isCl: type > 0, isStable: type === 0, isBasic: type <= 0,
  };
}

function call(to: Address, data: Hex, value = 0n, role: PlannedCall["role"] = "approval"): PlannedCall {
  return { role, from: wallet, to, data, value: value.toString() };
}

function swapCall(quotes: Quote[], value = 0n): PlannedCall {
  const plans = quotes.map((quote) => setupPlanner(quote, 0.005, wallet, swapper, { newFactory: slipstreamFactory }));
  const data = encodeFunctionData({ abi: abis.swapper, functionName: "execute", args: [concatHex(plans.map((plan) => plan.commands)), plans.flatMap((plan) => plan.inputs)] });
  return call(swapper, data, value, "action");
}

const approve = (tokenAddress: Address, spender: Address, amount: bigint) =>
  call(tokenAddress, encodeFunctionData({ abi: abis.erc20, functionName: "approve", args: [spender, amount] }));
const permit = (tokenAddress: Address, amount: bigint) =>
  call(permit2, encodeFunctionData({ abi: abis.permit2, functionName: "approve", args: [tokenAddress, base.swapperContractAddress, amount, 1_900_000_000] }));

describe("swap routes", () => {
  test("a native ETH swap shows one step and the pool it trades through", () => {
    const quote: Quote = { input: { fromToken: ETH, toToken: USDC, path: [{ pool: pool(wethAddress, usdcAddress, 100), reversed: false }], amountIn: 50_000_000_000_000_000n }, amountOut: 120_000_000n };
    const plan = transactionPlan([swapCall([quote], 50_000_000_000_000_000n)], { intent: aero })!;
    expect(plan.steps).toEqual([{
      kind: "swap",
      title: "Swap 0.05 ETH for at least 119.4 USDC",
      contract: base.swapperContractAddress,
      contractName: "Aerodrome swap router",
      value: "0.05 ETH",
    }]);
    expect(plan.route?.nodes.map((node) => node.label)).toEqual(["ETH", "USDC"]);
    expect(plan.route?.edges).toEqual([{ from: "n0", to: "n1", step: 0, label: "CL100" }]);
    expect(planSummary(plan)).toBeUndefined();
  });

  test("multi-hop swaps name each pool and intermediate token, after both Permit2 approvals", () => {
    const quote: Quote = {
      input: {
        fromToken: USDC, toToken: CBBTC, amountIn: 50_000_000n,
        path: [{ pool: pool(usdcAddress, aeroAddress, -1), reversed: false }, { pool: pool(cbbtcAddress, aeroAddress, 200), reversed: true }],
      },
      amountOut: 42_000n,
    };
    const plan = transactionPlan([approve(usdcAddress, permit2, 50_000_000n), permit(usdcAddress, 50_000_000n), swapCall([quote])], {
      intent: aero,
      tokens: tokenHints({ quote: { from_token: { symbol: "USDC", address: usdcAddress, decimals: 6 }, to_token: { symbol: "cbBTC", address: cbbtcAddress, decimals: 8 } } }),
    })!;
    expect(plan.steps.map((step) => step.title)).toEqual([
      "Allow Permit2 to spend 50 USDC",
      "Allow the Aerodrome swap router to spend 50 USDC through Permit2",
      "Swap 50 USDC for at least 0.0004179 cbBTC via AERO",
    ]);
    expect(plan.steps.map((step) => step.contractName)).toEqual(["USDC token", "Permit2", "Aerodrome swap router"]);
    expect(plan.route?.nodes.map((node) => node.label)).toEqual(["USDC", "AERO", "cbBTC"]);
    expect(plan.route?.edges.map((edge) => [edge.from, edge.to, edge.step, edge.label])).toEqual([["n0", "n1", 2, "Volatile"], ["n1", "n2", 2, "CL200"]]);
    expect(planSummary(plan)).toBe([
      "Transactions:",
      "1. Allow Permit2 to spend 50 USDC",
      "2. Allow the Aerodrome swap router to spend 50 USDC through Permit2",
      "3. Swap 50 USDC for at least 0.0004179 cbBTC via AERO",
    ].join("\n"));
  });

  test("a stock basket fans one token out to every stock in a single router call", () => {
    const quotes: Quote[] = [
      { input: { fromToken: USDC, toToken: token("NVDAc", nvda, 18), amountIn: 100_000_000n, path: [{ pool: pool(usdcAddress, nvda, 100), reversed: false }] }, amountOut: 452_492_000_000_000_000n },
      { input: { fromToken: USDC, toToken: token("AAPLc", aapl, 18), amountIn: 100_000_000n, path: [{ pool: pool(usdcAddress, aapl, 100), reversed: false }] }, amountOut: 297_571_000_000_000_000n },
    ];
    const context = { trades: [
      { from_address: usdcAddress, to_address: nvda, amount_raw: "100000000", minimum_raw: "450229540000000000", from: "USDC", to: "NVDAc", amount: "100", expected: "0.452492", minimum: "0.45022954" },
    ] };
    const plan = transactionPlan([swapCall(quotes)], { intent: stocks, tokens: tokenHints(context) })!;
    expect(plan.steps[0]!.title).toBe("Swap 100 USDC for at least 0.45022954 NVDAc; 100 USDC for AAPLc");
    expect(plan.route?.nodes.map((node) => node.label)).toEqual(["USDC", "NVDAc", "AAPLc"]);
    expect(plan.route?.edges.map((edge) => [edge.from, edge.to])).toEqual([["n0", "n1"], ["n0", "n2"]]);
  });

  test("an unrecognised router command still lists the step without inventing a route", () => {
    const data = encodeFunctionData({ abi: abis.swapper, functionName: "execute", args: ["0x04", ["0x"]] });
    const plan = transactionPlan([call(swapper, data, 0n, "action")], { intent: aero })!;
    expect(plan.steps.map((step) => step.title)).toEqual(["Swap through the Aerodrome swap router"]);
    expect(plan.route).toBeUndefined();
  });
});

describe("liquidity", () => {
  const sqrtPrice = 79_228_162_514_264_337_593_543_950_336n;
  const mint = (created: boolean, value = 0n) => call(positionManager, encodeFunctionData({
    abi: abis.nfpm,
    functionName: "mint",
    args: [{
      token0: wethAddress, token1: usdcAddress, tickSpacing: 100, tickLower: -200_000, tickUpper: -190_000,
      amount0Desired: 9_800_000_000_000_000n, amount1Desired: 25_000_000n, amount0Min: 0n, amount1Min: 0n,
      recipient: wallet, deadline: 1_900_000_000n, sqrtPriceX96: created ? sqrtPrice : 0n,
    }],
  }), value, "action");

  test("a budget plan that creates a pool shows the funding swap flowing into the new pool", () => {
    const quote: Quote = { input: { fromToken: USDC, toToken: WETH, amountIn: 25_000_000n, path: [{ pool: pool(wethAddress, usdcAddress, 100), reversed: true }] }, amountOut: 9_900_000_000_000_000n };
    const calls = [
      approve(usdcAddress, permit2, 25_000_000n),
      permit(usdcAddress, 25_000_000n),
      swapCall([quote]),
      approve(wethAddress, positionManager, 9_800_000_000_000_000n),
      approve(usdcAddress, positionManager, 25_000_000n),
      mint(true),
    ];
    const plan = transactionPlan(calls, { intent: aero })!;
    expect(plan.steps.map((step) => step.title)).toEqual([
      "Allow Permit2 to spend 25 USDC",
      "Allow the Aerodrome swap router to spend 25 USDC through Permit2",
      "Swap 25 USDC for at least 0.0098505 WETH",
      "Allow the position manager to spend 0.0098 WETH",
      "Allow the position manager to spend 25 USDC",
      "Create a CL100 WETH/USDC pool and deposit 0.0098 WETH and 25 USDC",
    ]);
    expect(plan.steps.map((step) => step.kind)).toEqual(["approval", "approval", "swap", "approval", "approval", "deposit"]);
    expect(plan.route?.nodes).toEqual([
      { id: "n0", kind: "token", label: "USDC" },
      { id: "n1", kind: "token", label: "WETH" },
      { id: "n2", kind: "pool", label: "New CL100 pool", detail: "WETH / USDC", created: true },
    ]);
    expect(plan.route?.edges).toEqual([
      { from: "n0", to: "n1", step: 2, label: "CL100" },
      { from: "n1", to: "n2", step: 5 },
      { from: "n0", to: "n2", step: 5 },
    ]);
  });

  test("a native deposit into an existing pool sends ETH and names the pool without 'new'", () => {
    const plan = transactionPlan([mint(false, 9_800_000_000_000_000n)], { intent: aero })!;
    expect(plan.steps[0]).toMatchObject({ title: "Deposit 0.0098 ETH and 25 USDC into the CL100 WETH/USDC pool", value: "0.0098 ETH", contractName: "Position manager" });
    expect(plan.route?.nodes).toEqual([
      { id: "n0", kind: "token", label: "ETH" },
      { id: "n1", kind: "token", label: "USDC" },
      { id: "n2", kind: "pool", label: "CL100 pool", detail: "WETH / USDC" },
    ]);
  });

  test("basic pool deposits and withdrawals use the router's amounts", () => {
    const add = call(router, encodeFunctionData({ abi: abis.router, functionName: "addLiquidity", args: [usdcAddress, aeroAddress, false, 10_000_000n, 20_000_000_000_000_000_000n, 0n, 0n, wallet, 1n] }), 0n, "action");
    const remove = call(router, encodeFunctionData({ abi: abis.router, functionName: "removeLiquidityETH", args: [usdcAddress, false, 5n, 4_000_000n, 1_000_000_000_000_000n, wallet, 1n] }), 0n, "action");
    expect(transactionPlan([add], { intent: aero })!.steps[0]!.title).toBe("Deposit 10 USDC and 20 AERO into the volatile USDC/AERO pool");
    const withdrawal = transactionPlan([remove], { intent: aero })!;
    expect(withdrawal.steps[0]!.title).toBe("Withdraw at least 4 USDC and 0.001 ETH from the volatile USDC/WETH pool");
    expect(withdrawal.route?.edges.map((edge) => edge.from)).toEqual(["n0", "n0"]);
  });

  test("position withdrawals, fee claims and staking read as plain steps", () => {
    const decrease = encodeFunctionData({ abi: abis.nfpm, functionName: "decreaseLiquidity", args: [{ tokenId: 123n, liquidity: 10n, amount0Min: 0n, amount1Min: 0n, deadline: 1n }] });
    const collect = encodeFunctionData({ abi: abis.nfpm, functionName: "collect", args: [{ tokenId: 123n, recipient: wallet, amount0Max: 1n, amount1Max: 1n }] });
    const burn = encodeFunctionData({ abi: abis.nfpm, functionName: "burn", args: [123n] });
    const multicall = (calls: Hex[]) => call(positionManager, encodeFunctionData({ abi: abis.nfpm, functionName: "multicall", args: [calls] }), 0n, "action");
    expect(transactionPlan([multicall([decrease, collect, burn])], { intent: aero })!.steps[0]!.title).toBe("Withdraw liquidity from position #123, then collect its fees and close the position");
    expect(transactionPlan([multicall([collect])], { intent: aero })!.steps[0]!.title).toBe("Collect trading fees from position #123");
    const gauge: Address = "0x5555555555555555555555555555555555555555";
    const stake = transactionPlan([
      call(positionManager, encodeFunctionData({ abi: abis.nfpm, functionName: "approve", args: [gauge, 123n] })),
      call(gauge, encodeFunctionData({ abi: abis.gaugeCl, functionName: "deposit", args: [123n] }), 0n, "action"),
    ], { intent: aero })!;
    expect(stake.steps.map((step) => [step.title, step.contractName])).toEqual([
      ["Allow the gauge to take the position for staking", undefined],
      ["Stake the position in its gauge", "Gauge"],
    ]);
    expect(stake.route).toBeUndefined();
  });

  test("locking AERO names the vote escrow in its approval", () => {
    const escrow: Address = "0x6666666666666666666666666666666666666666";
    const plan = transactionPlan([
      approve(aeroAddress, escrow, 10n ** 19n),
      call(escrow, encodeFunctionData({ abi: abis.votingEscrow, functionName: "createLock", args: [10n ** 19n, 31_536_000n] }), 0n, "action"),
    ], { intent: aero })!;
    expect(plan.steps.map((step) => step.title)).toEqual(["Allow the Aerodrome vote escrow to spend 10 AERO", "Lock 10 AERO for 365 days"]);
    expect(plan.route?.nodes.map((node) => [node.label, node.detail])).toEqual([["AERO", undefined], ["Vote lock", "365 days"]]);
  });
});

describe("wallet and lending calls", () => {
  // SAFETY: the decoder reads only the family and a contract call's `signature`; full EVM parameter validation is covered by tests/evm.test.ts.
  const evm = (action: "transfer" | "approve" | "revoke" | "contract_call", parameters: Record<string, string> = {}): IntentAction => ({ family: "evm", action, parameters: { chain: "base", ...parameters } as never });

  test("sends draw a flow to the recipient and approvals state the exact limit", () => {
    const send = transactionPlan([call(usdcAddress, encodeFunctionData({ abi: erc20Abi, functionName: "transfer", args: [recipient, 250_000_000n] }), 0n, "action")], { intent: evm("transfer") })!;
    expect(send.steps[0]!.title).toBe("Send 250 USDC to 0x2222…2222");
    expect(send.route?.nodes.map((node) => [node.kind, node.label, node.detail])).toEqual([["token", "USDC", undefined], ["account", "Recipient", "0x2222…2222"]]);
    const eth = transactionPlan([call(recipient, "0x", 1_000_000_000_000_000n, "action")], { intent: evm("transfer") })!;
    expect(eth.steps[0]).toMatchObject({ title: "Send 0.001 ETH to 0x2222…2222", value: "0.001 ETH" });
    expect(transactionPlan([approve(usdcAddress, recipient, 150_000_000n)], { intent: evm("approve") })!.steps[0]!.title).toBe("Allow 0x2222…2222 to spend 150 USDC");
    expect(transactionPlan([approve(usdcAddress, recipient, maxUint256)], { intent: evm("approve") })!.steps[0]!.title).toBe("Allow 0x2222…2222 to spend any amount of USDC");
    expect(transactionPlan([approve(usdcAddress, recipient, 0n)], { intent: evm("revoke") })!.steps[0]!.title).toBe("Revoke 0x2222…2222's permission to spend USDC");
  });

  test("wrapping and unwrapping WETH read as their own steps with an ETH to WETH route", () => {
    const deposit = encodeFunctionData({ abi: [{ type: "function", name: "deposit", stateMutability: "payable", inputs: [], outputs: [] }], functionName: "deposit" });
    const wrap = transactionPlan([call(wethAddress, deposit, 784_500_000_000_000n, "action")], { intent: evm("contract_call", { signature: "deposit()" }) })!;
    expect(wrap.steps).toEqual([{ kind: "swap", title: "Wrap 0.0007845 ETH into WETH", contract: wethAddress, contractName: "WETH token", value: "0.0007845 ETH" }]);
    expect(wrap.route?.nodes.map((node) => node.label)).toEqual(["ETH", "WETH"]);
    expect(wrap.route?.edges).toEqual([{ from: "n0", to: "n1", step: 0 }]);
    const withdraw = encodeFunctionData({ abi: [{ type: "function", name: "withdraw", stateMutability: "nonpayable", inputs: [{ type: "uint256" }], outputs: [] }], functionName: "withdraw", args: [10n ** 15n] });
    const unwrap = transactionPlan([call(wethAddress, withdraw, 0n, "action")], { intent: evm("contract_call", { signature: "withdraw(uint256)" }) })!;
    expect(unwrap.steps[0]!.title).toBe("Unwrap 0.001 WETH to ETH");
    expect(unwrap.route?.nodes.map((node) => node.label)).toEqual(["WETH", "ETH"]);
  });

  test("Aave actions flow between the token and Aave, and name the market", () => {
    const market: Address = "0xA238Dd80C259a72e81d7e4664a9801593F98d1c5";
    // SAFETY: the decoder reads only `market` from Aave parameters; the full schema is covered by the Aave integration tests.
    const intent: IntentAction = { family: "aave", action: "aave_action", parameters: { market } as never };
    const supply = call(market, encodeFunctionData({ abi: [{ type: "function", name: "supply", stateMutability: "nonpayable", inputs: [{ type: "address" }, { type: "uint256" }, { type: "address" }, { type: "uint16" }], outputs: [] }], functionName: "supply", args: [usdcAddress, 150_000_000n, wallet, 0] }), 0n, "action");
    const plan = transactionPlan([approve(usdcAddress, market, 150_000_000n), supply], { intent })!;
    expect(plan.steps.map((step) => step.title)).toEqual(["Allow the Aave market to spend 150 USDC", "Supply 150 USDC to Aave"]);
    expect(plan.route?.nodes.map((node) => node.label)).toEqual(["USDC", "Aave"]);
  });

  test("a lone contract call is left to the preview text, and junk calldata never throws", () => {
    expect(transactionPlan([call(recipient, "0x12345678", 0n, "action")], { intent: evm("contract_call", { signature: "deposit(uint256)" }) })).toBeUndefined();
    const plan = transactionPlan([call(recipient, "0x12345678"), call(recipient, "0xdeadbeef", 1n, "action")], { intent: evm("contract_call", { signature: "deposit(uint256)" }) })!;
    expect(plan.steps.map((step) => step.title)).toEqual(["Call deposit on 0x2222…2222", "Call deposit on 0x2222…2222 and send 0.000000000000000001 ETH"]);
  });
});

describe("token hints", () => {
  test("reads Sugar quote, route, deposit and EVM context shapes", () => {
    const hints = tokenHints({
      quote: { from_token: { symbol: "USDC", address: usdcAddress, decimals: 6 }, route: [{ symbol: "AERO", address: aeroAddress, lp: "0x4444444444444444444444444444444444444444", type_label: "volatile" }, { symbol: null, address: recipient }] },
      deposit: { pool: { token0: "cbBTC", token0_address: cbbtcAddress, token1: "WETH", token1_address: wethAddress }, amount0: "12345", amount0_decimal: 0.00012345, amount1: "1", amount1_decimal: 1e-18 },
      evm: { token: "DEGEN", token_address: "0x4ed4E862860beD51a9570b96d89aF5E1B0Efefed", decimals: 18 },
    });
    expect(hints.get(usdcAddress.toLowerCase())).toEqual({ symbol: "USDC", decimals: 6 });
    expect(hints.get(aeroAddress.toLowerCase())).toEqual({ symbol: "AERO" });
    expect(hints.get(cbbtcAddress.toLowerCase())).toEqual({ symbol: "cbBTC", decimals: 8 });
    expect(hints.get("0x4ed4e862860bed51a9570b96d89af5e1b0efefed")).toEqual({ symbol: "DEGEN", decimals: 18 });
    expect(hints.has(recipient.toLowerCase())).toBe(false);
  });
});

describe("execution progress", () => {
  const plan = transactionPlan([approve(usdcAddress, permit2, 1n), permit(usdcAddress, 1n)], { intent: aero })!;
  const step = (position: number, state: ExecutionStep["state"], hash?: string): ExecutionStep => {
    const planned = { intentId: "i", position, state, call: call(usdcAddress, "0x") };
    return hash ? { ...planned, hash } : planned;
  };
  const hash = `0x${"ab".repeat(32)}`;

  test("steps carry status and hashes only once the plan is confirmed", () => {
    expect(withStepStates(plan, [step(0, "planned"), step(1, "planned")], "pending").steps.every((item) => item.status === undefined)).toBe(true);
    expect(withStepStates(plan, [step(0, "succeeded", hash), step(1, "submitted", "not-a-hash")], "executing").steps.map((item) => [item.status, item.hash])).toEqual([["confirmed", hash], ["submitted", undefined]]);
    expect(withStepStates(plan, [step(0, "failed"), step(1, "planned")], "failed").steps.map((item) => item.status)).toEqual(["failed", "skipped"]);
    expect(withStepStates(plan, [step(0, "succeeded")], "succeeded")).toBe(plan);
  });

  test("the store keeps the proposal-time plan and falls back to decoding the persisted steps", () => {
    const store = new Store(":memory:");
    const calls = [approve(usdcAddress, permit2, 1n), permit(usdcAddress, 1n)];
    const intent = { id: "intent-1", codeHash: "c", senderId: "s", conversationId: "c", sourceEventId: "e", state: "pending", preview: "p", planDigest: "d", expiresAt: 1, ...aero } as const;
    store.createIntent(intent, calls);
    const decoded = intentPlan(store, intent, "pending")!;
    expect(decoded.steps.map((item) => item.title)).toEqual(["Allow Permit2 to spend 0.000001 USDC", "Allow the Aerodrome swap router to spend 0.000001 USDC through Permit2"]);
    store.saveTransactionPlan(intent.id, { steps: [{ ...decoded.steps[0]!, title: "Stored" }, decoded.steps[1]!] });
    expect(intentPlan(store, intent, "pending")!.steps[0]!.title).toBe("Stored");
  });
});
