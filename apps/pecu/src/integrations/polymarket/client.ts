import { z } from "zod";
import { jsonValueSchema, type JsonInput, type JsonFields } from "../../json-contract";
import { Context, DateTime, Duration, Effect, Layer, Schedule, Schema } from "effect";
import { FetchHttpClient, HttpClient, HttpClientRequest } from "effect/unstable/http";
import { polymarketEndpoints, type PolymarketEndpointName } from "./catalog.generated";
import { type Endpoint, PolymarketError, validateFilters } from "./endpoint";

export interface PolymarketRead<A = JsonInput> {
  readonly endpoint: string;
  readonly source: string;
  readonly observedAt: string;
  readonly data: A;
  readonly next: { readonly endpoint: string; readonly input: JsonFields } | null;
}

const paginationSchema = z.object({
  next_cursor: z.string().optional().catch(undefined),
  hasMore: z.boolean().optional().catch(undefined),
});
const pageSchema = paginationSchema.extend({ pagination: paginationSchema.optional().catch(undefined) });

function continuation<A>(endpoint: Endpoint<A>, input: JsonFields, data: A): PolymarketRead["next"] {
  if (endpoint.pagination === "offset" && Array.isArray(data)) {
    const limit = Number(input.limit ?? 20);
    return data.length >= limit ? { endpoint: endpoint.name, input: { ...input, offset: Number(input.offset ?? 0) + limit } } : null;
  }
  const page = pageSchema.safeParse(data);
  if (!endpoint.pagination || !page.success) return null;
  const pagination = page.data.pagination ?? page.data;
  const key = endpoint.pagination;
  let next: string | number | undefined;
  if (key === "cursor" || key === "next_cursor") {
    const cursor = pagination.next_cursor;
    if (cursor !== undefined && cursor !== "" && cursor !== "LTE=") next = cursor;
  } else if (key === "after_cursor") {
    const cursor = page.data.next_cursor;
    if (cursor !== undefined && cursor !== "") next = cursor;
  } else if (key === "page" && pagination.hasMore === true) {
    next = Number(input.page ?? 1) + 1;
  }
  return next === undefined ? null : { endpoint: endpoint.name, input: { ...input, [key]: next } };
}

const backoff: Schedule.Schedule<Duration.Duration, PolymarketError> = Schedule.exponential("250 millis");
const retrySchedule = backoff.pipe(
  Schedule.upTo({ times: 2 }),
  Schedule.passthrough,
  Schedule.modifyDelay(({ input, duration }) => Effect.succeed(Duration.max(duration, Duration.millis(input.retryAfterMs ?? 0)))),
);

export const readEndpoint = Effect.fn("Polymarket.readEndpoint")(function* <A>(endpoint: Endpoint<A>, rawInput: JsonInput) {
  const input = yield* Effect.try({
    try: () => {
      const parsed = endpoint.input.parse(rawInput);
      validateFilters(endpoint.name, parsed);
      return parsed;
    },
    catch: cause => cause instanceof PolymarketError ? cause : new PolymarketError({ operation: endpoint.name, kind: "input", message: cause instanceof Error ? cause.message : "Invalid Polymarket parameters." }),
  });
  let path = endpoint.path;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined) continue;
    if (path.includes(`{${key}}`)) path = path.replace(`{${key}}`, encodeURIComponent(String(value)));
    else if (Array.isArray(value)) for (const item of value) params.append(key, String(item));
    else params.set(key, String(value));
  }
  if (endpoint.input.safeParse({ ...input, limit: 20 }).success && input.limit === undefined && !input.cursor && !input.after_cursor && !input.next_cursor) {
    params.set("limit", "20");
    input.limit = 20;
  }
  const url = `${endpoint.origin}${path}${params.size ? `?${params}` : ""}`;
  const client = yield* HttpClient.HttpClient;
  const request = Effect.gen(function* () {
    const response = yield* client.execute(HttpClientRequest.get(url).pipe(HttpClientRequest.acceptJson)).pipe(
      Effect.mapError(() => new PolymarketError({ operation: endpoint.name, kind: "transport", message: "Polymarket could not be reached." })),
    );
    if (response.status < 200 || response.status >= 300) {
      const retryAfter = response.headers["retry-after"];
      const seconds = retryAfter ? Number(retryAfter) : undefined;
      type HttpFailure = Pick<PolymarketError, "operation" | "kind" | "status" | "message" | "retryAfterMs" | "traceId">;
      let failure: HttpFailure = { operation: endpoint.name, kind: "http", status: response.status, message: `Polymarket returned HTTP ${response.status}.` };
      if (seconds !== undefined && Number.isFinite(seconds) && seconds >= 0) failure = { ...failure, retryAfterMs: seconds * 1000 };
      if (response.headers["x-trace-id"]) failure = { ...failure, traceId: response.headers["x-trace-id"] };
      return yield* Effect.fail(new PolymarketError(failure));
    }
    const json = yield* response.json.pipe(Effect.mapError(() => new PolymarketError({ operation: endpoint.name, kind: "response", message: "Polymarket returned invalid JSON." })));
    return yield* Schema.decodeUnknownEffect(endpoint.response)(json).pipe(
      Effect.mapError(() => new PolymarketError({ operation: endpoint.name, kind: "response", message: "Polymarket returned data that does not match its published contract." })),
    );
  }).pipe(Effect.retry({ schedule: retrySchedule, while: error => error.kind === "transport" || error.kind === "http" && [408, 429, 500, 502, 503, 504].includes(error.status ?? 0) }));
  const data = yield* request.pipe(
    Effect.timeout("20 seconds"),
    Effect.catchTag("TimeoutError", () => Effect.fail(new PolymarketError({ operation: endpoint.name, kind: "timeout", message: "Polymarket did not respond within 20 seconds. Try again later." }))),
  );
  const now = yield* DateTime.now;
  return { endpoint: endpoint.name, source: url, observedAt: DateTime.formatIso(now), data, next: continuation(endpoint, input, data) } satisfies PolymarketRead<A>;
});

export class Polymarket extends Context.Service<Polymarket, {
  readonly read: (endpoint: PolymarketEndpointName, input: JsonInput) => Effect.Effect<PolymarketRead, PolymarketError>;
}>()("Pecu/Polymarket") {}

export const polymarketLayer = Layer.effect(Polymarket, Effect.gen(function* () {
  const client = yield* HttpClient.HttpClient;
  return Polymarket.of({
    read: Effect.fn("Polymarket.read")(function* (name, input) {
      const endpoint = Object.hasOwn(polymarketEndpoints, name) ? polymarketEndpoints[name] : undefined;
      if (!endpoint) return yield* Effect.fail(new PolymarketError({ operation: String(name), kind: "input", message: "Unknown Polymarket read endpoint." }));
      const result = yield* readEndpoint<unknown>(endpoint, input).pipe(Effect.provideService(HttpClient.HttpClient, client));
      return { ...result, data: jsonValueSchema.parse(result.data) };
    }),
  });
}));

const liveLayer = polymarketLayer.pipe(Layer.provide(FetchHttpClient.layer));

export function polymarketRead(endpoint: PolymarketEndpointName, input: JsonInput): Promise<PolymarketRead> {
  return Effect.runPromise(Effect.gen(function* () {
    const service = yield* Polymarket;
    return yield* service.read(endpoint, input);
  }).pipe(Effect.provide(liveLayer)));
}
