import { expect, test } from "bun:test";
import { Database, type SQLQueryBindings } from "bun:sqlite";
import { PecuCards } from "../src/cards";
import { cardCollectionSchema } from "../src/cards-contract";
import type { WebSql } from "../src/web";

function fixture() {
  const db = new Database(":memory:");
  db.exec("PRAGMA foreign_keys=ON");
  const sql: WebSql = { exec: <R extends Record<string, SqlStorageValue>>(query: string, ...params: SqlStorageValue[]) => {
    if (query.startsWith("CREATE")) { db.exec(query); return { toArray: () => [] as R[] }; }
    const rows = db.query<R, SQLQueryBindings[]>(query).all(...params as SQLQueryBindings[]);
    return { toArray: () => rows };
  } };
  return { db, sql, cards: new PecuCards(sql) };
}
const viewer = { userId: "user_first", xId: "123" };

test("one grant persists across retries, reconnects, account changes, and restarts", () => {
  const { db, cards, sql } = fixture();
  const first = cardCollectionSchema.parse(cards.claim(viewer));
  expect(first.created).toBe(true);
  expect(first.cards).toHaveLength(1);
  expect(first.cards[0]!.copies).toBe(1);
  expect(first.remaining).toBe(2999);
  for (const next of [viewer, { ...viewer, xId: null }, { ...viewer, xId: "456" }]) {
    expect(cards.claim(next)).toEqual({ ...first, created: false });
  }
  expect(new PecuCards(sql).collection(viewer)).toEqual({ ...first, created: false });
  expect(cards.claim({ userId: "user_recreated", xId: "123" }).status).toBe("x_already_claimed");
  expect(cards.collection({ userId: "user_other", xId: null }).cards).toEqual([]);
  db.close();
});

test("no X connection cannot claim, and client-shaped invalid identities are rejected", () => {
  const { db, cards } = fixture();
  expect(cards.claim({ ...viewer, xId: null }).status).toBe("connect_x");
  expect(() => cards.claim({ ...viewer, xId: "someone" })).toThrow();
  expect(() => cards.claim({ ...viewer, userId: "" })).toThrow();
  expect(cards.collection(viewer).remaining).toBe(3000);
  db.close();
});

test("exactly 3000 unique recipients; designs may repeat across people", () => {
  const { db, cards } = fixture();
  const designs = new Set<number>();
  for (let i = 1; i <= 3000; i++) {
    const result = cards.claim({ userId: `user_${i}`, xId: String(i) });
    expect(result.edition).toBe(i);
    expect(result.created).toBe(true);
    designs.add(result.cards[0]!.id);
  }
  expect(designs.size).toBe(30);
  expect(cards.claim({ userId: "user_overflow", xId: "3001" }).status).toBe("sold_out");
  expect(cards.claim({ userId: "user_1", xId: "1" }).status).toBe("owned");
  expect(db.query("SELECT COUNT(*) AS n FROM pecu_card_inventory").get()).toEqual({ n: 3000 });
  db.close();
});

test("SQL enforces the ten-copy ceiling and rolls back failed inventory grants", () => {
  const { db, cards } = fixture();
  const first = cards.claim(viewer);
  const card = first.cards[0]!.id;
  db.query("UPDATE pecu_card_inventory SET copies=10 WHERE user_id=? AND card_id=?").run(viewer.userId, card);
  expect(() => db.query("UPDATE pecu_card_inventory SET copies=11 WHERE user_id=?").run(viewer.userId)).toThrow();
  expect(cards.collection(viewer).cards[0]!.copies).toBe(10);
  db.exec("CREATE TRIGGER reject_inventory BEFORE INSERT ON pecu_card_inventory BEGIN SELECT RAISE(ABORT,'test failure'); END");
  expect(() => cards.claim({ userId: "user_failed", xId: "999" })).toThrow();
  expect(cards.collection({ userId: "user_failed", xId: "999" }).status).toBe("eligible");
  expect(cards.collection(viewer).remaining).toBe(2999);
  db.close();
});
