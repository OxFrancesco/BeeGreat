import { resolve } from "node:path";
import { z } from "zod";
import { analyticsCents, analyticsOdds, type PolymarketSnapshot } from "../../src/analytics-contract";
import type { PolymarketEndpointName } from "../../src/integrations/polymarket/catalog.generated";
import { polymarketAnalytics } from "../../src/integrations/polymarket/analytics";
import { polymarketRead } from "../../src/integrations/polymarket/client";
import { polymarketShowcaseSchema, type PolymarketShowcase } from "../../apps/stocks/polymarket-showcase/schema";

let requests = 0;
async function card(endpoint: PolymarketEndpointName, input: Record<string, unknown>) {
  requests++;
  await Bun.sleep(150);
  const result = await polymarketRead(endpoint, input);
  return { data: result.data, snapshot: polymarketAnalytics(input, result) };
}
const tryCard = (endpoint: PolymarketEndpointName, input: Record<string, unknown>) => card(endpoint, input).catch((error: unknown) => {
  console.warn(`Skipped ${endpoint}: ${error instanceof Error ? error.message : String(error)}`);
  return undefined;
});

const prices = z.string().nullish().transform((value) => {
  try { return z.array(z.coerce.number()).parse(JSON.parse(value ?? "[]")); } catch { return []; }
});
const labels = z.string().nullish().transform((value) => {
  try { return z.array(z.string()).parse(JSON.parse(value ?? "[]")); } catch { return []; }
});
const market = z.object({ question: z.string(), slug: z.string().nullish(), groupItemTitle: z.string().nullish(), outcomes: labels, outcomePrices: prices, clobTokenIds: labels, closed: z.boolean().nullish(), endDate: z.string().nullish(), events: z.array(z.object({ slug: z.string().nullish() })).nullish() });
const event = z.object({ title: z.string(), slug: z.string(), endDate: z.string().nullish(), markets: z.array(market).nullish() });
const leaders = z.object({ data: z.array(z.object({ rank: z.number(), user_id: z.string(), user_name: z.string().nullish(), pnl: z.number().nullish() })) });

const soon = Date.now() + 3 * 86_400_000;
const later = (date: string | null | undefined) => !date || Date.parse(date) > soon;
const topic = (title: string) => title.toLowerCase().replace(/[^a-z0-9 ]/g, "").split(" ").slice(0, 3).join(" ");
const expectCard = <T extends PolymarketSnapshot["kind"]>(snapshot: PolymarketSnapshot | undefined, kind: T) => {
  if (snapshot?.kind !== kind) throw new Error(`Expected a ${kind} card`);
  return snapshot as Extract<PolymarketSnapshot, { kind: T }>;
};

const examples: PolymarketShowcase["examples"] = [];

const eventList = z.object({ events: z.array(event) }).parse((await card("events", { closed: false, order: "volume24hr", ascending: false, limit: 50 })).data);
const topics = new Set<string>();
for (const item of eventList.events) {
  if (examples.length >= 8) break;
  const open = (item.markets ?? []).filter((m) => !m.closed && m.clobTokenIds.length && m.outcomePrices.length);
  if (!open.length || !later(item.endDate) || topics.has(topic(item.title))) continue;
  const choices = open.length === 1
    ? open[0]!.outcomes.map((label, index) => ({ market: open[0]!, label, index, price: open[0]!.outcomePrices[index] ?? 0 }))
    : open.map((m) => ({ market: m, label: m.groupItemTitle || m.question, index: 0, price: m.outcomePrices[0] ?? 0 }));
  const lead = choices.toSorted((a, b) => b.price - a.price)[0];
  if (!lead || lead.price < 0.05 || lead.price > 0.95) continue;
  const odds = (await tryCard("event_by_slug", { slug: item.slug }))?.snapshot;
  const history = (await tryCard("prices_history", { token_id: lead.market.clobTokenIds[lead.index], interval: "1m", bucket_seconds: 43200, limit: 100 }))?.snapshot;
  if (odds?.kind !== "pm_odds" || history?.kind !== "pm_history" || history.points.length < 10) continue;
  topics.add(topic(item.title));
  examples.push({
    id: `odds-${item.slug}`, section: "odds", name: item.title, detail: `${lead.label} · ${analyticsOdds(lead.price)}`,
    question: `What are the Polymarket odds for "${item.title}"? Chart how ${lead.label} moved over the last month.`,
    note: "", snapshots: [odds, { ...history, title: lead.market.question, outcome: open.length === 1 ? lead.label : "Yes" }],
  });
}

const marketList = z.object({ markets: z.array(market) }).parse((await card("markets", { closed: false, order: "volume24hr", ascending: false, liquidity_num_min: 50000, limit: 60 })).data);
const bookEvents = new Set<string>();
for (const item of marketList.markets) {
  if (examples.filter((example) => example.section === "books").length >= 6) break;
  const price = item.outcomePrices[0] ?? 0, eventSlug = item.events?.[0]?.slug ?? item.slug ?? item.question;
  if (price < 0.08 || price > 0.92 || !later(item.endDate) || bookEvents.has(eventSlug) || !item.clobTokenIds[0]) continue;
  const book = (await tryCard("book", { token_id: item.clobTokenIds[0] }))?.snapshot;
  if (book?.kind !== "pm_book" || book.bids.length < 5 || book.asks.length < 5) continue;
  bookEvents.add(eventSlug);
  const outcome = item.outcomes[0] ?? "Yes";
  examples.push({
    id: `book-${item.slug ?? item.clobTokenIds[0]}`, section: "books", name: item.question, detail: `${outcome} · midpoint ${analyticsCents(book.midpoint)}`,
    question: `Show the Polymarket order book for ${outcome} on "${item.question}".`,
    note: "", snapshots: [{ ...book, title: item.question, outcome }],
  });
}

const boards = [
  { id: "week-pnl", name: "Profit this week", detail: "Weekly leaderboard", input: { time_period: "week", limit: 20 }, question: "Who are the top Polymarket traders by profit this week?" },
  { id: "month-pnl", name: "Profit this month", detail: "Monthly leaderboard", input: { time_period: "month", limit: 20 }, question: "Who made the most profit on Polymarket this month?" },
  { id: "all-pnl", name: "All-time profit", detail: "All-time leaderboard", input: { time_period: "all", limit: 20 }, question: "Show Polymarket's all-time profit leaderboard." },
  { id: "week-volume", name: "Volume this week", detail: "Weekly leaderboard", input: { time_period: "week", sort_by: "VOLUME", limit: 20 }, question: "Which Polymarket traders had the most volume this week?" },
] as const;
const leaderboardData: unknown[] = [];
for (const board of boards) {
  const read = await card("leaderboard", board.input);
  leaderboardData.push(read.data);
  examples.push({ id: board.id, section: "traders", name: board.name, detail: board.detail, question: board.question, note: "", snapshots: [expectCard(read.snapshot, "pm_leaderboard")] });
}
const wins = await card("biggest_winners", { time_period: "week", limit: 20 });
examples.push({ id: "week-wins", section: "traders", name: "Biggest wins this week", detail: "Resolved positions", question: "What were the biggest winning Polymarket positions this week?", note: "", snapshots: [expectCard(wins.snapshot, "pm_wins")] });

const seen = new Set<string>();
const traders = leaderboardData.slice(0, 2).flatMap((data, index) => leaders.parse(data).data.map((row) => ({ ...row, period: index === 0 ? "this week" : "this month" }))).filter((row) => (row.pnl ?? 0) > 0);
for (const trader of traders) {
  if (examples.filter((example) => example.section === "profiles").length >= 5) break;
  if (seen.has(trader.user_id)) continue;
  seen.add(trader.user_id);
  const positions = (await tryCard("positions", { user: trader.user_id, limit: 20, sort_by: "CURRENT_VALUE", filter_type: "CASH", filter_amount: 1 }))?.snapshot;
  if (positions?.kind !== "pm_positions" || positions.rows.length < 2) continue;
  const pnl = (await tryCard("user_pnl", { user: trader.user_id, interval: "1m", fidelity: "1d" }))?.snapshot;
  if (pnl?.kind !== "pm_trader" || pnl.points.length < 5) continue;
  const name = trader.user_name && !/^0x[0-9a-f]{40}/i.test(trader.user_name) ? trader.user_name : `${trader.user_id.slice(0, 6)}…${trader.user_id.slice(-4)}`;
  examples.push({
    id: `profile-${trader.user_id}`, section: "profiles", name, detail: `#${trader.rank} by profit ${trader.period}`,
    question: `Show the Polymarket P&L over the last month and the open positions for ${trader.user_id}.`,
    note: "Public wallet from Polymarket's profit leaderboard.", snapshots: [{ ...pnl, name }, positions],
  });
}

for (const section of ["odds", "books", "traders", "profiles"] as const) {
  if (!examples.some((example) => example.section === section)) throw new Error(`No ${section} examples collected`);
}
const output = polymarketShowcaseSchema.parse({ source: "polymarket", collectedAt: new Date().toISOString(), requests, examples });
await Bun.write(resolve(import.meta.dir, "../../apps/stocks/polymarket-showcase/data.json"), JSON.stringify(output));
console.log(JSON.stringify({ requests, examples: examples.length, sections: Object.fromEntries(["odds", "books", "traders", "profiles"].map((section) => [section, examples.filter((example) => example.section === section).length])) }));
