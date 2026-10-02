import { z } from "zod";
import { ChainDataService, chainDataEndpoints, chainDataTool } from "../../src/integrations/chain-data";
import { resolveChainProfile } from "../../src/research/agents";
import { isJsonObject, type JsonValue } from "../../src/json-contract";

export const chains = ["Base", "Ethereum", "Arbitrum"] as const;
const chainName = z.enum(chains);
export const snapshotSchema = z.object({
  capturedAt: z.string(),
  entries: z.array(z.object({ name: z.enum(["chain_metric", "chain_dexes"]), chain: chainName, content: z.string() })),
});
export type Snapshot = z.infer<typeof snapshotSchema>;

export async function capture(): Promise<Snapshot> {
  const service = new ChainDataService();
  const resolve = async (query: string) => {
    const chain = await resolveChainProfile(query, service);
    if (!chain) throw new Error(`Unknown chain ${query}`);
    return chain;
  };
  const entries: Snapshot["entries"] = [];
  for (const chain of chains) {
    for (const name of ["metric", "dexes"] as const) {
      const input = name === "metric" ? { chain, metric: "tvl", days: 90 } : { chain, window: "7d", limit: 25 };
      entries.push({ name: `chain_${name}`, chain, content: await chainDataTool(service, resolve, name, input) });
    }
  }
  return { capturedAt: new Date().toISOString(), entries };
}

export const catalog = [
  { name: "chain_metric", ...chainDataEndpoints.metric },
  { name: "chain_dexes", ...chainDataEndpoints.dexes },
];

export function lookup(snapshot: Snapshot, name: string, raw: JsonValue): string {
  const tool = catalog.find(tool => tool.name === name);
  if (!tool) throw new Error(`Unknown or unavailable tool: ${name}`);
  const input = tool.input.parse(raw);
  const chain = chains.find(chain => chain.toLowerCase() === input.chain.toLowerCase());
  if (!chain) throw new Error("This benchmark supports Base, Ethereum and Arbitrum only.");
  if ("metric" in input && (input.metric !== "tvl" || input.days !== 90)) throw new Error("The captured metric is tvl with days=90.");
  if ("window" in input && (input.window !== "7d" || input.limit !== 25)) throw new Error("The captured DEX window is 7d with limit=25.");
  const entry = snapshot.entries.find(entry => entry.name === name && entry.chain === chain);
  if (!entry) throw new Error(`Snapshot is missing ${name} for ${chain}`);
  return entry.content;
}

const metricSchema = z.object({ current: z.number().nullable(), daily: z.array(z.tuple([z.string(), z.number().nullable()])) });
const dexSchema = z.object({ total: z.number(), rows: z.array(z.object({ name: z.string(), current: z.number() })) });
const metric = (snapshot: Snapshot, chain: string) => metricSchema.parse(JSON.parse(lookup(snapshot, "chain_metric", { chain, metric: "tvl", days: 90 })));
const dex = (snapshot: Snapshot, chain: string) => dexSchema.parse(JSON.parse(lookup(snapshot, "chain_dexes", { chain, window: "7d", limit: 25 })));

export type Scenario = { id: string; text: string; expected: JsonValue; minimumCalls: number };

export function scenarios(snapshot: Snapshot): Scenario[] {
  const latest = (chain: string) => metric(snapshot, chain).current;
  const means = chains.map(chain => {
    const values = metric(snapshot, chain).daily.flatMap(([, value]) => value === null ? [] : [value]);
    if (!values.length) throw new Error(`No non-null daily TVL values for ${chain}`);
    return { chain, mean: values.reduce((sum, value) => sum + value, 0) / values.length, count: values.length };
  }).sort((a, b) => b.mean - a.mean);
  const dexLeader = [...chains].sort((a, b) => dex(snapshot, b).total - dex(snapshot, a).total)[0];
  const topDex = dex(snapshot, dexLeader).rows.toSorted((a, b) => b.current - a.current).slice(0, 3).map(row => row.name);
  const current = Object.fromEntries(chains.map(chain => [chain, latest(chain)]));
  return [
    { id: "single-read", text: 'Get Base TVL on the final day. Return {"chain":"Base","tvl":number_or_null}.', expected: { chain: "Base", tvl: latest("Base") }, minimumCalls: 1 },
    { id: "parallel-reads", text: 'Get Base, Ethereum and Arbitrum TVL on the final day. Return {"Base":number_or_null,"Ethereum":number_or_null,"Arbitrum":number_or_null}.', expected: current, minimumCalls: 3 },
    { id: "dependent-research", text: 'Compare 7-day total DEX volume on Base, Ethereum and Arbitrum. For the chain with the highest total, get its TVL on the final day and list the top three returned DEX rows by current volume. Return {"chain":string,"tvl":number_or_null,"dexes":[names_in_descending_order]}.', expected: { chain: dexLeader, tvl: latest(dexLeader), dexes: topDex }, minimumCalls: 4 },
    { id: "large-aggregation", text: 'For Base, Ethereum and Arbitrum calculate mean TVL over all 90 returned days, excluding null days. Sort descending by mean. Return [{"chain":string,"mean":number,"count":number},...].', expected: means, minimumCalls: 3 },
    { id: "partial-failure", text: 'Get Base, Ethereum and Arbitrum TVL on the final day. Report a failed chain as null and include its name in unavailable. Do not retry failed calls. Return {"values":{"Base":number_or_null,"Ethereum":number_or_null,"Arbitrum":number_or_null},"unavailable":[chain_names]}.', expected: { values: { ...current, Arbitrum: null }, unavailable: ["Arbitrum"] }, minimumCalls: 3 },
  ];
}

// Compare against calculations outside the model and the Code Mode interpreter.
// Numeric tolerance is 0.1%; object fields, array order, nulls and counts still matter.
export function equivalent(left: JsonValue, right: JsonValue, ignoreNameCase = false): boolean {
  const numbers = z.tuple([z.number(), z.number()]).safeParse([left, right]);
  if (numbers.success) return Math.abs(numbers.data[0] - numbers.data[1]) <= Math.max(0.01, Math.abs(numbers.data[1]) * 0.001);
  const names = z.tuple([z.string(), z.string()]).safeParse([left, right]);
  if (ignoreNameCase && names.success) return names.data[0].toLowerCase() === names.data[1].toLowerCase();
  if (Array.isArray(left) && Array.isArray(right)) return left.length === right.length && left.every((value, index) => equivalent(value, right[index], ignoreNameCase));
  if (isJsonObject(left) && isJsonObject(right)) {
    return Object.keys(left).length === Object.keys(right).length && Object.keys(right).every(key => key in left && (key === "count" ? left[key] === right[key] : equivalent(left[key], right[key], ignoreNameCase)));
  }
  return left === right;
}
