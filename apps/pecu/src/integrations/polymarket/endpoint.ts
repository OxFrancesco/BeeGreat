import { Schema } from "effect";
import type { z } from "zod";

export class PolymarketError extends Schema.TaggedError<PolymarketError>()("PolymarketError", {
  operation: Schema.String,
  message: Schema.String,
  kind: Schema.Literals(["input", "transport", "http", "response", "timeout"]),
  status: Schema.optionalKey(Schema.Number),
  retryAfterMs: Schema.optionalKey(Schema.Number),
  traceId: Schema.optionalKey(Schema.String),
}) {}

export interface Endpoint<A> {
  readonly name: string;
  readonly origin: string;
  readonly path: string;
  readonly description: string;
  readonly input: z.ZodType<Record<string, unknown>>;
  readonly response: Schema.Codec<A>;
  readonly pagination?: "cursor" | "after_cursor" | "next_cursor" | "page" | "offset";
}

export function defineEndpoint<A, I extends z.ZodType<Record<string, unknown>>>(endpoint: Endpoint<A> & { readonly input: I }) {
  return endpoint;
}

export function validateFilters(name: string, input: Record<string, unknown>): void {
  const fail = (message: string): never => { throw new PolymarketError({ operation: name, kind: "input", message }); };
  const selectors = [input.question_id, input.condition, input.event_id].filter(value => value !== undefined);
  if (name === "resolutions" && selectors.length !== 1) fail("Supply exactly one of question_id, condition, or event_id.");
  if (name === "positions") {
    if (!input.user && !input.condition && !input.cursor) fail("Positions require a Polymarket wallet, condition, or continuation cursor.");
    if (!input.user && typeof input.condition === "string" && input.condition.includes(",")) fail("Market positions require exactly one condition.");
    if (input.status === "REDEEMABLE_LOST" && !input.user && !input.cursor) fail("Losing redeemable positions require a Polymarket wallet.");
    if (input.status === "CLOSED" && input.include_archived) fail("Closed positions cannot include archived markets.");
  }
  if (name === "activity" && input.condition && input.event_id) fail("Choose condition or event_id, not both.");
  if (name === "holders" && input.include_pnl && typeof input.condition === "string" && input.condition.includes(",")) fail("Holder PnL requires exactly one condition.");
  if (name === "prices_history") {
    const windows = [input.start, input.interval, input.as_of].filter(value => value !== undefined);
    if (windows.length !== 1 && !input.cursor) fail("Price history requires one of start, interval, or as_of.");
    if (windows.length > 1 || input.end !== undefined && input.start === undefined) fail("Use one price-history window; end requires start.");
    if (typeof input.start === "number" && typeof input.end === "number" && input.end - input.start > 15 * 86400) fail("Explicit price-history windows cannot exceed 15 days. Use interval max for longer history.");
  }
  for (const [start, end] of [["start", "end"], ["updated_after", "updated_before"]]) {
    const from = input[start], to = input[end];
    if (typeof from === "number" && typeof to === "number" && from > to) fail(`${start} must not be later than ${end}.`);
  }
}
