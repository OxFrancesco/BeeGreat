import { jsonValueSchema, type JsonValue } from "../../src/json-contract";
import { mkdir, appendFile, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { z } from "zod";
import { NansenService, type NansenQuery, type NansenEndpointName } from "../../src/integrations/nansen";

const directory = resolve(process.argv[2] ?? "output/nansen-showcase");
const key = process.env.NANSEN_API_KEY;
if (!key) throw new Error("NANSEN_API_KEY is required");
await mkdir(directory, { recursive: true, mode: 0o700 });
const ledger = resolve(directory, "requests.jsonl");
const history = await readFile(ledger, "utf8").catch(() => "");
const recordSchema = z.object({ phase: z.enum(["started", "finished"]), id: z.number().int(), status: z.number().optional(), cost: z.number().optional() });
const records = history.trim() ? history.trim().split("\n").map((line) => recordSchema.parse(JSON.parse(line))) : [];
let attempts = records.filter((row) => row.phase === "started").length;
let credits = records.reduce((sum, row) => sum + (row.cost ?? 0), 0);
if (records.filter((row) => row.phase === "finished").length !== attempts) throw new Error("An earlier request has an unknown outcome. Inspect the ledger before resuming.");
let nextStart = Date.now();
let stopped = false;
const request: typeof fetch = Object.assign(async (input: string | URL | Request, init?: RequestInit) => {
  if (stopped || attempts >= 1000 || credits >= 1000) throw new Error("Batch request or credit ceiling reached");
  const id = ++attempts;
  const start = Math.max(Date.now(), nextStart);
  nextStart = start + 450;
  await appendFile(ledger, JSON.stringify({ phase: "started", id, at: new Date().toISOString(), url: String(input), body: init?.body }) + "\n");
  await Bun.sleep(Math.max(0, start - Date.now()));
  if (stopped) throw new Error("Batch stopped after upstream error");
  try {
    const response = await fetch(input, init);
    const reportedCost = response.headers.get("X-Nansen-Credits-Cost");
    const cost = reportedCost === null ? 1 : Number(reportedCost);
    if (!Number.isFinite(cost) || cost > 1) stopped = true;
    credits += Number.isFinite(cost) ? cost : 1;
    const body = await response.clone().text();
    await writeFile(resolve(directory, `response-${id}.json`), body, { mode: 0o600 });
    await appendFile(ledger, JSON.stringify({ phase: "finished", id, status: response.status, cost, remaining: response.headers.get("X-Nansen-Credits-Remaining"), at: new Date().toISOString() }) + "\n");
    if ([401, 402, 403, 429].includes(response.status)) stopped = true;
    return response;
  } catch (error) { stopped = true; throw error; }
}, { preconnect: fetch.preconnect });
const service = new NansenService(key, undefined, request);
const context: Parameters<NansenService["call"]>[2] = { wallet: "0x0000000000000000000000000000000000000000" };
const savedSchema = z.object({ endpoint: z.string(), input: z.record(z.string(), jsonValueSchema), result: z.object({ data: jsonValueSchema }).passthrough() });
async function collect(id: string, endpoint: NansenEndpointName, input: NansenQuery) {
  const file = resolve(directory, `${id}.json`);
  const existing = await Bun.file(file).exists();
  if (existing) return savedSchema.parse(await Bun.file(file).json()).result;
  if (stopped) throw new Error("Batch stopped; no retries are automatic");
  let result;
  try {
    if (endpoint === "token_screener") {
      const response = await request("https://api.nansen.ai/api/v1/token-screener", { method: "POST", headers: { apikey: key ?? "", "content-type": "application/json" }, body: JSON.stringify({ chains: [input.chain], timeframe: input.timeframe, pagination: { page: 1, per_page: 100 } }), signal: AbortSignal.timeout(25000) });
      if (!response.ok) throw new Error(`Screener HTTP ${response.status}`);
      result = { data: jsonValueSchema.parse(await response.json()) };
    } else result = await service.call(endpoint, input, context);
  } catch (error) {
    if (stopped) throw error;
    result = { data: null, error: error instanceof Error ? error.message : "Request failed" };
  }
  await writeFile(file, JSON.stringify({ endpoint, input, result }), { mode: 0o600 });
  console.log(JSON.stringify({ event: "collected", id, requests: attempts, credits }));
  return result;
}
const chains = ["base", "ethereum", "arbitrum", "optimism", "polygon"];
const tokenSchema = z.object({ token_address: z.string().regex(/^0x[0-9a-fA-F]{40}$/), token_symbol: z.string().default("Token") });
const rows = (data: JsonValue): JsonValue[] => {
  const parsed = z.object({ data: z.array(jsonValueSchema) }).safeParse(data);
  return parsed.success ? parsed.data.data : [];
};
const tokens: { chain: string; address: string; symbol: string }[] = [];
for (const chain of chains) {
  const found = new Map<string, { chain: string; address: string; symbol: string }>();
  for (const timeframe of ["24h", "7d"]) {
    const result = await collect(`screen-${chain}-${timeframe}`, "token_screener", { chain, timeframe, limit: 25 });
    for (const row of rows(result.data)) {
      const token = tokenSchema.safeParse(row);
      if (token.success) found.set(token.data.token_address.toLowerCase(), { chain, address: token.data.token_address, symbol: token.data.token_symbol });
    }
  }
  const selected = [...found.values()].slice(0, 30);
  if (selected.length !== 30) throw new Error(`Insufficient tokens on ${chain}: ${selected.length}`);
  tokens.push(...selected);
}
const ordered = Array.from({ length: 30 }, (_, index) => chains.flatMap((chain) => tokens.filter((token) => token.chain === chain).slice(index, index + 1))).flat();
tokens.splice(0, tokens.length, ...ordered);
await writeFile(resolve(directory, "tokens.json"), JSON.stringify(tokens));
const jobs = tokens.flatMap((token, index) => [
  { id: `token-${index}-info`, endpoint: "token_info", input: { chain: token.chain, token: token.address, timeframe: "1d" } },
  { id: `token-${index}-flows`, endpoint: "token_flow_intelligence", input: { chain: token.chain, token: token.address, timeframe: "1d" } },
  { id: `token-${index}-trades`, endpoint: "token_dex_trades", input: { chain: token.chain, token: token.address, days: 1, limit: 25 } },
  { id: `token-${index}-transfers`, endpoint: "token_transfers", input: { chain: token.chain, token: token.address, days: 1, limit: 25 } },
  { id: `token-${index}-price`, endpoint: "token_price", input: { chain: token.chain, token: token.address, days: 7, timeframe: "1h" } },
] satisfies { id: string; endpoint: NansenEndpointName; input: NansenQuery }[]);
async function workers(tasks: { id: string; endpoint: NansenEndpointName; input: NansenQuery }[]) {
  let cursor = 0;
  await Promise.all(Array.from({ length: 3 }, async () => {
    while (!stopped) {
      const job = tasks[cursor++];
      if (!job) return;
      await collect(job.id, job.endpoint, job.input);
    }
  }));
  if (stopped) throw new Error("Stopped on an upstream error. Inspect the ledger; no automatic retry.");
}
await workers(jobs);
const wallets = new Map<string, { chain: string; address: string }>();
const tradeSchema = z.object({ trader_address: z.string().regex(/^0x[0-9a-fA-F]{40}$/) });
for (let index = 0; index < tokens.length && wallets.size < 60; index++) {
  const token = tokens[index];
  if (!token) continue;
  const saved = savedSchema.parse(await Bun.file(resolve(directory, `token-${index}-trades.json`)).json());
  for (const value of rows(saved.result.data).slice(0, 3)) {
    const trade = tradeSchema.safeParse(value);
    if (trade.success && wallets.size < 60) wallets.set(trade.data.trader_address.toLowerCase(), { chain: token.chain, address: trade.data.trader_address });
  }
}
if (wallets.size !== 60) throw new Error(`Insufficient public trader wallets: ${wallets.size}`);
const walletList = [...wallets.values()];
await writeFile(resolve(directory, "wallets.json"), JSON.stringify(walletList));
await workers(walletList.flatMap((wallet, index) => [
  { id: `wallet-${index}-portfolio`, endpoint: "wallet_portfolio", input: { address: wallet.address } },
  { id: `wallet-${index}-pnl`, endpoint: "wallet_pnl_breakdown", input: { ...wallet, days: 30 } },
  { id: `wallet-${index}-transactions`, endpoint: "wallet_transactions", input: { ...wallet, days: 7, limit: 25 } },
]));
await writeFile(resolve(directory, "summary.json"), JSON.stringify({ requests: attempts, credits, tokens: tokens.length, wallets: walletList.length, completedAt: new Date().toISOString() }, null, 2));
if (attempts !== 1000) throw new Error(`Expected 1000 calls; recorded ${attempts}`);
console.log(JSON.stringify({ event: "complete", requests: attempts, credits }));
