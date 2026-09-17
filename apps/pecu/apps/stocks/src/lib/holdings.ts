import type { Stock } from "./market";

const positive = (value: string | null) => {
  const number = value === null || !value.trim() ? NaN : Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
};

export function stockHoldings(stocks: Stock[]) {
  const owned = stocks.filter((stock) => (positive(stock.balance) ?? 0) > 0);
  const rows = owned.map((stock) => {
    const price = positive(stock.price_usdc);
    const value = price === null ? null : Number(stock.balance) * price;
    return { ...stock, value: value !== null && Number.isFinite(value) ? value : null };
  }).sort((a, b) => (b.value ?? -1) - (a.value ?? -1) || a.symbol.localeCompare(b.symbol));
  const total = rows.reduce((sum, row) => sum + (row.value ?? 0), 0);
  return {
    rows,
    total,
    partial: stocks.some((stock) => positive(stock.balance) === null) || rows.some((row) => row.value === null),
    chart: Number.isFinite(total) ? rows.filter((row) => row.value !== null && row.value > 0).map((row) => ({ symbol: row.symbol, value: row.value! })) : [],
  };
}
