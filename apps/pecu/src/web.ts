import { needsChatGptConnection } from "./inference-recovery";
import { aeroReadText, intentTitle } from "./chat";
import { WebHistory, type HistoryRow } from "./web-history";
import type { MessagePageQuery, ThreadPageQuery } from "./web-contract";
import { parseAllocations } from "../node_modules/@beegreat/sugar/src/stocks/catalog";
import type { z } from "zod";
import type { PecuAgent } from "./agent";
import type { PecuStore } from "./state";
import { senderKind } from "./web-identity";
import type { ParagraphSink } from "./web-stream";
import { pnlSnapshotSchema, type PnlSnapshot } from "./analytics-contract";
import {
  basketSchema,
  webReplySchema,
  type webIdentitySchema,
  type webScopeSchema,
  type webTurnSchema,
  type PnlDays,
  type WebPnl,
  type WebState,
  type WebThread,
} from "./web-contract";

export const pnlCacheMs = 10 * 60_000;

export interface WebSql {
  exec<Row extends Record<string, SqlStorageValue>>(
    query: string,
    ...bindings: SqlStorageValue[]
  ): { toArray(): Row[] };
}

type Identity = z.infer<typeof webIdentitySchema>;
type Scope = z.infer<typeof webScopeSchema>;
type Turn = z.infer<typeof webTurnSchema>;
export class WebAgent {
  private readonly history: WebHistory;
  private readonly active = new Set<string>();
  private readonly pnlReads = new Map<string, Promise<PnlSnapshot>>();
  constructor(
    private readonly agent: PecuAgent,
    private readonly store: PecuStore,
    private readonly sql: WebSql,
  ) {
    sql.exec(
      `CREATE TABLE IF NOT EXISTS basedbot_web_turns (id TEXT PRIMARY KEY, owner TEXT NOT NULL, text TEXT NOT NULL, created_at INTEGER NOT NULL, reply TEXT)`,
    );
    sql.exec(
      `CREATE INDEX IF NOT EXISTS basedbot_web_turns_owner ON basedbot_web_turns(owner,created_at)`,
    );
    sql.exec(
      `CREATE TABLE IF NOT EXISTS basedbot_web_retries (id TEXT PRIMARY KEY, target TEXT NOT NULL, context TEXT NOT NULL)`,
    );
    sql.exec(
      `CREATE TABLE IF NOT EXISTS basedbot_web_profiles (owner TEXT PRIMARY KEY, stocks TEXT, stocks_at INTEGER, basket TEXT)`,
    );
    sql.exec(
      `CREATE TABLE IF NOT EXISTS basedbot_web_pnl (wallet TEXT NOT NULL, days INTEGER NOT NULL, snapshot TEXT NOT NULL, PRIMARY KEY(wallet, days))`,
    );
    this.history = new WebHistory(sql);
  }
  /**
   * The original web conversation keeps its `stocks:` owner so existing
   * history, YOLO settings and pending previews stay attached. Extra threads
   * append `#threadId`; the agent treats each owner as its own conversation.
   */
  private owner({ userId, senderId, threadId }: Scope) {
    const base = `stocks:${userId}:${senderId}`;
    return threadId ? `${base}#${threadId}` : base;
  }
  threads(identity: Identity): WebThread[] {
    return this.history.threads(identity).threads;
  }
  threadPage(identity: Identity, page: ThreadPageQuery = {}) {
    return this.history.threads(identity, page);
  }
  private presentMessage(row: HistoryRow) {
    const reply = row.reply
      ? webReplySchema.parse(JSON.parse(row.reply))
      : null;
    const intent = this.store.intentForSource(row.id);
    if (reply?.preview && intent) {
      reply.preview.state =
        intent.state === "pending" && intent.expiresAt < Date.now()
          ? "expired"
          : intent.state;
      reply.preview.title ??= intentTitle(intent);
      if (intent.result !== undefined && (reply.preview.state === "succeeded" || reply.preview.state === "failed")) {
        reply.preview.result = intent.result;
      }
    }
    return {
      id: row.id,
      text: row.text,
      createdAt: row.created_at,
      reply,
      canRetry:
        Boolean(reply) &&
        !intent &&
        !/^(?:b)?\/|^(?:confirm|cancel)$/i.test(row.text.trim()),
    };
  }
  messagePage(scope: Scope, page: MessagePageQuery = {}) {
    const { rows, ...cursors } = this.history.messages(scope, page);
    return {
      messages: rows.map((row) => this.presentMessage(row)),
      ...cursors,
    };
  }
  deleteThread(identity: Identity, threadId: string | null) {
    const owner = this.owner({ ...identity, threadId: threadId ?? undefined });
    if (this.active.has(owner))
      throw new Error(
        "Pecu is still answering in this thread. Try again in a moment.",
      );
    if (
      this.store
        .executingIntents()
        .some(
          (intent) =>
            intent.senderId === identity.senderId &&
            intent.conversationId === owner,
        )
    )
      throw new Error(
        "Check the submitted transaction before deleting this thread.",
      );
    this.sql.exec("DELETE FROM basedbot_web_turns WHERE owner=?", owner);
  }
  state(scope: Scope, paged = false): WebState {
    const owner = this.owner(scope);
    const identity = { userId: scope.userId, senderId: scope.senderId };
    const profile = this.sql
      .exec<{
        stocks: string | null;
        stocks_at: number | null;
        basket: string | null;
      }>(
        "SELECT * FROM basedbot_web_profiles WHERE owner=?",
        this.owner(identity),
      )
      .toArray()[0];
    const { rows, ...cursors } = this.history.messages(
      scope,
      {},
      paged ? 40 : 100,
    );
    const messages = rows.map((row) => this.presentMessage(row));
    return {
      wallet: this.store.wallet(identity.senderId)?.address ?? null,
      senderKind: senderKind(identity.senderId),
      yolo: this.store.yoloEnabled(identity.senderId, owner),
      threadId: scope.threadId ?? null,
      ...(paged ? {} : { threads: this.threads(identity) }),
      thread: this.history.threadFor(scope),
      ...cursors,
      messages,
      stocks: profile?.stocks ?? null,
      stocksAt: profile?.stocks_at ?? null,
      basket: profile?.basket
        ? basketSchema.parse(JSON.parse(profile.basket))
        : null,
    };
  }
  saveBasket(identity: Identity, basket: z.infer<typeof basketSchema>) {
    parseAllocations(basket.allocations);
    this.sql.exec(
      "INSERT INTO basedbot_web_profiles(owner,basket) VALUES(?,?) ON CONFLICT(owner) DO UPDATE SET basket=excluded.basket",
      this.owner(identity),
      JSON.stringify(basket),
    );
  }
  async pnl(identity: Identity, days: PnlDays): Promise<WebPnl> {
    const wallet = this.store.wallet(identity.senderId)?.address;
    if (!wallet || !/^0x[0-9a-fA-F]{40}$/.test(wallet))
      return { wallet: null, days, snapshot: null };
    const key = wallet.toLowerCase();
    const row = this.sql
      .exec<{ snapshot: string }>(
        "SELECT snapshot FROM basedbot_web_pnl WHERE wallet=? AND days=?",
        key,
        days,
      )
      .toArray()[0];
    const cached = row
      ? pnlSnapshotSchema.safeParse(JSON.parse(row.snapshot)).data
      : undefined;
    if (cached && Date.now() - cached.observedAt < pnlCacheMs)
      return { wallet, days, snapshot: cached };
    const readKey = `${key}:${days}`;
    let read = this.pnlReads.get(readKey);
    if (!read) {
      read = this.agent
        .walletPnl(wallet as `0x${string}`, days)
        .then((snapshot) => {
          this.sql.exec(
            "INSERT INTO basedbot_web_pnl(wallet,days,snapshot) VALUES(?,?,?) ON CONFLICT(wallet,days) DO UPDATE SET snapshot=excluded.snapshot",
            key,
            days,
            JSON.stringify(snapshot),
          );
          return snapshot;
        })
        .finally(() => this.pnlReads.delete(readKey));
      this.pnlReads.set(readKey, read);
    }
    try {
      return { wallet, days, snapshot: await read };
    } catch (error) {
      if (cached) return { wallet, days, snapshot: cached };
      throw error;
    }
  }
  /** Whether a turn is currently running in this thread, so a caller can refuse before opening a stream. */
  busy(scope: Scope): boolean {
    return this.active.has(this.owner(scope));
  }
  async handle(input: Turn, progress?: ParagraphSink) {
    const { senderId, requestId, text } = input;
    if (input.retryOf && input.answerTo) throw new Error("A retry cannot also answer a question.");
    if (senderKind(senderId) === "x" && !this.store.wallet(senderId))
      throw new Error(
        "No Pecu wallet exists for this X account. Send /wallet to Pecu on X first.",
      );
    const conversationId = this.owner(input);
    const eventId = `${conversationId}:${requestId}`;
    if (this.active.has(conversationId)) return { status: "busy" as const };
    this.active.add(conversationId);
    try {
      const existing = this.sql
        .exec<{ text: string; reply: string | null }>(
          "SELECT text,reply FROM basedbot_web_turns WHERE id=?",
          eventId,
        )
        .toArray()[0];
      if (!existing && this.sql.exec("SELECT id FROM basedbot_web_retries WHERE target=? LIMIT 1", eventId).toArray().length) throw new Error("This answer has been replaced. Reload the latest message.");
      if (existing && existing.text !== text)
        throw new Error("This request already belongs to another message.");
      const retryRecord = this.sql.exec<{ target: string; context: string }>("SELECT target,context FROM basedbot_web_retries WHERE id=?", eventId).toArray()[0];
      if (retryRecord && input.retryOf && retryRecord.target !== input.retryOf) throw new Error("This retry belongs to another message.");
      if (input.retryOf && !existing) {
        const history = this.state(input).messages;
        const last = history.at(-1);
        if (!last || last.id !== input.retryOf || last.text !== text) throw new Error("Only the latest answer in this thread can be retried with its original message.");
        if (!last.canRetry || this.store.executingIntents().some((intent) => intent.senderId === senderId && intent.conversationId === conversationId)) throw new Error("Use the original transaction controls to confirm or check this request; it cannot be retried.");
        const context = JSON.stringify(history.slice(0, -1).map((turn) => ({ user: turn.text, assistant: turn.reply?.text ?? "" })));
        this.sql.exec("INSERT INTO basedbot_web_retries(id,target,context) VALUES(?,?,?)", eventId, last.id, context);
        this.sql.exec("UPDATE basedbot_web_turns SET id=?,reply=NULL WHERE id=? AND owner=?", eventId, last.id, conversationId);
      }
      if (input.answerTo && !existing) {
        const last = this.state(input).messages.at(-1);
        if (last?.id !== input.answerTo || !last.reply?.question?.options.includes(text)) throw new Error("This choice is no longer available. Answer the latest question in this thread.");
      }
      if (existing?.reply) return { status: "complete" as const };
      this.sql.exec(
        "INSERT OR IGNORE INTO basedbot_web_turns(id,owner,text,created_at) VALUES(?,?,?,?)",
        eventId,
        conversationId,
        text,
        Date.now(),
      );
      const retryContext = this.sql.exec<{ context: string }>("SELECT context FROM basedbot_web_retries WHERE id=?", eventId).toArray()[0]?.context;
      const reply = await this.agent.handle(
        { senderId, conversationId, eventId, text, encodedEvent: "", retryContext },
        true,
        progress,
      );
      if (!reply) return { status: "busy" as const };
      const intent = this.store.intentForSource(eventId);
      const code = reply.match(/\/(?:confirm|cancel) ([A-Z0-9]{6})\b/)?.[1];
      const codeDigest = code
        ? Array.from(
            new Uint8Array(
              await crypto.subtle.digest(
                "SHA-256",
                new TextEncoder().encode(code),
              ),
            ),
            (byte) => byte.toString(16).padStart(2, "0"),
          ).join("")
        : undefined;
      const holdings = this.store.stockSnapshot(eventId);
      const analytics = this.store.analytics(eventId);
      const response = {
        ...(analytics.length ? { analytics, analyticsOnly: analytics.length === 1 && reply === analytics[0]?.text } : {}),
        ...(needsChatGptConnection({ text: reply }) ? { recovery: "connect_chatgpt" as const } : {}),
        ...(holdings ? { holdings, holdingsOnly: reply === aeroReadText("stocks", holdings.stocks) } : {}),
        question: this.store.questionForEvent(eventId),
        text: reply,
        preview:
          intent && code && intent.codeHash === codeDigest
            ? {
                code,
                title: intentTitle(intent),
                text: intent.preview,
                state: intent.state,
                expiresAt: intent.expiresAt,
              }
            : null,
      };
      this.sql.exec(
        "UPDATE basedbot_web_turns SET reply=? WHERE id=?",
        JSON.stringify(response),
        eventId,
      );
      if (holdings) {
        this.sql.exec(
          "INSERT INTO basedbot_web_profiles(owner,stocks,stocks_at) VALUES(?,?,?) ON CONFLICT(owner) DO UPDATE SET stocks=excluded.stocks,stocks_at=excluded.stocks_at",
          this.owner({ userId: input.userId, senderId }),
          JSON.stringify(holdings.stocks),
          holdings.observedAt,
        );
      }
      return { status: "complete" as const };
    } finally {
      this.active.delete(conversationId);
    }
  }
}
