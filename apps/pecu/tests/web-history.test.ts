import { expect, test } from "bun:test";
import { Database, type SQLQueryBindings } from "bun:sqlite";
import { WebHistory, webOwner } from "../src/web-history";
import type { WebSql } from "../src/web";
import {
  messagePageQuerySchema,
  threadPageQuerySchema,
} from "../src/web-contract";
const scope = { userId: "user_test", senderId: "123" };
function fixture() {
  const db = new Database(":memory:");
  db.exec(
    "CREATE TABLE basedbot_web_turns (id TEXT PRIMARY KEY,owner TEXT NOT NULL,text TEXT NOT NULL,created_at INTEGER NOT NULL,reply TEXT)",
  );
  db.exec(
    "CREATE INDEX basedbot_web_turns_owner ON basedbot_web_turns(owner,created_at)",
  );
  const queries: string[] = [];
  const sql: WebSql = {
    exec: <R extends Record<string, SqlStorageValue>>(
      query: string,
      ...params: SqlStorageValue[]
    ) => {
      queries.push(query);
      const rows = db
        .query<R, SQLQueryBindings[]>(query)
        .all(...params.map(value => value instanceof ArrayBuffer ? new Uint8Array(value) : value));
      return { toArray: () => rows };
    },
  };
  const insert = db.prepare(
    "INSERT OR IGNORE INTO basedbot_web_turns VALUES(?,?,?,?,NULL)",
  );
  return { db, sql, queries, insert };
}
test("100,000 legacy turns migrate once; indexed pages and summaries remain bounded", () => {
  const f = fixture();
  try {
    f.db.transaction(() => {
      for (let t = 0; t < 1000; t++)
        for (let m = 0; m < 100; m++)
          f.insert.run(
            `${t}:${m}`,
            webOwner({
              ...scope,
              threadId: `thread-${t.toString().padStart(4, "0")}`,
            }),
            `Message ${m}`,
            m,
          );
      f.insert.run("other", "stocks:user_other:123#private", "PRIVATE", 9999);
    })();
    const history = new WebHistory(f.sql);
    let page = history.threads(scope);
    expect(page.threads.length).toBe(40);
    expect(
      page.threads.every((t) => t.count === 100 && t.title === "Message 0"),
    ).toBe(true);
    const first = page;
    const ids = new Set(page.threads.map((t) => t.id));
    while (page.olderCursor) {
      page = history.threads(scope, { before: page.olderCursor });
      expect(page.threads.length).toBeLessThanOrEqual(40);
      for (const t of page.threads) {
        expect(ids.has(t.id)).toBe(false);
        ids.add(t.id);
      }
    }
    expect(ids.size).toBe(1000);
    const second = history.threads(scope, { before: first.olderCursor! });
    expect(
      history.threads(scope, { after: second.newerCursor! }).threads,
    ).toEqual(first.threads);
    const prior = f.queries.length;
    const reopened = new WebHistory(f.sql);
    expect(
      reopened.threadFor({ ...scope, threadId: "thread-0999" })?.count,
    ).toBe(100);
    expect(f.queries.slice(prior).some((q) => q.includes("GROUP BY"))).toBe(
      false,
    );
    const plan = f.db
      .query<{ detail: string }, []>(
        "EXPLAIN QUERY PLAN SELECT * FROM basedbot_web_threads WHERE account='stocks:user_test:123' AND (updated_at,owner)<(99,'stocks:user_test:123#thread-0500') ORDER BY updated_at DESC,owner DESC LIMIT 41",
      )
      .all();
    expect(
      plan.some((p) =>
        p.detail.includes("USING INDEX basedbot_web_threads_account_page"),
      ),
    ).toBe(true);
  } finally {
    f.db.close();
  }
});
test("message cursors traverse tied timestamps in both directions without skips or duplicates", () => {
  const f = fixture();
  try {
    const history = new WebHistory(f.sql);
    for (let i = 0; i < 105; i++)
      f.insert.run(
        `message-${i}`,
        webOwner(scope),
        `Message ${i}`,
        Math.floor(i / 50),
      );
    f.insert.run(
      "private",
      webOwner({ ...scope, threadId: "private" }),
      "PRIVATE",
      1,
    );
    const latest = history.messages(scope);
    expect(latest.rows.length).toBe(40);
    expect(latest.newerCursor).toBeNull();
    const middle = history.messages(scope, { before: latest.olderCursor! });
    const oldest = history.messages(scope, { before: middle.olderCursor! });
    expect(oldest.rows.length).toBe(25);
    expect(oldest.olderCursor).toBeNull();
    expect(
      new Set([...oldest.rows, ...middle.rows, ...latest.rows].map((r) => r.id))
        .size,
    ).toBe(105);
    expect(
      history.messages(scope, { after: middle.newerCursor! }).rows,
    ).toEqual(latest.rows);
    expect(history.messages(scope, { before: { at: 0, row: 1 } }).rows).toEqual(
      [],
    );
    expect(
      history.messages(
        { ...scope, userId: "user_other" },
        { before: latest.olderCursor! },
      ).rows,
    ).toEqual([]);
    f.db.run(
      "UPDATE basedbot_web_turns SET id='retried' WHERE id='message-104'",
    );
    expect(history.messages(scope).rows.at(-1)?.id).toBe("retried");
  } finally {
    f.db.close();
  }
});
test("summary triggers preserve counts across inserts, retries, restart and full deletion", () => {
  const f = fixture();
  try {
    const history = new WebHistory(f.sql);
    expect(history.threads(scope).threads).toEqual([]);
    f.insert.run("one", webOwner(scope), "First message", 1);
    f.insert.run("one", webOwner(scope), "duplicate", 1);
    f.insert.run("two", webOwner(scope), "Second message", 2);
    expect(history.threadFor(scope)).toMatchObject({
      title: "First message",
      count: 2,
      updatedAt: 2,
    });
    f.db.run(
      "UPDATE basedbot_web_turns SET reply='reply',id='retry' WHERE id='two'",
    );
    expect(new WebHistory(f.sql).threadFor(scope)?.count).toBe(2);
    f.db.run("DELETE FROM basedbot_web_turns WHERE owner=?", [webOwner(scope)]);
    expect(history.threads(scope).threads).toEqual([]);
    f.insert.run("three", webOwner(scope), "New history", 3);
    expect(history.threadFor(scope)).toMatchObject({
      title: "New history",
      count: 1,
    });
  } finally {
    f.db.close();
  }
});
test("rejects ambiguous or forged pagination shapes", () => {
  expect(
    messagePageQuerySchema.safeParse({ before: { at: 0, row: 0 } }).success,
  ).toBe(false);
  expect(
    messagePageQuerySchema.safeParse({
      before: { at: 1, row: 1 },
      after: { at: 2, row: 2 },
    }).success,
  ).toBe(false);
  expect(
    threadPageQuerySchema.safeParse({ before: { at: 1, id: "../private" } })
      .success,
  ).toBe(false);
  expect(threadPageQuerySchema.safeParse({ owner: "other" }).success).toBe(
    false,
  );
});
