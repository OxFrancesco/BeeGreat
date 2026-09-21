import type { AnalyticsSnapshot } from "../../../../../src/analytics-contract";

const subject = "0x1111111111111111111111111111111111111111";
const base = { observedAt: Date.UTC(2026, 8, 21, 8), subject, chain: "base", period: "1d", partial: false };
export const analyticsFixtures: AnalyticsSnapshot[] = [
  { ...base, key: "flows", kind: "flows", rows: [
    { label: "Smart traders", netUsd: 1400000, wallets: 32 },
    { label: "Whales", netUsd: 900000, wallets: 8 },
    { label: "Exchanges", netUsd: -600000, wallets: null },
    { label: "Fresh wallets", netUsd: 250000, wallets: null },
    { label: "Top P&L", netUsd: -180000, wallets: 14 },
    { label: "Public figures", netUsd: 35000, wallets: 4 },
  ] },
  { ...base, key: "pnl", kind: "pnl", period: "2026-08-22 to 2026-09-21", rows: [
    { chain: "base", address: "0x2222222222222222222222222222222222222222", symbol: "AERO", realizedUsd: 420, unrealizedUsd: 80 },
    { chain: "base", address: "0x3333333333333333333333333333333333333333", symbol: "ETH", realizedUsd: 180, unrealizedUsd: -130 },
    { chain: "base", address: "0x4444444444444444444444444444444444444444", symbol: "VIRTUAL", realizedUsd: -260, unrealizedUsd: -50 },
    { chain: "base", address: "0x5555555555555555555555555555555555555555", symbol: "DEGEN", realizedUsd: -90, unrealizedUsd: 10 },
  ] },
  { ...base, key: "portfolio", kind: "portfolio", chain: "all", period: "Current", balances: [
    { chain: "base", address: "native", symbol: "ETH", amount: 1.5, valueUsd: 4500 },
    { chain: "base", address: "0x2222222222222222222222222222222222222222", symbol: "USDC", amount: 3000, valueUsd: 3000 },
    { chain: "base", address: "0x3333333333333333333333333333333333333333", symbol: "AERO", amount: 1500, valueUsd: 1500 },
    { chain: "ethereum", address: "0x4444444444444444444444444444444444444444", symbol: "USDC", amount: 1000, valueUsd: 1000 },
  ], defi: { assetsUsd: 6000, debtUsd: 1000, netUsd: 5000, rewardsUsd: 35, protocols: [
    { name: "Aave", chain: "base", assetsUsd: 4000, debtUsd: 1000, netUsd: 3000 },
    { name: "Aerodrome", chain: "base", assetsUsd: 2000, debtUsd: 0, netUsd: 2000 },
  ] } },
  { ...base, key: "missing", kind: "flows", partial: true, rows: [{ label: "Smart traders", netUsd: null, wallets: null }, { label: "Whales", netUsd: 0, wallets: 0 }] },
  { ...base, key: "empty", kind: "pnl", rows: [] },
  { ...base, key: "partial-portfolio", kind: "portfolio", partial: true, balances: null, defi: { assetsUsd: 100, debtUsd: 150, netUsd: -50, rewardsUsd: null, protocols: [{ name: "Lending", chain: "base", assetsUsd: 100, debtUsd: 150, netUsd: -50 }] } },
];
