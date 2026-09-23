import { expect, test } from "bun:test";
import { Effect, Fiber, Schema } from "effect";
import { TestClock } from "effect/testing";
import { FetchHttpClient } from "effect/unstable/http";
import { polymarketEndpoints as endpoints } from "../src/integrations/polymarket/catalog.generated";
import { readEndpoint } from "../src/integrations/polymarket/client";
import { parseCommand } from "../src/domain";
import { polymarketText } from "../src/integrations/polymarket/presentation";

const wallet = "0x1111111111111111111111111111111111111111";
const condition = `0x${"a".repeat(64)}`;
function transport(respond: (url: string, init?: RequestInit) => Response | Promise<Response>) {
  const calls: string[] = [];
  const request: typeof fetch = Object.assign(async (url: RequestInfo | URL, init?: RequestInit) => {
    calls.push(String(url));
    expect(init?.method).toBe("GET");
    expect(new Headers(init?.headers).has("authorization")).toBe(false);
    return respond(String(url), init);
  }, { preconnect() {} });
  return { calls, layer: FetchHttpClient.layer, request };
}

function run<A, E>(effect: Effect.Effect<A, E, import("effect/unstable/http/HttpClient").HttpClient>, t: ReturnType<typeof transport>) {
  return Effect.runPromise(effect.pipe(Effect.provide(t.layer), Effect.provideService(FetchHttpClient.Fetch, t.request)));
}

test("v2 continuation retains filters even after an empty page", async () => {
  const t = transport(() => Response.json({ data: [], pagination: { limit: 3, offset: 0, has_more: true, next_cursor: "opaque-cursor" } }));
  const input = { user: wallet, condition, type: "TRADE", start: 100, end: 200, limit: 3 };
  const first = await run(readEndpoint(endpoints.activity, input), t);
  expect(first.next).toEqual({ endpoint: "activity", input: { ...input, cursor: "opaque-cursor" } });
  await run(readEndpoint(endpoints.activity, first.next?.input), t);
  expect(new URL(t.calls[1]).searchParams.get("condition")).toBe(condition);
  expect(new URL(t.calls[1]).searchParams.get("cursor")).toBe("opaque-cursor");
  expect(first.observedAt).toMatch(/^\d{4}-/);
});

test("Gamma keyset and repeated array filters preserve their own pagination vocabulary", async () => {
  const t = transport(() => Response.json({ markets: [], next_cursor: "next" }));
  const result = await run(readEndpoint(endpoints.markets, { tag_id: [1, 2], closed: false }), t);
  expect(new URL(t.calls[0]).searchParams.getAll("tag_id")).toEqual(["1", "2"]);
  expect(result.next?.input.after_cursor).toBe("next");
  expect(result.next?.input).not.toHaveProperty("cursor");
});

test("missing users stay null; malformed response envelopes fail", async () => {
  const t = transport(() => Response.json({ data: null }));
  const result = await run(readEndpoint(endpoints.user_stats, { user: wallet }), t);
  expect(result.data.data).toBeNull();
  expect(polymarketText(result)).toContain("No matching Polymarket record");
  const bad = transport(() => Response.json([]));
  const failure = await run(readEndpoint(endpoints.user_stats, { user: wallet }).pipe(Effect.result), bad);
  expect(failure._tag).toBe("Failure");
  if (failure._tag === "Failure") expect(failure.failure.kind).toBe("response");
  expect(bad.calls).toHaveLength(1);
});

test.each([
  ["positions", {}], ["activity", { user: "invalid" }], ["positions", { user: wallet, offset: 1 }],
  ["prices_history", { token_id: "123", interval: "1d", start: 100 }],
  ["prices_history", { token_id: "123", start: 0 }],
  ["holders", { condition: `${condition},${condition}`, include_pnl: true }],
  ["resolutions", { condition, event_id: "1" }],
  ["activity", { user: wallet, start: 200, end: 100 }],
] as const)("invalid %s request is rejected before network access", async (name, input) => {
  const t = transport(() => { throw new Error("Must not send"); });
  const result = await run(readEndpoint<unknown>(endpoints[name], input).pipe(Effect.result), t);
  expect(result._tag).toBe("Failure");
  expect(t.calls).toHaveLength(0);
});

test("CLOB price and midpoint accept the documented and observed contracts, but reject nonnumeric prices", async () => {
  for (const price of [0.42, "0.42"]) {
    const t = transport(() => Response.json({ price }));
    expect((await run(readEndpoint(endpoints.price, { token_id: "123", side: "BUY" }), t)).data.price).toBe(price);
  }
  for (const data of [{ mid: "0.42" }, { mid_price: "0.42" }]) {
    const t = transport(() => Response.json(data));
    expect((await run(readEndpoint(endpoints.midpoint, { token_id: "123" }), t)).data).toEqual(data);
  }
  expect(() => Schema.decodeUnknownSync(endpoints.price.response)({ price: "NaN" })).toThrow();
});

test("429 respects Retry-After and stops after two retries", async () => {
  const t = transport(() => new Response("busy", { status: 429, headers: { "Retry-After": "2" } }));
  await run(Effect.gen(function* () {
    const fiber = yield* readEndpoint(endpoints.status, {}).pipe(Effect.result, Effect.forkChild);
    yield* TestClock.adjust("1 second");
    expect(t.calls).toHaveLength(1);
    yield* TestClock.adjust("1 second");
    expect(t.calls).toHaveLength(2);
    yield* TestClock.adjust("2 seconds");
    const result = yield* Fiber.join(fiber);
    expect(t.calls).toHaveLength(3);
    expect(result._tag).toBe("Failure");
    if(result._tag === "Failure")expect(result.failure.status).toBe(429);
  }).pipe(Effect.provide(TestClock.layer())), t);
});

test("400 is not retried and timeouts abort the transport", async () => {
  const t = transport(() => new Response("bad request", { status: 400 }));
  await run(readEndpoint(endpoints.status, {}).pipe(Effect.result), t);
  expect(t.calls).toHaveLength(1);
  let aborted = false;
  const slow = transport((_url, init) => new Promise((_resolve, reject) => {
    init?.signal?.addEventListener("abort", () => { aborted = true; reject(new Error("aborted")); });
  }));
  await run(Effect.gen(function* () {
    const fiber = yield* readEndpoint(endpoints.status, {}).pipe(Effect.result, Effect.forkChild);
    yield* TestClock.adjust("21 seconds");
    const result = yield* Fiber.join(fiber);
    expect(result._tag).toBe("Failure");
    if(result._tag === "Failure")expect(result.failure.kind).toBe("timeout");
    expect(aborted).toBe(true);
  }).pipe(Effect.provide(TestClock.layer())), slow);
});

test("commands use direct search and preserve JSON spacing; research remains explicit", () => {
  expect(parseCommand("/polymarket Fed odds")).toEqual({ type: "polymarket-read", endpoint: "search", input: { q: "Fed odds", limit_per_type: 5 } });
  expect(parseCommand('/polymarket read search {"q":"Fed  odds"}')).toEqual({ type: "polymarket-read", endpoint: "search", input: { q: "Fed  odds" } });
  expect(parseCommand("/polymarket research Fed odds")).toEqual({ type: "polymarket", query: "Fed odds" });
  expect(parseCommand("/polymarket status")).toEqual({ type: "polymarket" });
  for(const name of ["order", "cancel_all", "__proto__", "constructor"])expect(() => parseCommand(`/polymarket read ${name} {}`)).toThrow();
});
