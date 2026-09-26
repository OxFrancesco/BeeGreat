import { abis, CommandType, CONTRACT_BALANCE, getChainSettings, KNOWN_TOKENS } from "@beegreat/sugar";
import { decodeAbiParameters, decodeFunctionData, hexToBytes, maxUint256, parseAbi, parseAbiParameters, type Abi, type Hex } from "viem";
import { z } from "zod";
import { STOCKS } from "../node_modules/@beegreat/sugar/src/stocks/catalog";
import type { PlannedCall } from "./domain";
import { formatUnits } from "./evm";
import { isJsonObject, type JsonInput } from "./json-contract";
import { log } from "./logger";
import type { ExecutionStep, Intent, IntentAction, IntentState } from "./state";
import { transactionPlanSchema, type PlanEdge, type PlanNode, type PlanStep, type TransactionPlan } from "./transaction-plan-contract";

/**
 * Turns the exact calls Pecu will sign into a readable plan: one step per
 * transaction and a graph of where value moves. Everything comes from the
 * persisted calldata, so the preview cannot show a step that will not run.
 * Plan context only contributes token symbols and decimals.
 */

export type TokenInfo = Readonly<{ symbol: string; decimals?: number }>;
export type TokenBook = ReadonlyMap<string, TokenInfo>;

const base = getChainSettings(8453);
const key = (address: string) => address.toLowerCase();
const WETH = key(base.wrappedNativeTokenAddress);
const AERO = key(KNOWN_TOKENS[8453].aero.tokenAddress);
const PERMIT2 = "0x000000000022d473030f116ddee9f6b43ac78ba3";
const V2_PATH_GAP = 1;
const V3_PATH_GAP = 3;
const TICK_SPACING_MASK = 0x07ffff;

const knownTokens = new Map<string, TokenInfo>([
  ...Object.values(KNOWN_TOKENS[8453])
    .filter((token) => token.tokenAddress !== "ETH")
    .map((token): [string, TokenInfo] => [key(token.tokenAddress), { symbol: token.symbol, decimals: token.decimals }]),
  [WETH, { symbol: "WETH", decimals: 18 }],
  ...STOCKS.map((stock): [string, TokenInfo] => [key(stock.address), { symbol: stock.symbol }]),
]);

const aerodromeContracts = new Map([
  [key(base.swapperContractAddress), "Aerodrome swap router"],
  [key(base.routerContractAddress), "Aerodrome router"],
  [key(base.nfpmContractAddress), "Aerodrome position manager"],
  [PERMIT2, "Permit2"],
]);

const commonNames = new Set(["Gauge", "Position manager"]);

const erc20 = parseAbi([
  "function approve(address spender, uint256 amount)",
  "function transfer(address to, uint256 amount)",
]);
const wrappedEth = parseAbi([
  "function deposit() payable",
  "function withdraw(uint256 wad)",
]);
const aavePool = parseAbi([
  "function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode)",
  "function withdraw(address asset, uint256 amount, address to)",
  "function borrow(address asset, uint256 amount, uint256 interestRateMode, uint16 referralCode, address onBehalfOf)",
  "function repay(address asset, uint256 amount, uint256 interestRateMode, address onBehalfOf)",
]);
const swapInput = parseAbiParameters("address, uint256, uint256, bytes, bool, bool");
const amountInput = parseAbiParameters("address, uint256");

const address = z.string().regex(/^0x[0-9a-fA-F]{40}$/);
const hex = z.templateLiteral(["0x", z.string().regex(/^(?:[0-9a-fA-F]{2})*$/)]);
const uint = z.bigint().nonnegative();
const mintParams = z.object({
  token0: address, token1: address, tickSpacing: z.number().int(),
  amount0Desired: uint, amount1Desired: uint, sqrtPriceX96: uint,
});
type MintParams = z.infer<typeof mintParams>;
const positionParams = z.object({ tokenId: uint });
const symbolText = z.string().transform((value) => value.replace(/\s+/g, " ").trim().slice(0, 24)).pipe(z.string().min(1));
const places = z.number().int().min(0).max(36);
const rawUnits = z.union([z.string().regex(/^\d+$/), z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER)]).transform((value) => BigInt(value));
const humanAmount = z.union([z.number(), z.string().regex(/^\d+(?:\.\d+)?$/).transform(Number)]).pipe(z.number().positive());

type Decoded = Readonly<{ functionName: string; args: readonly unknown[] }>;

function decode(abi: Abi, data: Hex): Decoded | undefined {
  try {
    const { functionName, args } = decodeFunctionData({ abi, data });
    return { functionName, args: args ?? [] };
  } catch {
    return undefined;
  }
}

export function shortAddress(value: string): string {
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

function duration(seconds: bigint): string {
  const days = seconds / 86_400n;
  if (seconds % 86_400n === 0n) return days === 1n ? "1 day" : `${days} days`;
  const hours = (seconds + 1_800n) / 3_600n;
  return hours === 1n ? "1 hour" : `${hours} hours`;
}

/** Exact decimals for a positive raw amount and its human value, when they agree. */
function inferDecimals(raw: JsonInput, human: JsonInput): number | undefined {
  const units = rawUnits.safeParse(raw).data;
  const target = humanAmount.safeParse(human).data;
  if (!units || target === undefined) return undefined;
  for (let decimals = 0; decimals <= 36; decimals++) {
    if (Math.abs(Number(formatUnits(units, decimals)) - target) <= target * 1e-9) return decimals;
  }
  return undefined;
}

/**
 * Token symbols and decimals found anywhere in a plan's context. Recognises
 * `{ symbol, address, decimals }` objects, `name` + `name_address` pairs and
 * the raw/human amount pairs the Sugar SDK and stock basket emit.
 */
export function tokenHints(context: JsonInput): Map<string, TokenInfo> {
  const symbols = new Map<string, string>();
  const decimals = new Map<string, number>();
  const addSymbol = (target: JsonInput, symbol: JsonInput) => {
    const token = address.safeParse(target).data;
    const name = symbolText.safeParse(symbol).data;
    if (token && name && !symbols.has(key(token))) symbols.set(key(token), name);
  };
  const addDecimals = (target: JsonInput, value: JsonInput) => {
    const token = address.safeParse(target).data;
    const count = places.safeParse(value).data;
    if (token && count !== undefined && !decimals.has(key(token))) decimals.set(key(token), count);
  };
  const visit = (value: JsonInput, depth: number): void => {
    if (depth > 6) return;
    if (Array.isArray(value)) {
      for (const item of value.slice(0, 64)) visit(item, depth + 1);
      return;
    }
    if (!isJsonObject(value)) return;
    for (const field of ["address", "tokenAddress", "token_address", "underlyingToken"]) {
      addSymbol(value[field], value.symbol);
      addDecimals(value[field], value.decimals);
    }
    for (const [name, symbol] of Object.entries(value)) addSymbol(value[`${name}_address`], symbol);
    addSymbol(value.token_address, value.token);
    addDecimals(value.from_address, inferDecimals(value.amount_raw, value.amount));
    addDecimals(value.to_address, inferDecimals(value.minimum_raw, value.minimum));
    if (isJsonObject(value.pool)) {
      addDecimals(value.pool.token0_address, inferDecimals(value.amount0, value.amount0_decimal));
      addDecimals(value.pool.token1_address, inferDecimals(value.amount1, value.amount1_decimal));
    }
    for (const child of Object.values(value)) visit(child, depth + 1);
  };
  visit(context, 0);
  return new Map([...symbols].map(([token, symbol]) => {
    const count = decimals.get(token);
    return [token, count === undefined ? { symbol } : { symbol, decimals: count }];
  }));
}

type Hop = Readonly<{ from: string; to: string; pool: string }>;
type Trade = { nativeIn: boolean; nativeOut: boolean; amountIn?: bigint; minOut?: bigint; hops: Hop[] };

/** Packed Universal Router path: token, then (pool marker, token) per hop. */
function pathHops(path: Hex, v2: boolean): Hop[] {
  const bytes = hexToBytes(path);
  const gap = v2 ? V2_PATH_GAP : V3_PATH_GAP;
  if (bytes.length < 40 + gap || (bytes.length - 20) % (20 + gap) !== 0) throw new Error("Unexpected swap path");
  const token = (offset: number) => `0x${Array.from(bytes.slice(offset, offset + 20), (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
  const hops: Hop[] = [];
  let from = token(0);
  for (let offset = 20; offset < bytes.length; offset += 20 + gap) {
    const marker = v2 ? bytes[offset]! : (bytes[offset]! << 16) | (bytes[offset + 1]! << 8) | bytes[offset + 2]!;
    const to = token(offset + gap);
    hops.push({ from, to, pool: v2 ? (marker === 1 ? "Stable" : "Volatile") : `CL${marker & TICK_SPACING_MASK}` });
    from = to;
  }
  return hops;
}

function swapTrades(commands: Hex, inputs: readonly Hex[]): Trade[] {
  const trades: Trade[] = [];
  let current: Trade | undefined;
  hexToBytes(commands).forEach((byte, index) => {
    const command = byte & 0x3f;
    const input = inputs[index];
    if (!input) throw new Error("Swap command without input");
    if (command === CommandType.WRAP_ETH) {
      const [, amount] = decodeAbiParameters(amountInput, input);
      current = { nativeIn: true, nativeOut: false, amountIn: amount, hops: [] };
      trades.push(current);
    } else if (command === CommandType.V2_SWAP_EXACT_IN || command === CommandType.V3_SWAP_EXACT_IN) {
      const [, amountIn, minOut, path, payerIsUser] = decodeAbiParameters(swapInput, input);
      if (!current || (payerIsUser && current.hops.length)) {
        current = { nativeIn: false, nativeOut: false, hops: [] };
        trades.push(current);
      }
      if (!current.hops.length && current.amountIn === undefined && amountIn !== CONTRACT_BALANCE && amountIn > 0n) current.amountIn = amountIn;
      current.hops.push(...pathHops(path, command === CommandType.V2_SWAP_EXACT_IN));
      if (minOut > 0n) current.minOut = minOut;
    } else if (command === CommandType.UNWRAP_WETH && current) {
      const [, minimum] = decodeAbiParameters(amountInput, input);
      current.nativeOut = true;
      if (minimum > 0n) current.minOut = minimum;
    } else {
      throw new Error(`Unsupported swap command ${command}`);
    }
  });
  if (!trades.length || trades.some((trade) => !trade.hops.length)) throw new Error("Swap without a route");
  return trades;
}

export type PlanOptions = Readonly<{ intent?: IntentAction; tokens?: TokenBook }>;

class PlanBuilder {
  readonly nodes: PlanNode[] = [];
  readonly edges: PlanEdge[] = [];
  readonly steps: PlanStep[] = [];
  private readonly nodeIds = new Map<string, string>();
  private readonly names = new Map<string, string>();
  readonly gauges = new Set<string>();

  constructor(private readonly tokens: TokenBook, readonly intent: IntentAction | undefined) {
    for (const [contract, name] of aerodromeContracts) this.names.set(contract, name);
    const market = intent?.family === "aave" ? z.object({ market: address }).safeParse(intent.parameters).data?.market : undefined;
    if (market) this.names.set(key(market), "Aave market");
  }

  /** Canonical symbols win; context can still supply decimals the static catalog lacks. */
  token(target: string): TokenInfo | undefined {
    const known = knownTokens.get(key(target));
    const hint = this.tokens.get(key(target));
    if (!known) return hint;
    const decimals = known.decimals ?? hint?.decimals;
    return decimals === undefined ? known : { symbol: known.symbol, decimals };
  }

  symbol(target: string, native = false): string {
    return native ? "ETH" : this.token(target)?.symbol ?? shortAddress(target);
  }

  /** A human amount with its symbol, or just the symbol when decimals are unknown. */
  amount(value: bigint, target: string, native = false): string {
    const decimals = native ? 18 : this.token(target)?.decimals;
    return decimals === undefined ? this.symbol(target, native) : `${formatUnits(value, decimals)} ${this.symbol(target, native)}`;
  }

  hasAmount(target: string, native = false): boolean {
    return native || this.token(target)?.decimals !== undefined;
  }

  contractName(target: string): string | undefined {
    const contract = key(target);
    if (this.names.has(contract)) return this.names.get(contract);
    if (this.gauges.has(contract)) return "Gauge";
    const token = this.token(contract);
    return token ? `${token.symbol} token` : undefined;
  }

  nameContract(target: string, name: string): void {
    if (!this.names.has(key(target))) this.names.set(key(target), name);
  }

  /** How a contract reads mid-sentence: "Permit2", "the Aerodrome router", "the gauge". */
  party(target: string): string {
    const name = this.contractName(target);
    if (!name) return shortAddress(target);
    if (name === "Permit2") return name;
    return `the ${commonNames.has(name) ? name.toLowerCase() : name}`;
  }

  node(identity: string, create: () => Omit<PlanNode, "id">): string {
    let id = this.nodeIds.get(identity);
    if (id === undefined) {
      id = `n${this.nodes.length}`;
      this.nodeIds.set(identity, id);
      this.nodes.push({ id, ...create() });
    }
    return id;
  }

  tokenNode(target: string, native = false): string {
    return this.node(native ? "native" : `token:${key(target)}`, () => ({ kind: "token", label: this.symbol(target, native) }));
  }

  edge(from: string, to: string, step: number, label?: string): void {
    if (from === to || this.edges.some((edge) => edge.from === from && edge.to === to && edge.step === step)) return;
    const edge: PlanEdge = { from, to, step };
    if (label) edge.label = label;
    this.edges.push(edge);
  }

  add(call: PlannedCall, step: Omit<PlanStep, "contract" | "contractName" | "value">): void {
    const planned: PlanStep = { ...step, contract: call.to };
    const name = this.contractName(call.to);
    if (name) planned.contractName = name;
    const value = BigInt(call.value);
    if (value > 0n) planned.value = `${formatUnits(value, 18)} ETH`;
    this.steps.push(planned);
  }
}

function describeSwap(plan: PlanBuilder, call: PlannedCall, index: number, commands: Hex, inputs: readonly Hex[]): void {
  const trades = swapTrades(commands, inputs);
  const parts = trades.map((trade) => {
    const first = trade.hops[0]!;
    const last = trade.hops.at(-1)!;
    const nodes = [
      plan.tokenNode(first.from, trade.nativeIn),
      ...trade.hops.slice(0, -1).map((hop) => plan.tokenNode(hop.to)),
      plan.tokenNode(last.to, trade.nativeOut),
    ];
    trade.hops.forEach((hop, hopIndex) => plan.edge(nodes[hopIndex]!, nodes[hopIndex + 1]!, index, hop.pool));
    const pay = trade.amountIn === undefined ? plan.symbol(first.from, trade.nativeIn) : plan.amount(trade.amountIn, first.from, trade.nativeIn);
    const receive = trade.minOut !== undefined && plan.hasAmount(last.to, trade.nativeOut)
      ? `at least ${plan.amount(trade.minOut, last.to, trade.nativeOut)}`
      : plan.symbol(last.to, trade.nativeOut);
    const via = trade.hops.slice(0, -1).map((hop) => plan.symbol(hop.to));
    return `${pay} for ${receive}${via.length ? ` via ${via.join(" and ")}` : ""}`;
  });
  plan.add(call, { kind: "swap", title: `Swap ${parts.join("; ")}` });
}

function poolNode(plan: PlanBuilder, identity: string, label: string, pair: string, created: boolean): string {
  return plan.node(identity, () => {
    const pool: Omit<PlanNode, "id"> = { kind: "pool", label: created ? `New ${label} pool` : `${label} pool`, detail: pair };
    if (created) pool.created = true;
    return pool;
  });
}

function describeMint(plan: PlanBuilder, call: PlannedCall, index: number, params: MintParams): void {
  const value = BigInt(call.value);
  const native0 = value > 0n && key(params.token0) === WETH && value === params.amount0Desired;
  const native1 = value > 0n && key(params.token1) === WETH && value === params.amount1Desired && !native0;
  const created = params.sqrtPriceX96 > 0n;
  const type = `CL${params.tickSpacing}`;
  const pair = `${plan.symbol(params.token0)} / ${plan.symbol(params.token1)}`;
  const token0 = plan.tokenNode(params.token0, native0);
  const token1 = plan.tokenNode(params.token1, native1);
  const pool = poolNode(plan, `pool:${key(params.token0)}:${key(params.token1)}:${params.tickSpacing}`, type, pair, created);
  plan.edge(token0, pool, index);
  plan.edge(token1, pool, index);
  const amounts = `${plan.amount(params.amount0Desired, params.token0, native0)} and ${plan.amount(params.amount1Desired, params.token1, native1)}`;
  const name = `${type} ${pair.replace(" / ", "/")} pool`;
  plan.add(call, { kind: "deposit", title: created ? `Create a ${name} and deposit ${amounts}` : `Deposit ${amounts} into the ${name}` });
}

function describePositionCalls(plan: PlanBuilder, call: PlannedCall, index: number, calls: readonly Decoded[]): boolean {
  const mint = calls.find((item) => item.functionName === "mint");
  if (mint) {
    describeMint(plan, call, index, mintParams.parse(mint.args[0]));
    return true;
  }
  const decrease = calls.find((item) => item.functionName === "decreaseLiquidity");
  const collect = calls.find((item) => item.functionName === "collect");
  const target = decrease ?? collect;
  if (!target) return false;
  const position = positionParams.parse(target.args[0]).tokenId;
  const extras = [
    ...(decrease && collect ? ["collect its fees"] : []),
    ...(calls.some((item) => item.functionName === "unwrapWETH9") ? ["unwrap WETH to ETH"] : []),
    ...(calls.some((item) => item.functionName === "burn") ? ["close the position"] : []),
  ];
  const suffix = extras.length ? `, then ${extras.join(" and ")}` : "";
  plan.add(call, decrease
    ? { kind: "withdraw", title: `Withdraw liquidity from position #${position}${suffix}` }
    : { kind: "claim", title: `Collect trading fees from position #${position}${suffix}` });
  return true;
}

const pairArgs = z.tuple([address, address, z.boolean(), uint, uint, uint], z.unknown());
const nativeArgs = z.tuple([address, z.boolean(), uint, uint, uint], z.unknown());

/**
 * Basic-pool router calls as (tokenA, tokenB, stable, amountA, amountB). The
 * ETH variants take one token and pair it with native ETH. Deposits use the
 * desired amounts; withdrawals use the minimums the router enforces.
 */
function routerLegs(decoded: Decoded, value: bigint) {
  const { functionName, args } = decoded;
  if (functionName === "addLiquidity") {
    const [tokenA, tokenB, stable, amountA, amountB] = pairArgs.parse(args);
    return { deposit: true, native: false, tokenA, tokenB, stable, amountA, amountB };
  }
  if (functionName === "removeLiquidity") {
    const [tokenA, tokenB, stable, , amountA, amountB] = pairArgs.parse(args);
    return { deposit: false, native: false, tokenA, tokenB, stable, amountA, amountB };
  }
  if (functionName === "addLiquidityETH") {
    const [tokenA, stable, amountA] = nativeArgs.parse(args);
    return { deposit: true, native: true, tokenA, tokenB: WETH, stable, amountA, amountB: value };
  }
  if (functionName === "removeLiquidityETH") {
    const [tokenA, stable, , amountA, amountB] = nativeArgs.parse(args);
    return { deposit: false, native: true, tokenA, tokenB: WETH, stable, amountA, amountB };
  }
  return undefined;
}

function describeRouter(plan: PlanBuilder, call: PlannedCall, index: number, decoded: Decoded): boolean {
  const legs = routerLegs(decoded, BigInt(call.value));
  if (!legs) return false;
  const { deposit, native, tokenA, tokenB, stable, amountA, amountB } = legs;
  const type = stable ? "Stable" : "Volatile";
  const pair = `${plan.symbol(tokenA)} / ${plan.symbol(tokenB)}`;
  const sorted = [key(tokenA), key(tokenB)].sort().join(":");
  const pool = () => poolNode(plan, `pool:${sorted}:${type}`, type, pair, false);
  const name = `${type.toLowerCase()} ${pair.replace(" / ", "/")} pool`;
  const amounts = `${plan.amount(amountA, tokenA)} and ${plan.amount(amountB, tokenB, native)}`;
  if (deposit) {
    const tokens = [plan.tokenNode(tokenA), plan.tokenNode(tokenB, native)];
    const target = pool();
    for (const source of tokens) plan.edge(source, target, index);
    plan.add(call, { kind: "deposit", title: `Deposit ${amounts} into the ${name}` });
  } else {
    const source = pool();
    for (const target of [plan.tokenNode(tokenA), plan.tokenNode(tokenB, native)]) plan.edge(source, target, index);
    plan.add(call, { kind: "withdraw", title: `Withdraw at least ${amounts} from the ${name}` });
  }
  return true;
}

function describeAave(plan: PlanBuilder, call: PlannedCall, index: number, decoded: Decoded): void {
  const [asset, amount] = z.tuple([address, uint], z.unknown()).parse(decoded.args);
  const token = plan.tokenNode(asset);
  const aave = plan.node("protocol:aave", () => ({ kind: "protocol", label: "Aave" }));
  const all = amount === maxUint256;
  const shown = plan.amount(amount, asset);
  switch (decoded.functionName) {
    case "supply":
      plan.edge(token, aave, index);
      return plan.add(call, { kind: "lend", title: `Supply ${shown} to Aave` });
    case "withdraw":
      plan.edge(aave, token, index);
      return plan.add(call, { kind: "lend", title: `Withdraw ${all ? `all your ${plan.symbol(asset)}` : shown} from Aave` });
    case "borrow":
      plan.edge(aave, token, index);
      return plan.add(call, { kind: "lend", title: `Borrow ${shown} from Aave` });
    default:
      plan.edge(token, aave, index);
      return plan.add(call, { kind: "lend", title: `Repay ${all ? `your full ${plan.symbol(asset)} debt` : shown} to Aave` });
  }
}

function describeApproval(plan: PlanBuilder, call: PlannedCall, spender: string, amount: bigint): void {
  if (plan.gauges.has(key(spender))) return plan.add(call, { kind: "approval", title: "Allow the gauge to take the position for staking" });
  const who = plan.party(spender);
  const symbol = plan.symbol(call.to);
  const title = amount === 0n
    ? `Revoke ${who}'s permission to spend ${symbol}`
    : amount >= maxUint256 / 2n
      ? `Allow ${who} to spend any amount of ${symbol}`
      : plan.hasAmount(call.to)
        ? `Allow ${who} to spend ${plan.amount(amount, call.to)}`
        : `Allow ${who} to spend ${symbol}`;
  plan.add(call, { kind: "approval", title });
}

function describeCall(plan: PlanBuilder, call: PlannedCall, index: number): void {
  const aero = plan.intent?.family === "aero" || plan.intent?.family === "stocks" || plan.intent?.family === "liquidity";
  const value = BigInt(call.value);
  if (call.data === "0x" && value > 0n) {
    const eth = plan.tokenNode(WETH, true);
    plan.edge(eth, plan.node(`account:${key(call.to)}`, () => ({ kind: "account", label: "Recipient", detail: shortAddress(call.to) })), index);
    return plan.add(call, { kind: "transfer", title: `Send ${formatUnits(value, 18)} ETH to ${shortAddress(call.to)}` });
  }
  const wrap = key(call.to) === WETH ? decode(wrappedEth, call.data) : undefined;
  if (wrap?.functionName === "deposit" && value > 0n) {
    plan.edge(plan.tokenNode(WETH, true), plan.tokenNode(WETH), index);
    return plan.add(call, { kind: "swap", title: `Wrap ${formatUnits(value, 18)} ETH into WETH` });
  }
  if (wrap?.functionName === "withdraw") {
    const [amount] = z.tuple([uint]).parse(wrap.args);
    plan.edge(plan.tokenNode(WETH), plan.tokenNode(WETH, true), index);
    return plan.add(call, { kind: "swap", title: `Unwrap ${formatUnits(amount, 18)} WETH to ETH` });
  }
  const token = decode(erc20, call.data);
  if (token?.functionName === "approve") {
    const [spender, amount] = z.tuple([address, uint]).parse(token.args);
    return describeApproval(plan, call, spender, amount);
  }
  if (token?.functionName === "transfer") {
    const [to, amount] = z.tuple([address, uint]).parse(token.args);
    const sent = plan.tokenNode(call.to);
    plan.edge(sent, plan.node(`account:${key(to)}`, () => ({ kind: "account", label: "Recipient", detail: shortAddress(to) })), index);
    return plan.add(call, { kind: "transfer", title: `Send ${plan.amount(amount, call.to)} to ${shortAddress(to)}` });
  }
  const permit = key(call.to) === PERMIT2 ? decode(abis.permit2, call.data) : undefined;
  if (permit?.functionName === "approve") {
    const [target, spender, amount] = z.tuple([address, address, uint], z.unknown()).parse(permit.args);
    const limit = amount >= (1n << 159n) ? `any amount of ${plan.symbol(target)}` : plan.amount(amount, target);
    return plan.add(call, { kind: "approval", title: `Allow ${plan.party(spender)} to spend ${limit} through Permit2` });
  }
  const swap = decode(abis.swapper, call.data);
  if (swap?.functionName === "execute") {
    const [commands, inputs] = z.tuple([hex, z.array(hex)], z.unknown()).parse(swap.args);
    try {
      return describeSwap(plan, call, index, commands, inputs);
    } catch {
      return plan.add(call, { kind: "swap", title: `Swap through ${plan.party(call.to)}` });
    }
  }
  const position = decode(abis.nfpm, call.data);
  if (position) {
    const inner = position.functionName === "multicall"
      ? z.array(hex).parse(position.args[0]).flatMap((data) => decode(abis.nfpm, data) ?? [])
      : [position];
    if (describePositionCalls(plan, call, index, inner)) return;
  }
  const router = decode(abis.router, call.data);
  if (router && describeRouter(plan, call, index, router)) return;
  if (aero) {
    const lock = decode(abis.votingEscrow, call.data);
    if (lock?.functionName === "createLock") {
      const [amount, seconds] = z.tuple([uint, uint]).parse(lock.args);
      const locked = plan.tokenNode(AERO);
      plan.edge(locked, plan.node("protocol:lock", () => ({ kind: "protocol", label: "Vote lock", detail: duration(seconds) })), index);
      return plan.add(call, { kind: "lock", title: `Lock ${plan.amount(amount, AERO)} for ${duration(seconds)}` });
    }
    const gauge = decode(abis.gaugeCl, call.data) ?? decode(abis.gaugeBasic, call.data);
    if (gauge?.functionName === "deposit") return plan.add(call, { kind: "stake", title: "Stake the position in its gauge" });
    if (gauge?.functionName === "withdraw") return plan.add(call, { kind: "unstake", title: "Unstake the position from its gauge" });
    if (gauge?.functionName === "getReward") return plan.add(call, { kind: "claim", title: "Claim the position's emissions" });
    if (decode(abis.poolBasic, call.data)?.functionName === "claimFees") return plan.add(call, { kind: "claim", title: "Claim the position's trading fees" });
  }
  if (plan.intent?.family === "aave") {
    const lending = decode(aavePool, call.data);
    if (lending) return describeAave(plan, call, index, lending);
  }
  const signature = plan.intent?.family === "evm" ? z.object({ signature: z.string() }).safeParse(plan.intent.parameters).data?.signature : undefined;
  const fn = signature?.split("(")[0];
  plan.add(call, { kind: "call", title: `${fn ? `Call ${fn} on` : "Call"} ${plan.party(call.to)}${value > 0n ? ` and send ${formatUnits(value, 18)} ETH` : ""}` });
}

/** Name every Aerodrome contract a later call targets, so earlier approvals can name their spender. */
function nameContracts(plan: PlanBuilder, calls: readonly PlannedCall[]): void {
  if (plan.intent?.family !== "aero" && plan.intent?.family !== "stocks" && plan.intent?.family !== "liquidity") return;
  for (const call of calls) {
    const gauge = decode(abis.gaugeCl, call.data) ?? decode(abis.gaugeBasic, call.data);
    if (gauge && ["deposit", "withdraw", "getReward"].includes(gauge.functionName) && !decode(erc20, call.data)) plan.gauges.add(key(call.to));
    if (decode(abis.votingEscrow, call.data)?.functionName === "createLock") plan.nameContract(call.to, "Aerodrome vote escrow");
    const position = decode(abis.nfpm, call.data)?.functionName;
    if (position === "mint" || position === "multicall" || position === "decreaseLiquidity" || position === "collect") plan.nameContract(call.to, "Position manager");
  }
}

/**
 * Decode planned calls into steps and a route. Returns undefined when the
 * plan is a single call Pecu cannot describe better than the preview does.
 */
export function transactionPlan(calls: readonly PlannedCall[], options: PlanOptions = {}): TransactionPlan | undefined {
  try {
    const plan = new PlanBuilder(options.tokens ?? new Map(), options.intent);
    nameContracts(plan, calls);
    calls.forEach((call, index) => {
      try {
        describeCall(plan, call, index);
      } catch {
        plan.add(call, { kind: "call", title: `Call ${plan.party(call.to)}` });
      }
    });
    if (plan.steps.length === 1 && plan.steps[0]!.kind === "call") return undefined;
    const result: TransactionPlan = { steps: plan.steps };
    if (plan.edges.length && plan.nodes.length >= 2 && plan.nodes.length <= 24 && plan.edges.length <= 32) {
      result.route = { nodes: plan.nodes, edges: plan.edges };
    }
    return transactionPlanSchema.parse(result);
  } catch (error) {
    log("warn", "transaction_plan_failed", { reason: error instanceof Error ? error.message : String(error) });
    return undefined;
  }
}

const stepStatus = {
  planned: "waiting",
  prepared: "waiting",
  submitted: "submitted",
  succeeded: "confirmed",
  failed: "failed",
} as const satisfies Record<ExecutionStep["state"], PlanStep["status"]>;

/** Attach live step progress once the plan has been confirmed. */
export function withStepStates(plan: TransactionPlan, steps: readonly ExecutionStep[], state: IntentState): TransactionPlan {
  if (!["executing", "succeeded", "failed"].includes(state) || steps.length !== plan.steps.length) return plan;
  return {
    ...plan,
    steps: plan.steps.map((step, index) => {
      const execution = steps[index]!;
      const status = state === "failed" && (execution.state === "planned" || execution.state === "prepared") ? "skipped" : stepStatus[execution.state];
      const progress: PlanStep = { ...step, status };
      if (execution.hash && /^0x[0-9a-fA-F]{64}$/.test(execution.hash)) progress.hash = execution.hash;
      return progress;
    }),
  };
}

/** The plan shown with a preview: stored at proposal time, else decoded from the persisted steps. */
export function intentPlan(store: Readonly<{ steps(intentId: string): ExecutionStep[]; transactionPlan(intentId: string): TransactionPlan | undefined }>, intent: Intent, state: IntentState): TransactionPlan | undefined {
  const steps = store.steps(intent.id);
  if (!steps.length) return undefined;
  const plan = store.transactionPlan(intent.id) ?? transactionPlan(steps.map((step) => step.call), { intent });
  return plan && withStepStates(plan, steps, state);
}

/** Plain-text transaction list for X Chat, where the web graph cannot render. */
export function planSummary(plan: TransactionPlan | undefined): string | undefined {
  if (!plan || (plan.steps.length < 2 && (plan.route?.nodes.length ?? 0) < 3)) return undefined;
  return ["Transactions:", ...plan.steps.map((step, index) => `${index + 1}. ${step.title}`)].join("\n");
}
