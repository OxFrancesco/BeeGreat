const tokens: [symbol: string, realized: number, unrealized: number | null][] = [
  ["AERO", 412.35, 88.1],
  ["VIRTUAL", -268.4, -41.25],
  ["WETH", 190.02, -122.6],
  ["cbBTC", 96.5, 44.9],
  ["DEGEN", -91.7, 12.3],
  ["NVDAc", 0, 31.84],
  ["BRETT", -48.2, -6.1],
  ["TOSHI", 22.75, 0],
  ["AAPLc", 0, -9.42],
  ["USDC", 0, 0],
  ["MOCHI", -12.05, 3.3],
  ["FREE-USDC", 0, null],
];

export function pnlFixture(wallet: string, days: number) {
  const scale = days === 7 ? 0.2 : days === 90 ? 2.4 : days === 365 ? 6.1 : 1;
  const round = (value: number) => Math.round(value * scale * 100) / 100;
  const to = new Date();
  const from = new Date(to.getTime() - days * 86_400_000);
  return {
    wallet,
    days,
    snapshot: {
      key: `pnl:${days}`,
      kind: "pnl",
      observedAt: Date.now() - 2 * 60_000,
      subject: wallet,
      chain: "base",
      period: `${from.toISOString().slice(0, 10)} to ${to.toISOString().slice(0, 10)}`,
      partial: true,
      rows: tokens.map(([symbol, realized, unrealized], index) => ({
        chain: "base",
        address: `0x${(index + 10).toString(16).padStart(2, "0").repeat(20)}`,
        symbol,
        realizedUsd: round(realized),
        unrealizedUsd: unrealized === null ? null : round(unrealized),
      })),
    },
  };
}
