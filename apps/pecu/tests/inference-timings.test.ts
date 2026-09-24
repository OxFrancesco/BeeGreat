import { Database } from "bun:sqlite";
import { expect, test } from "bun:test";
import { InferenceTimings, type TimingSql } from "../src/inference-timings";

test("request timings survive reconstruction and clear only the completed session window", () => {
  const db = new Database(":memory:");
  const sql: TimingSql = { exec: <R extends Record<string, SqlStorageValue>>(query: string, ...params: SqlStorageValue[]) => {
    const rows = db.query<R, (string | number | null | Uint8Array)[]>(query).all(...params.map((value) => value instanceof ArrayBuffer ? new Uint8Array(value) : value));
    return { toArray: () => rows };
  } };
  try {
    const timings = new InferenceTimings(sql);
    const first = timings.begin("session-a", "openrouter", "model", 1000);
    timings.response(first, 503, 2000);
    timings.begin("session-a", "openrouter", "model", 3000);
    timings.begin("session-b", "openai", "model", 1000);
    const restored = new InferenceTimings(sql);
    expect(restored.read("session-a", 1000)).toMatchObject([
      { started_at: 1000, response_at: 2000, status: 503 },
      { started_at: 3000, response_at: null, status: null },
    ]);
    restored.clear("session-a", 2000);
    expect(restored.read("session-a", 0)).toHaveLength(1);
    expect(restored.read("session-b", 0)).toHaveLength(1);
  } finally { db.close(); }
});
