import { z } from "zod";
import {
  abis,
  applySlippage,
  normalizeDecimal,
  tokenFromTuple,
  tupleValues,
  type Quote,
  type SugarClient,
  type Token,
  type UnsignedTransaction,
} from "@beegreat/sugar";
import { resolveStock, STOCK_USDC, STOCKS, type Stock } from "../node_modules/@beegreat/sugar/src/stocks/catalog";
import type { StockTrade } from "./stock-contract";

export type StockClient = Pick<
  SugarClient,
  "settings" | "publicClient" | "getPrices" | "getQuote" | "swapBasketFromQuotes"
>;

const requestedAddresses = [STOCK_USDC, ...STOCKS.map((stock) => stock.address)];

function toUnits(amount: string, decimals: number): bigint {
  const [whole = "0", fraction = ""] = amount.split(".");
  return BigInt(whole) * 10n ** BigInt(decimals) + BigInt(fraction.padEnd(decimals, "0") || "0");
}

function fromUnits(value: bigint, decimals: number): string {
  const base = 10n ** BigInt(decimals);
  const whole = value / base;
  const fraction = (value % base).toString().padStart(decimals, "0").replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole.toString();
}

function stockAmount(text: string, decimals: number): bigint {
  if (!/^\d+(?:\.\d+)?$/.test(text) || (text.split(".")[1]?.length ?? 0) > decimals || text.length > 100) {
    throw new Error(`Amount must be a decimal with at most ${decimals} decimal places`);
  }
  const amount = toUnits(text, decimals);
  if (amount <= 0n) throw new Error("Amount must be positive");
  return amount;
}

/** Oracle price as a plain decimal with up to 6 fraction digits, no exponent notation. */
function formatPrice(price: number): string | undefined {
  if (!Number.isFinite(price) || price <= 0) return undefined;
  const [whole = "0", fraction = ""] = normalizeDecimal(price).split(".");
  const trimmed = fraction.slice(0, 6).replace(/0+$/, "");
  return trimmed ? `${whole}.${trimmed}` : whole;
}

export type StockTokens = Readonly<{
  usdc: Token;
  usdcBalance: bigint;
  stocks: Array<{ stock: Stock; token?: Token; balance?: bigint }>;
}>;

/**
 * Resolve the stock catalog and USDC in a single `tokens` call. The contract
 * may return extra catalog rows; only requested addresses are kept.
 */
export async function stockTokens(client: StockClient, wallet: `0x${string}`): Promise<StockTokens> {
  const wanted = new Map(requestedAddresses.map((address) => [address.toLowerCase(), address]));
  // SAFETY: viem cannot statically type a dynamic read over a JSON ABI; the
  // Sugar ABI pins the tuple shape (address, symbol, decimals, account_balance, listed, emerging).
  const raw = await client.publicClient.readContract({
    address: client.settings.sugarContractAddress as `0x${string}`,
    abi: abis.sugar,
    functionName: "tokens",
    args: [BigInt(requestedAddresses.length), 0n, wallet, requestedAddresses],
  } as never) as unknown[];
  const byAddress = new Map<string, unknown>();
  for (const row of raw) {
    const key = String(tupleValues(row)[0]).toLowerCase();
    if (wanted.has(key)) byAddress.set(key, row);
  }
  const usdcRow = byAddress.get(STOCK_USDC.toLowerCase());
  if (!usdcRow) throw new Error(`Token unavailable: ${STOCK_USDC}`);
  return {
    usdc: tokenFromTuple(usdcRow, client.settings),
    usdcBalance: z.coerce.bigint().parse(tupleValues(usdcRow)[3]),
    stocks: STOCKS.map((stock) => {
      const row = byAddress.get(stock.address.toLowerCase());
      if (!row) return { stock };
      return {
        stock,
        token: tokenFromTuple(row, client.settings),
        balance: z.coerce.bigint().parse(tupleValues(row)[3]),
      };
    }),
  };
}

export type StockRow = Readonly<{
  symbol: string;
  name: string;
  address: string;
  price_usdc: string | null;
  balance: string | null;
  error: string | null;
}>;

/** Fast stock market read: one `tokens` call plus one oracle price call. */
export async function stockSnapshot(client: StockClient, wallet: `0x${string}`): Promise<StockRow[]> {
  const { usdc, stocks } = await stockTokens(client, wallet);
  const tokens = stocks.flatMap((entry) => (entry.token ? [entry.token] : []));
  const prices = new Map(
    (await client.getPrices([usdc, ...tokens])).map((price) => [price.token.tokenAddress.toLowerCase(), price.price]),
  );
  return stocks.map(({ stock, token, balance }) => {
    const formatted = token ? formatPrice(prices.get(token.tokenAddress.toLowerCase()) ?? NaN) : undefined;
    return {
      symbol: stock.symbol,
      name: stock.name,
      address: stock.address,
      price_usdc: formatted ?? null,
      balance: token && balance !== undefined ? fromUnits(balance, token.decimals) : null,
      error: formatted === undefined ? "Price unavailable" : null,
    };
  });
}

export type StockBasketPlan = Readonly<{
  transactions: UnsignedTransaction[];
  transaction_steps: Array<{ role: "approval" | "action"; transaction: UnsignedTransaction }>;
  allocation: unknown[];
  trades: Array<{
    from_address: string;
    to_address: string;
    amount_raw: string;
    minimum_raw: string;
    from: string;
    to: string;
    amount: string;
    expected: string;
    minimum: string;
  }>;
  slippage: number;
}>;

/**
 * Plan several stock buys and sells as one basket transaction. One `tokens`
 * read resolves every token and balance; each trade gets one quote; a single
 * `swapBasketFromQuotes` call yields approvals followed by one router action.
 */
export async function stockBasketPlan(
  client: StockClient,
  wallet: `0x${string}`,
  trades: readonly StockTrade[],
  slippage: number,
): Promise<StockBasketPlan> {
  if (trades.length < 1 || trades.length > 8) throw new Error("Stock basket needs between 1 and 8 trades");
  if (!Number.isFinite(slippage) || slippage <= 0 || slippage >= 1) throw new Error("Slippage must be greater than 0 and less than 1");
  const { usdc, usdcBalance, stocks } = await stockTokens(client, wallet);
  const seen = new Set<string>();
  const resolved = trades.map((trade) => {
    const stock = resolveStock(trade.stock);
    const key = `${trade.side}:${stock.address.toLowerCase()}`;
    if (seen.has(key)) throw new Error(`Combine repeated trades for ${stock.symbol} into one amount`);
    seen.add(key);
    const entry = stocks.find((item) => item.stock.address.toLowerCase() === stock.address.toLowerCase());
    if (!entry?.token) throw new Error(`Token unavailable: ${stock.address}`);
    const [from, to] = trade.side === "buy" ? [usdc, entry.token] : [entry.token, usdc];
    return { side: trade.side, stock, from, to, amount: stockAmount(trade.amount, from.decimals), balance: entry.balance ?? 0n };
  });
  const needed = resolved.filter((trade) => trade.side === "buy").reduce((sum, trade) => sum + trade.amount, 0n);
  if (needed > usdcBalance) {
    throw new Error(`Insufficient USDC balance: this needs ${fromUnits(needed, usdc.decimals)} USDC and the wallet holds ${fromUnits(usdcBalance, usdc.decimals)} USDC`);
  }
  for (const trade of resolved) {
    if (trade.side === "sell" && trade.amount > trade.balance) throw new Error(`Insufficient ${trade.from.symbol} balance`);
  }
  const quotes: Quote[] = [];
  for (const trade of resolved) {
    const quote = await client.getQuote(trade.from, trade.to, trade.amount);
    if (!quote || quote.amountOut <= 0n) throw new Error(`No executable route for ${trade.from.symbol} to ${trade.to.symbol}`);
    quotes.push(quote);
  }
  const transactions = await client.swapBasketFromQuotes(quotes, slippage);
  return {
    transactions,
    transaction_steps: transactions.map((transaction, index) => ({
      role: index === transactions.length - 1 ? "action" : "approval",
      transaction,
    })),
    allocation: [],
    trades: quotes.map((item) => ({
      from_address: item.input.fromToken.tokenAddress,
      to_address: item.input.toToken.tokenAddress,
      amount_raw: item.input.amountIn.toString(),
      minimum_raw: applySlippage(item.amountOut, slippage).toString(),
      from: item.input.fromToken.symbol,
      to: item.input.toToken.symbol,
      amount: fromUnits(item.input.amountIn, item.input.fromToken.decimals),
      expected: fromUnits(item.amountOut, item.input.toToken.decimals),
      minimum: fromUnits(applySlippage(item.amountOut, slippage), item.input.toToken.decimals),
    })),
    slippage,
  };
}
