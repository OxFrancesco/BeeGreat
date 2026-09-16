import type {
  MessagePageQuery,
  ThreadPageQuery,
  WebThread,
} from "./web-contract";
import type { WebSql } from "./web";

export const HISTORY_PAGE_SIZE = 40;
export const THREAD_PAGE_SIZE = 40;
type Scope = { userId: string; senderId: string; threadId?: string };
export const webOwner = ({ userId, senderId, threadId }: Scope) =>
  `stocks:${userId}:${senderId}${threadId ? `#${threadId}` : ""}`;
export type HistoryRow = {
  row_id: number;
  id: string;
  text: string;
  created_at: number;
  reply: string | null;
};
type ThreadRow = {
  owner: string;
  title: string;
  created_at: number;
  updated_at: number;
  turn_count: number;
};

export class WebHistory {
  constructor(private readonly sql: WebSql) {
    sql.exec(
      `CREATE TABLE IF NOT EXISTS basedbot_web_threads (owner TEXT PRIMARY KEY, account TEXT NOT NULL, title TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, turn_count INTEGER NOT NULL)`,
    );
    sql.exec(
      `CREATE INDEX IF NOT EXISTS basedbot_web_threads_account_page ON basedbot_web_threads(account,updated_at DESC,owner DESC)`,
    );
    sql.exec(
      `CREATE TABLE IF NOT EXISTS basedbot_web_thread_indexes (account TEXT PRIMARY KEY)`,
    );
    sql.exec(`CREATE TRIGGER IF NOT EXISTS basedbot_web_thread_insert AFTER INSERT ON basedbot_web_turns BEGIN
      INSERT INTO basedbot_web_threads(owner,account,title,created_at,updated_at,turn_count)
      VALUES(NEW.owner,CASE WHEN instr(NEW.owner,'#')>0 THEN substr(NEW.owner,1,instr(NEW.owner,'#')-1) ELSE NEW.owner END,substr(NEW.text,1,320),NEW.created_at,NEW.created_at,1)
      ON CONFLICT(owner) DO UPDATE SET
        title=CASE WHEN excluded.created_at<created_at THEN excluded.title ELSE title END,
        created_at=MIN(created_at,excluded.created_at),updated_at=MAX(updated_at,excluded.updated_at),turn_count=turn_count+1;
    END`);
    sql.exec(`CREATE TRIGGER IF NOT EXISTS basedbot_web_thread_delete AFTER DELETE ON basedbot_web_turns BEGIN
      UPDATE basedbot_web_threads SET turn_count=turn_count-1 WHERE owner=OLD.owner;
      DELETE FROM basedbot_web_threads WHERE owner=OLD.owner AND turn_count=0;
    END`);
  }

  private ensureIndexed(scope: Scope) {
    const account = webOwner({ ...scope, threadId: undefined });
    if (
      this.sql
        .exec(
          "SELECT account FROM basedbot_web_thread_indexes WHERE account=?",
          account,
        )
        .toArray().length
    )
      return;
    this.sql.exec(
      `INSERT OR REPLACE INTO basedbot_web_threads(owner,account,title,created_at,updated_at,turn_count)
      SELECT owner,?,(SELECT substr(first.text,1,320) FROM basedbot_web_turns AS first WHERE first.owner=turns.owner ORDER BY created_at ASC,rowid ASC LIMIT 1),MIN(created_at),MAX(created_at),COUNT(*)
      FROM basedbot_web_turns AS turns WHERE owner=? OR (owner>=? AND owner<?) GROUP BY owner`,
      account,
      account,
      `${account}#`,
      `${account}$`,
    );
    this.sql.exec(
      "INSERT OR IGNORE INTO basedbot_web_thread_indexes(account) VALUES(?)",
      account,
    );
  }

  private thread(row: ThreadRow, account: string): WebThread {
    return {
      id: row.owner === account ? null : row.owner.slice(account.length + 1),
      title: row.title.replace(/\s+/g, " ").trim().slice(0, 80),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      count: row.turn_count,
    };
  }

  threadFor(scope: Scope) {
    this.ensureIndexed(scope);
    const row = this.sql
      .exec<ThreadRow>(
        "SELECT * FROM basedbot_web_threads WHERE owner=?",
        webOwner(scope),
      )
      .toArray()[0];
    return row
      ? this.thread(row, webOwner({ ...scope, threadId: undefined }))
      : null;
  }

  threads(scope: Scope, page: ThreadPageQuery = {}) {
    this.ensureIndexed(scope);
    const account = webOwner({ ...scope, threadId: undefined });
    const cursor = page.before ?? page.after;
    const op = page.after ? ">" : "<";
    const order = page.after ? "ASC" : "DESC";
    const bindings: SqlStorageValue[] = [account];
    if (cursor)
      bindings.push(
        cursor.at,
        webOwner({ ...scope, threadId: cursor.id ?? undefined }),
      );
    const rows = this.sql
      .exec<ThreadRow>(
        `SELECT * FROM basedbot_web_threads WHERE account=? ${cursor ? `AND (updated_at,owner) ${op} (?,?)` : ""} ORDER BY updated_at ${order},owner ${order} LIMIT ${THREAD_PAGE_SIZE + 1}`,
        ...bindings,
      )
      .toArray();
    const more = rows.length > THREAD_PAGE_SIZE;
    const visible = rows.slice(0, THREAD_PAGE_SIZE);
    if (page.after) visible.reverse();
    const threads = visible.map((row) => this.thread(row, account));
    const first = threads[0],
      last = threads.at(-1);
    return {
      threads,
      olderCursor:
        last && (page.after || more)
          ? { at: last.updatedAt, id: last.id }
          : !last && page.after
            ? page.after
            : null,
      newerCursor:
        first && (page.before || (page.after && more))
          ? { at: first.updatedAt, id: first.id }
          : !first && page.before
            ? page.before
            : null,
    };
  }

  messages(
    scope: Scope,
    page: MessagePageQuery = {},
    limit = HISTORY_PAGE_SIZE,
  ) {
    const owner = webOwner(scope);
    const cursor = page.before ?? page.after;
    const op = page.after ? ">" : "<";
    const order = page.after ? "ASC" : "DESC";
    const bindings: SqlStorageValue[] = [owner];
    if (cursor) bindings.push(cursor.at, cursor.at, cursor.row);
    const rows = this.sql
      .exec<HistoryRow>(
        `SELECT rowid AS row_id,id,text,created_at,reply FROM basedbot_web_turns WHERE owner=? ${cursor ? `AND created_at ${op}= ? AND (created_at ${op} ? OR rowid ${op} ?)` : ""} ORDER BY created_at ${order},rowid ${order} LIMIT ${limit + 1}`,
        ...bindings,
      )
      .toArray();
    const more = rows.length > limit;
    const visible = rows.slice(0, limit);
    if (!page.after) visible.reverse();
    const first = visible[0],
      last = visible.at(-1);
    return {
      rows: visible,
      olderCursor:
        first && (page.after || more)
          ? { at: first.created_at, row: first.row_id }
          : !first && page.after
            ? page.after
            : null,
      newerCursor:
        last && (page.before || (page.after && more))
          ? { at: last.created_at, row: last.row_id }
          : !last && page.before
            ? page.before
            : null,
    };
  }
}
