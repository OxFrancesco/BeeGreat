export function portfolioFixture(url: URL) {
  const wallet = "0x1234567890123456789012345678901234567890";
  return {
    wallet,
    balances: url.searchParams.getAll("token").map((reference) => ({ reference, symbol: reference.startsWith("0x") ? "WETH" : reference.toUpperCase(), address: reference === "eth" ? null : reference.startsWith("0x") ? reference : `0x${(reference === "usdc" ? "22" : "55").repeat(20)}`, amount: reference === "eth" ? "0.012345" : reference === "usdc" ? "124.50" : "12.75", error: null })),
    holdings: url.searchParams.get("stocks") === "1" ? { observedAt: Date.now(), stocks: [
      { symbol: "NVDAc", name: "NVIDIA", address: `0x${"33".repeat(20)}`, balance: "0.4", price_usdc: "150", error: null },
      { symbol: "AAPLc", name: "Apple", address: `0x${"44".repeat(20)}`, balance: "0.2", price_usdc: "250", error: null },
    ] } : null,
    stocksError: null,
  };
}
