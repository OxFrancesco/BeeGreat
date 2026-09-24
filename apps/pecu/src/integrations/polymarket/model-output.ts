import { z } from "zod";
import type { PolymarketRead } from "./client";

const text = z.string().nullable().optional().catch(null);
const strings = z.unknown().optional().transform((value): string[] => {
  let parsed: unknown = value;
  if (typeof value === "string") { try { parsed = JSON.parse(value); } catch { return []; } }
  return Array.isArray(parsed) && parsed.every((item): item is string => typeof item === "string") ? parsed : [];
});
const marketSchema = z.object({
  id: text, question: text, slug: text, conditionId: text, endDate: text, active: z.boolean().nullish().catch(null), closed: z.boolean().nullish().catch(null),
  outcomes: strings, outcomePrices: strings, clobTokenIds: strings,
  description: text, resolutionSource: text, volume: z.union([z.string(),z.number()]).nullish().catch(null), volume24hr:z.number().nullish().catch(null), liquidity:z.union([z.string(),z.number()]).nullish().catch(null), updatedAt:text, events: z.array(z.object({slug:text})).nullish().catch([]),
});
const eventSchema = z.object({id:text,title:text,slug:text,description:text,resolutionSource:text,markets:z.array(z.unknown()).nullish()});

export const polymarketTokenSchema = z.object({
  tokenId:z.string(), marketId:z.string().nullable(), slug:z.string().nullable(), title:z.string(),
  outcome:z.string(), endDate:z.string().nullable(), url:z.string().url().nullable(),
});
export type PolymarketToken = z.infer<typeof polymarketTokenSchema>;
const url = (slug: string | null | undefined) => slug ? `https://polymarket.com/event/${encodeURIComponent(slug)}` : null;
export const polymarketDiscovery = (endpoint: string) => ["search", "events", "markets"].includes(endpoint);

export function projectPolymarket(result: PolymarketRead, input?: unknown): { data: unknown; tokens: PolymarketToken[] } {
  const tokens: PolymarketToken[] = [];
  const activeSearch = result.endpoint === "search" && z.object({events_status:z.literal("active")}).safeParse(input).success;
  const market = (value: unknown, eventSlug?: string | null, detail = false): unknown => {
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
    return { id:m.id, question:m.question, slug:m.slug, conditionId:m.conditionId, endDate:m.endDate, active:m.active, closed:m.closed, url:marketUrl, outcomes, volume:m.volume,volume24hr:m.volume24hr,liquidity:m.liquidity,updatedAt:m.updatedAt,
      ...(detail ? {description:m.description,resolutionSource:m.resolutionSource} : {}) };
  };
  const event = (value: unknown, detail = false): unknown => {
    const parsed = eventSchema.safeParse(value);
    if (!parsed.success) return {unavailable:"Invalid event record"};
    const e = parsed.data;
    const sourceMarkets = e.markets ?? [];
    const visible = activeSearch ? sourceMarkets.filter(m => !z.object({closed:z.literal(true)}).safeParse(m).success) : sourceMarkets;
    return { id:e.id,title:e.title,slug:e.slug,url:url(e.slug),filtered_closed_markets:sourceMarkets.length-visible.length,markets:visible.map(m=>market(m,e.slug)), ...(detail ? {description:e.description,resolutionSource:e.resolutionSource} : {}) };
  };
  const root = z.record(z.string(),z.unknown()).safeParse(result.data);
  if (result.endpoint === "market" || result.endpoint === "market_by_slug") return {data:market(result.data,undefined,true),tokens};
  if (result.endpoint === "event" || result.endpoint === "event_by_slug") return {data:event(result.data,true),tokens};
  if (root.success && (result.endpoint === "search" || result.endpoint === "events")) {
    const events = root.data.events;
    return {data:{events:Array.isArray(events) ? events.map(e=>event(e)) : [], pagination:root.data.pagination, tags:root.data.tags, profiles:root.data.profiles},tokens};
  }
  if (root.success && result.endpoint === "markets") {
    const markets = root.data.markets;
    return {data:{markets:Array.isArray(markets) ? markets.map(m=>market(m)) : [], next_cursor:root.data.next_cursor},tokens};
  }
  return {data:result.data,tokens};
}

export const polymarketOutputBytes = 36_000;
const bytes = (value: unknown) => new TextEncoder().encode(JSON.stringify(value) ?? "null").length;

export function polymarketModelOutput(result: PolymarketRead, projected = projectPolymarket(result).data): string {
  const omitted: string[] = [];
  const omit = (path: string) => { if (omitted.length < 20) omitted.push(path.slice(0,120)); };
  function fit(value: unknown, budget: number, path: string): unknown {
    if (bytes(value) <= budget) return value;
    if (Array.isArray(value)) {
      const rows: unknown[] = [];
      for (let index=0; index<value.length; index++) {
        const remaining = budget - bytes(rows) - 1;
        if (remaining < 256) { omit(`${path}[${index}:]`); break; }
        const allocation = path === "data.events" ? Math.floor((budget - 2) / value.length) - 1 : remaining;
        rows.push(fit(value[index], Math.min(remaining, allocation), `${path}[${index}]`));
      }
      return rows;
    }
    if (typeof value === "object" && value !== null) {
      const output: Record<string,unknown> = {};
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
  return JSON.stringify({...envelope,data,presentation:{source_bytes:bytes(result),partial:omitted.length>0,omitted_paths:omitted,
    ...(omitted.length ? {recovery:"Use a returned event or market id/slug for a focused read; reduce the upstream page limit. Upstream next is separate from omitted fields on this page."} : {})}});
}
