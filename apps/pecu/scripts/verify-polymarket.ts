import type { Endpoint } from "../src/integrations/polymarket/endpoint";
import type { JsonInput, JsonFields } from "../src/json-contract";
import { Effect, Schema } from "effect";
import { FetchHttpClient } from "effect/unstable/http";
import { polymarketEndpoints, polymarketEndpointNames } from "../src/integrations/polymarket/catalog.generated";
import { readEndpoint } from "../src/integrations/polymarket/client";

const directory = process.argv[2] ?? "/tmp/pecu-polymarket-verification";
const markets = await fetch("https://gamma-api.polymarket.com/markets/keyset?closed=false&limit=1").then(r => r.json());
const market = Schema.decodeUnknownSync(polymarketEndpoints.markets.response)(markets).markets[0];
if (!market?.id || !market.conditionId || !market.clobTokenIds || !market.slug) throw new Error("No live market for verification");
const tokens = Schema.decodeUnknownSync(Schema.Array(Schema.String))(JSON.parse(market.clobTokenIds));
const events = Schema.decodeUnknownSync(polymarketEndpoints.events.response)(await fetch("https://gamma-api.polymarket.com/events/keyset?closed=false&limit=1").then(r => r.json()));
const event = events.events[0];
if (!event?.id || !event.slug) throw new Error("No live event for verification");
const user = "0x983eedfbd75803602e4a6e6ea9aab6dc6b9c6748";
const report: unknown[] = [];
let failures = 0;
const selected = process.argv.slice(3);
const names = selected.length ? polymarketEndpointNames.filter(name => selected.includes(name)) : polymarketEndpointNames;
for (const name of names) {
 const endpoint: Endpoint<unknown> = polymarketEndpoints[name];
 const input: JsonFields = {};
 const accepts = (key: string, value: JsonInput) => endpoint.input.safeParse({ ...input, [key]: value }).success;
 if (endpoint.path.includes("{id}")) input.id = name.startsWith("event") ? event.id : name.startsWith("market") ? market.id : name === "series_detail" ? "1" : "2";
 if (endpoint.path.includes("{slug}")) input.slug = name.startsWith("event") ? event.slug : name.startsWith("market") ? market.slug : "politics";
 if (endpoint.path.includes("{condition_id}")) input.condition_id = market.conditionId;
 if (name === "search") input.q = "Fed";
 if (name === "profile") input.address = user;
 if (["activity","activity_combos","approvals","positions_combos","user_pnl","user_stats","user_volume","value"].includes(name)) input.user = user;
 if (["positions","holders","oi","resolutions","trades"].includes(name)) input.condition = market.conditionId;
 if (name === "live_volume") input.event_id = event.id;
 if (["book","price","midpoint","spread","last_trade_price","fee_rate","tick_size","negative_risk","market_by_token","prices_history"].includes(name)) input.token_id = tokens[0];
 if (name === "price") input.side = "BUY";
 if (name === "prices_history") input.interval = "1d";
 if (accepts("limit", 2)) input.limit = 2;
 if (accepts("limit_per_type", 2)) input.limit_per_type = 2;
 const result = await Effect.runPromise(readEndpoint<unknown>(endpoint, input).pipe(Effect.provide(FetchHttpClient.layer), Effect.result));
 if (result._tag === "Success") {
   await Bun.write(`${directory}/${name}.json`, JSON.stringify(result.success, null, 2));
   report.push({ name, ok: true, source: result.success.source, observedAt: result.success.observedAt, hasNext: result.success.next !== null });
   console.log(`PASS ${name}`);
   if (["markets","events","trades","leaderboard","prices_history","positions"].includes(name) && result.success.next) {
     const next = await Effect.runPromise(readEndpoint<unknown>(endpoint, result.success.next.input).pipe(Effect.provide(FetchHttpClient.layer), Effect.result));
     const ok = next._tag === "Success";
     if (!ok) failures++;
     report.push(next._tag === "Failure" ? { name: `${name}:next`, ok, error: String(next.failure) } : { name: `${name}:next`, ok });
     console.log(`${ok ? "PASS" : "FAIL"} ${name}:next`);
   }
 } else {
   failures++;
   report.push({ name, ok: false, error: String(result.failure) });
   console.log(`FAIL ${name}: ${result.failure.message}`);
   if(result.failure.kind === "response") {
     let path=endpoint.path;
     const params=new URLSearchParams();
     for(const [key,value] of Object.entries(input)) if(path.includes(`{${key}}`))path=path.replace(`{${key}}`,encodeURIComponent(String(value)));else params.set(key,String(value));
     const raw=await fetch(`${endpoint.origin}${path}?${params}`).then(r=>r.json());
     await Bun.write(`${directory}/${name}-mismatch.json`,JSON.stringify(raw,null,2));
     const decoded=await Effect.runPromise(Schema.decodeUnknownEffect(endpoint.response)(raw).pipe(Effect.result));
     if(decoded._tag === "Failure")console.log(String(decoded.failure).slice(0,1800));
   }
 }
}
await Bun.write(`${directory}/report.json`, JSON.stringify({ checkedAt: new Date().toISOString(), failures, endpoints: report }, null, 2));
console.log(`${names.length} endpoints checked; ${failures} failures.`);
if(failures)process.exitCode=1;
