import { resolve } from "node:path";
import { writeFile } from "node:fs/promises";
import { z } from "zod";
import { analyticsSnapshotSchema, analyticsTotal } from "../../src/analytics-contract";
import { showcaseSchema, type Showcase } from "../../apps/stocks/showcase/schema";
const directory = resolve(process.argv[2] ?? "output/nansen-showcase");
const tokens = z.array(z.object({ chain: z.string(), address: z.string(), symbol: z.string() })).parse(await Bun.file(resolve(directory, "tokens.json")).json());
const wallets = z.array(z.object({ chain: z.string(), address: z.string() })).parse(await Bun.file(resolve(directory, "wallets.json")).json());
const summary = z.object({ requests: z.number(), completedAt: z.string() }).parse(await Bun.file(resolve(directory, "summary.json")).json());
const resultSchema = z.object({ result: z.object({ analytics: z.object({ snapshot: analyticsSnapshotSchema }).optional() }) });
async function snapshot(id: string) {
  const parsed = resultSchema.safeParse(await Bun.file(resolve(directory, `${id}.json`)).json());
  return parsed.success ? parsed.data.result.analytics?.snapshot : undefined;
}
const examples: Showcase["examples"] = [];
const chains = new Map<string, number>();
const symbols = new Set<string>();
for (let index = 0; index < tokens.length; index++) {
  const token = tokens[index];
  if ((chains.get(token.chain) ?? 0) >= 3) continue;
  const symbolKey = `${token.chain}:${token.symbol}`;
  if (symbols.has(symbolKey)) continue;
  const data = await snapshot(`token-${index}-flows`);
  if (!data || data.kind !== "flows" || !data.rows.some((row) => row.netUsd !== null && row.netUsd !== 0)) continue;
  chains.set(token.chain, (chains.get(token.chain) ?? 0) + 1);
  symbols.add(symbolKey);
  examples.push({ id: `flow-${index}`, name: token.symbol, question: `Show ${token.symbol} (${token.address}) flows on ${token.chain} over the last 24 hours. Compare whales, exchanges and smart traders.`, note: "", snapshot: data });
}
function flowBalance(example: Showcase["examples"][number]) {
  if (example.snapshot.kind !== "flows") return 0;
  const amounts = example.snapshot.rows.map((row) => row.netUsd ?? 0);
  const positive = Math.max(0, ...amounts);
  const negative = Math.abs(Math.min(0, ...amounts));
  return Math.min(positive, negative) / Math.max(positive, negative, 1);
}
examples.sort((a, b) => flowBalance(b) - flowBalance(a));
let pnlCount = 0, portfolioCount = 0;
for (let index = 0; index < wallets.length; index++) {
  const wallet = wallets[index];
  const pnl = await snapshot(`wallet-${index}-pnl`);
  if (pnlCount < 6 && pnl?.kind === "pnl" && pnl.rows.length > 1 && pnl.rows.some((row) => (row.realizedUsd ?? 0) !== 0)) {
    pnlCount++;
    examples.push({ id: `pnl-${index}`, name: `Trader ${pnlCount}`, question: `Chart realized and unrealized P&L for ${wallet.address} on ${wallet.chain} over the last 30 days.`, note: "This public address appeared in the collected DEX trades.", snapshot: pnl });
  }
  const portfolio = await snapshot(`wallet-${index}-portfolio`);
  if (portfolioCount < 6 && portfolio?.kind === "portfolio" && (portfolio.balances?.length ?? 0) > 1 && (analyticsTotal((portfolio.balances ?? []).map((row) => row.valueUsd)) ?? 0) > 0) {
    portfolioCount++;
    examples.push({ id: `portfolio-${index}`, name: `Wallet ${portfolioCount}`, question: `Show the token allocation and DeFi exposure of ${wallet.address}. Keep assets and debt separate.`, note: "This public address appeared in the collected DEX trades.", snapshot: portfolio });
  }
}
const output = showcaseSchema.parse({ source: "nansen", collectedAt: summary.completedAt, requests: summary.requests, examples });
if (!examples.some((item) => item.snapshot.kind === "flows") || !pnlCount || !portfolioCount) throw new Error("Missing a required showcase example category");
await writeFile(resolve(import.meta.dir, "../../apps/stocks/showcase/data.json"), JSON.stringify(output));
console.log(JSON.stringify({ examples: examples.length, pnl: pnlCount, portfolios: portfolioCount }));
