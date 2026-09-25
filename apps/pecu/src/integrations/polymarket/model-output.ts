import { jsonInputSchema, isJsonObject, type JsonInput, type JsonFields } from "../../json-contract";
import { z } from "zod";
import type { PolymarketRead } from "./client";

const text = z.string().nullable().optional().catch(null);
const strings = z.union([
  z.array(z.string()),
  z.string().transform((value) => { try { return JSON.parse(value); } catch { return []; } }).pipe(z.array(z.string())),
]).catch([]);
const marketSchema = z.object({
  id: text, question: text, slug: text, conditionId: text, endDate: text, active: z.boolean().nullish().catch(null), closed: z.boolean().nullish().catch(null),
  outcomes: strings, outcomePrices: strings, clobTokenIds: strings,
  description: text, resolutionSource: text, volume: z.union([z.string(),z.number()]).nullish().catch(null), volume24hr:z.number().nullish().catch(null), liquidity:z.union([z.string(),z.number()]).nullish().catch(null), updatedAt:text, events: z.array(z.object({slug:text})).nullish().catch([]),
});
const eventSchema = z.object({id:text,title:text,slug:text,description:text,resolutionSource:text,markets:z.array(jsonInputSchema).nullish()});

export const polymarketTokenSchema = z.object({
  tokenId:z.string(), marketId:z.string().nullable(), slug:z.string().nullable(), title:z.string(),
  outcome:z.string(), endDate:z.string().nullable(), url:z.string().url().nullable(),
});
export type PolymarketToken = z.infer<typeof polymarketTokenSchema>;
const url = (slug: string | null | undefined) => slug ? `https://polymarket.com/event/${encodeURIComponent(slug)}` : null;
export const polymarketDiscovery = (endpoint: string) => ["search", "events", "markets"].includes(endpoint);

export function projectPolymarket(result: PolymarketRead, input?: JsonInput) {
  const tokens: PolymarketToken[] = [];
  const activeSearch = result.endpoint === "search" && z.object({events_status:z.literal("active")}).safeParse(input).success;
  const market = (value: JsonInput, eventSlug?: string | null, detail = false) => {
    const parsed = marketSchema.safeParse(value);
    if (!parsed.success) return {unavailable:"Invalid market record"};
    const m = parsed.data;
    const marketUrl = url(eventSlug ?? m.events?.[0]?.slug ?? m.slug);
    const outcomes = m.outcomes.map((label, index) => {
      const tokenId = m.clobTokenIds[index];
      const rawPrice = m.outcomePrices[index];
      const price = rawPrice?.trim() ? Number(rawPrice) : NaN;
      if (tokenId && m.question) tokens.push({ tokenId, marketId:m.id ?? null, slug:m.slug ?? null, title:m.question, outcome:label, endDate:m.endDate ?? null, url:marketUrl });
      return { label, price:Number.isFinite(price) && price >= 0 && price <= 1 ? price : null, token_id:tokenId ?? null };
    });
    const summary = { id:m.id, question:m.question, slug:m.slug, conditionId:m.conditionId, endDate:m.endDate, active:m.active, closed:m.closed, url:marketUrl, outcomes, volume:m.volume,volume24hr:m.volume24hr,liquidity:m.liquidity,updatedAt:m.updatedAt };
    return detail ? { ...summary, description:m.description, resolutionSource:m.resolutionSource } : summary;
  };
  const event = (value: JsonInput, detail = false) => {
    const parsed = eventSchema.safeParse(value);
    if (!parsed.success) return {unavailable:"Invalid event record"};
    const e = parsed.data;
    const sourceMarkets = e.markets ?? [];
    const visible = activeSearch ? sourceMarkets.filter(m => !z.object({closed:z.literal(true)}).safeParse(m).success) : sourceMarkets;
    const summary = { id:e.id,title:e.title,slug:e.slug,url:url(e.slug),filtered_closed_markets:sourceMarkets.length-visible.length,markets:visible.map(m=>market(m,e.slug)) };
    return detail ? { ...summary, description:e.description, resolutionSource:e.resolutionSource } : summary;
  };
  const root = isJsonObject(result.data) ? result.data : undefined;
  if (result.endpoint === "market" || result.endpoint === "market_by_slug") return {data:market(result.data,undefined,true),tokens};
  if (result.endpoint === "event" || result.endpoint === "event_by_slug") return {data:event(result.data,true),tokens};
  if (root && (result.endpoint === "search" || result.endpoint === "events")) {
    const events = root.events;
    return {data:{events:Array.isArray(events) ? events.map(e=>event(e)) : [], pagination:root.pagination, tags:root.tags, profiles:root.profiles},tokens};
  }
  if (root && result.endpoint === "markets") {
    const markets = root.markets;
    return {data:{markets:Array.isArray(markets) ? markets.map(m=>market(m)) : [], next_cursor:root.next_cursor},tokens};
  }
  return {data:result.data,tokens};
}

export const polymarketOutputBytes = 36_000;
const bytes = (value: JsonInput) => new TextEncoder().encode(JSON.stringify(value) ?? "null").length;

export function polymarketModelOutput(result: PolymarketRead, projected = projectPolymarket(result).data): string {
  const omitted: string[] = [];
  const omit = (path: string) => { if (omitted.length < 20) omitted.push(path.slice(0,120)); };
  function fit(value: JsonInput, budget: number, path: string): JsonInput {
    if (bytes(value) <= budget) return value;
    if (Array.isArray(value)) {
      const rows: JsonInput[] = [];
      for (let index=0; index<value.length; index++) {
        const remaining = budget - bytes(rows) - 1;
        if (remaining < 256) { omit(`${path}[${index}:]`); break; }
        const allocation = path === "data.events" ? Math.floor((budget - 2) / value.length) - 1 : remaining;
        rows.push(fit(value[index], Math.min(remaining, allocation), `${path}[${index}]`));
      }
      return rows;
    }
    if (isJsonObject(value)) {
      const output: JsonFields = {};
      for (const [key,item] of Object.entries(value)) {
        const remaining = budget - bytes(output) - bytes(key) - 2;
        if (remaining < 128) { omit(`${path}.${key}`); continue; }
        output[key] = fit(item, remaining, `${path}.${key}`);
      }
      return output;
    }
    omit(path);
    return null;
  }
  const envelope = {endpoint:result.endpoint,source:result.source,observedAt:result.observedAt,next:result.next};
  const data = fit(projected, Math.max(0, polymarketOutputBytes - bytes(envelope) - 4000), "data");
  const presentation = { source_bytes:bytes({ ...result }), partial:omitted.length>0, omitted_paths:omitted };
  return JSON.stringify({ ...envelope, data, presentation: omitted.length
    ? { ...presentation, recovery:"Use a returned event or market id/slug for a focused read; reduce the upstream page limit. Upstream next is separate from omitted fields on this page." }
    : presentation });
}
