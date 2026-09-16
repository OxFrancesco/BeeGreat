import { parseAllocations } from "../node_modules/@beegreat/sugar/src/stocks/catalog";
import type { z } from "zod";
import type { PecuAgent } from "./agent";
import type { PecuStore } from "./state";
import {
  basketSchema,
  webReplySchema,
  type webIdentitySchema,
  type webScopeSchema,
  type webTurnSchema,
  type WebState,
  type WebThread,
} from "./web-contract";

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
  private readonly active = new Set<string>();
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
      `CREATE TABLE IF NOT EXISTS basedbot_web_profiles (owner TEXT PRIMARY KEY, stocks TEXT, stocks_at INTEGER, basket TEXT)`,
    );
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
    const base = this.owner(identity);
    return this.sql
      .exec<{ owner: string; created_at: number; updated_at: number; count: number }>(
        "SELECT owner, MIN(created_at) AS created_at, MAX(created_at) AS updated_at, COUNT(*) AS count FROM basedbot_web_turns WHERE owner=? OR substr(owner,1,?)=? GROUP BY owner ORDER BY updated_at DESC, owner ASC",
        base,
        base.length + 1,
        `${base}#`,
      )
      .toArray()
      .map((row) => {
        const first = this.sql
          .exec<{ text: string }>(
            "SELECT text FROM basedbot_web_turns WHERE owner=? ORDER BY created_at ASC LIMIT 1",
            row.owner,
          )
          .toArray()[0];
        return {
          id: row.owner === base ? null : row.owner.slice(base.length + 1),
          title: (first?.text ?? "").replace(/\s+/g, " ").trim().slice(0, 80),
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          count: row.count,
        };
      });
  }
  deleteThread(identity: Identity, threadId: string | null) {
    const owner = this.owner({ ...identity, threadId: threadId ?? undefined });
    if (this.active.has(owner))
      throw new Error("Pecu is still answering in this thread. Try again in a moment.");
    if (this.store.executingIntents().some((intent) =>
      intent.senderId === identity.senderId && intent.conversationId === owner
    )) throw new Error("Check the submitted transaction before deleting this thread.");
    this.sql.exec("DELETE FROM basedbot_web_turns WHERE owner=?", owner);
  }
  state(scope: Scope): WebState {
    const owner = this.owner(scope);
    const identity = { userId: scope.userId, senderId: scope.senderId };
    const profile = this.sql
      .exec<{
        stocks: string | null;
        stocks_at: number | null;
        basket: string | null;
      }>("SELECT * FROM basedbot_web_profiles WHERE owner=?", this.owner(identity))
      .toArray()[0];
    const messages = this.sql
      .exec<{
        id: string;
        text: string;
        created_at: number;
        reply: string | null;
      }>(
        "SELECT * FROM basedbot_web_turns WHERE owner=? ORDER BY created_at DESC LIMIT 100",
        owner,
      )
      .toArray()
      .reverse()
      .map((row) => {
        const reply = row.reply
          ? webReplySchema.parse(JSON.parse(row.reply))
          : null;
        const intent = this.store.intentForSource(row.id);
        if (reply?.preview && intent)
          reply.preview.state =
            intent.state === "pending" && intent.expiresAt < Date.now()
              ? "expired"
              : intent.state;
        return { id: row.id, text: row.text, createdAt: row.created_at, reply };
      });
    return {
      wallet: this.store.wallet(identity.senderId)?.address ?? null,
      yolo: this.store.yoloEnabled(identity.senderId, owner),
      threadId: scope.threadId ?? null,
      threads: this.threads(identity),
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
  async handle(input: Turn) {
    const { senderId, requestId, text } = input;
    if (!this.store.wallet(senderId))
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
      if (existing && existing.text !== text)
        throw new Error("This request already belongs to another message.");
      if (existing?.reply) return { status: "complete" as const };
      this.sql.exec(
        "INSERT OR IGNORE INTO basedbot_web_turns(id,owner,text,created_at) VALUES(?,?,?,?)",
        eventId,
        conversationId,
        text,
        Date.now(),
      );
      if (text === "/aero stocks" && !this.store.eventReply(eventId))
        this.store.saveChatDetails(senderId, conversationId, "null");
      const reply = await this.agent.handle(
        { senderId, conversationId, eventId, text, encodedEvent: "" },
        true,
      );
      if (!reply) return { status: "busy" as const };
      const intent = this.store.intentForSource(eventId);
      const code = reply.match(/\/(?:confirm|cancel) ([A-F0-9]{6})\b/)?.[1];
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
      const response = {
        text: reply,
        preview:
          intent && code && intent.codeHash === codeDigest
            ? {
                code,
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
      if (text === "/aero stocks") {
        const stocks = this.store.chatDetails(senderId, conversationId);
        if (stocks && Array.isArray(JSON.parse(stocks)))
          this.sql.exec(
            "INSERT INTO basedbot_web_profiles(owner,stocks,stocks_at) VALUES(?,?,?) ON CONFLICT(owner) DO UPDATE SET stocks=excluded.stocks,stocks_at=excluded.stocks_at",
            this.owner({ userId: input.userId, senderId }),
            stocks,
            Date.now(),
          );
      }
      return { status: "complete" as const };
    } finally {
      this.active.delete(conversationId);
    }
  }
}
