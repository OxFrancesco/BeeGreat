import { TurnQueue } from "./turn-queue";
import { positionSummary } from "./position-contract";
import { type Portfolio, portfolioBalanceSchema, portfolioQuerySchema } from "./portfolio-contract";
import { needsChatGptConnection } from "./inference-recovery";
import { parseCommand } from "./domain";
import { aeroReadText, intentTitle } from "./chat";
import { intentPlan } from "./transaction-plan";
import { WebHistory, type HistoryRow } from "./web-history";
import { messageIntents } from "./message-intents";
import type { MessagePageQuery, ThreadPageQuery } from "./web-contract";
import { parseAllocations } from "../node_modules/@beegreat/sugar/src/stocks/catalog";
import { z } from "zod";
import type { PecuAgent } from "./agent";
import { LinkedWalletError, type LinkedWallets } from "./linked-wallets";
import { getAddress } from "viem";
import type { PecuStore } from "./state";
import { senderKind, webConversation } from "./web-identity";
import type { ParagraphSink } from "./web-stream";
import { pnlSnapshotSchema, type PnlSnapshot } from "./analytics-contract";
import type { MessageOrigin } from "./task-contract";
import type { Intent } from "./state";
import type { McpCallResult } from "./mcp-contract";
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
  type webMessageSchema,
} from "./web-contract";

type WebMessage = z.infer<typeof webMessageSchema>;

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
  private readonly queue: TurnQueue;
  private readonly active = new Set<string>();
  private readonly steering = new Set<string>();
  private readonly pnlReads = new Map<string, Promise<PnlSnapshot>>();
  constructor(
    private readonly agent: PecuAgent,
    private readonly store: PecuStore,
    private readonly sql: WebSql,
    private readonly linkedWallets?: Pick<LinkedWallets, "signer" | "isLinked">,
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
    this.queue = new TurnQueue(sql);
  }
  /** The agent treats each thread owner as its own conversation. */
  private owner(scope: Scope) {
    return webConversation(scope);
  }
  threads(identity: Identity): WebThread[] {
    return this.history.threads(identity).threads;
  }
  threadPage(identity: Identity, page: ThreadPageQuery = {}) {
    return this.history.threads(identity, page);
  }
  private messageIntent(eventId: string): Intent | undefined {
    return messageIntents(this.store, eventId).at(-1);
  }
  private presentMessage(row: HistoryRow) {
    const stored = row.reply
      ? webReplySchema.parse(JSON.parse(row.reply))
      : null;
    const origin = stored?.origin;
    const reply = stored && !stored.steerPending ? { ...stored, origin: undefined } : null;
    const sourceId = stored?.steerOf ? `${row.id.slice(0, row.id.lastIndexOf(":"))}:${stored.steerOf}` : row.id;
    const intent = this.messageIntent(sourceId);
    if (reply?.preview && intent) {
      reply.preview.state =
        intent.state === "pending" && intent.expiresAt < Date.now()
          ? "expired"
          : intent.state;
      reply.preview.title ??= intentTitle(intent);
      if (intent.result !== undefined && (reply.preview.state === "succeeded" || reply.preview.state === "failed")) {
        reply.preview.result = intent.result;
      }
      const plan = intentPlan(this.store, intent, reply.preview.state);
      if (plan) reply.preview.plan = plan;
      if (intent.signer) reply.preview.signer = intent.signer;
    }
    const message: WebMessage = {
      id: row.id,
      runState: this.queue.state(row.id),
      text: row.text,
      createdAt: row.created_at,
      reply,
      canRetry:
        Boolean(reply) &&
        !reply?.steerOf &&
        !origin &&
        !intent &&
        !/^(?:b)?\/|^(?:confirm|cancel)$/i.test(row.text.trim()),
    };
    if (origin) message.origin = origin;
    return message;
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
    this.queue.deleteConversation(owner);
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
      signer: this.linkedWallets?.signer(identity.senderId, owner) ?? null,
      threadId: scope.threadId ?? null,
      threads: paged ? undefined : this.threads(identity),
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
  /** The Pecu wallet, or a linked wallet the account asked for. Any other address is refused. */
  private ownedWallet(identity: Identity, requested?: string): string | undefined {
    const own = this.store.wallet(identity.senderId)?.address;
    if (!requested || requested.toLowerCase() === own?.toLowerCase()) return own;
    if (this.linkedWallets?.isLinked(identity.senderId, requested)) return getAddress(requested);
    throw new LinkedWalletError("This wallet isn't linked to your account.");
  }
  async portfolio(identity: Identity, query: z.infer<typeof portfolioQuerySchema>): Promise<Portfolio> {
    const wallet = this.ownedWallet(identity, query.wallet);
    const address = z.templateLiteral(["0x", z.string().regex(/^[0-9a-fA-F]{40}$/)]).safeParse(wallet);
    if (!address.success) return { wallet: null, balances: [], holdings: null, stocksError: null };
    const balances = Promise.all([...new Set(query.tokens.map((token) => token.toLowerCase()))].map(async (reference) => {
      try {
        const result = await this.agent.portfolioBalance(address.data, reference);
        const value = z.object({ token: z.string(), token_address: z.string().optional(), amount: z.string() }).parse(result.output);
        return portfolioBalanceSchema.parse({ reference, symbol: value.token, address: value.token_address ?? null, amount: value.amount, error: null });
      } catch (error) {
        const message = error instanceof Error && error.message.startsWith("Unknown token")
          ? "Ticker not found. Try its Base contract address." : "Balance unavailable. Try again.";
        return { reference, symbol: reference.startsWith("0x") ? `${reference.slice(0, 6)}…${reference.slice(-4)}` : reference.toUpperCase(), address: reference.startsWith("0x") ? reference : null, amount: null, error: message };
      }
    }));
    let stocksError: string | null = null;
    const holdings = query.stocks ? this.agent.portfolioStocks(address.data).catch(() => {
      stocksError = "Stock positions are unavailable. Try again.";
      return null;
    }) : Promise.resolve(null);
    const [rows, stocks] = await Promise.all([balances, holdings]);
    return { wallet: address.data, balances: rows, holdings: stocks, stocksError };
  }

  async pnl(identity: Identity, days: PnlDays, requested?: string): Promise<WebPnl> {
    const wallet = this.ownedWallet(identity, requested);
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
        .walletPnl(z.templateLiteral(["0x", z.string().regex(/^[0-9a-fA-F]{40}$/)]).parse(wallet), days)
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
    return this.active.has(this.owner(scope)) || this.queue.hasPending(this.owner(scope));
  }
  /** Hold a thread for an automated run. Returns the release, or undefined when a turn is already running there. */
  lock(conversationId: string): (() => void) | undefined {
    if (this.active.has(conversationId) || this.queue.hasPending(conversationId)) return undefined;
    this.active.add(conversationId);
    return () => this.active.delete(conversationId);
  }
  /** Add an automation's message to its web thread. `text` is shown as the automation title. */
  async recordTask(conversationId: string, eventId: string, origin: MessageOrigin, reply: string) {
    this.sql.exec(
      "INSERT OR IGNORE INTO basedbot_web_turns(id,owner,text,created_at) VALUES(?,?,?,?)",
      eventId,
      conversationId,
      origin.title,
      Date.now(),
    );
    const response = await this.replyRecord(eventId, reply, this.messageIntent(eventId));
    this.sql.exec("UPDATE basedbot_web_turns SET reply=? WHERE id=?", JSON.stringify({ ...response, origin }), eventId);
  }
  async recordTool(scope: Scope, eventId: string, label: string, operation: () => Promise<McpCallResult>): Promise<McpCallResult> {
    if (senderKind(scope.senderId) === "x" && !this.store.wallet(scope.senderId))
      throw new Error("No Pecu wallet exists for this X account. Send /wallet to Pecu on X first.");
    const conversationId = this.owner(scope);
    const release = this.lock(conversationId);
    if (!release) throw new Error("Pecu is finishing a request in this thread. Try again shortly.");
    try {
      const existing = this.sql.exec<{ text: string }>("SELECT text FROM basedbot_web_turns WHERE id=? AND owner=?", eventId, conversationId).toArray()[0];
      if (existing && existing.text !== label) throw new Error("This request already belongs to another message.");
      this.sql.exec("INSERT OR IGNORE INTO basedbot_web_turns(id,owner,text,created_at) VALUES(?,?,?,?)", eventId, conversationId, label, Date.now());
      const result = await operation();
      const reply = await this.replyRecord(eventId, result.text, this.store.intentForSource(eventId));
      this.sql.exec("UPDATE basedbot_web_turns SET reply=? WHERE id=? AND owner=?", JSON.stringify(reply), eventId, conversationId);
      return result;
    } finally { release(); }
  }
  private async replyRecord(eventId: string, reply: string, intent: Intent | undefined) {
    const code = [...reply.matchAll(/\/(?:confirm|cancel) ([A-Z0-9]{6})\b/g)].at(-1)?.[1];
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
    const positions = this.store.positionSnapshot(eventId);
    return {
      positions,
      positionsOnly: positions?.positions.length ? reply === positionSummary(positions) : undefined,
      analytics: analytics.length ? analytics : undefined,
      analyticsOnly: analytics.length ? analytics.length === 1 && reply === analytics[0]?.text : undefined,
      recovery: needsChatGptConnection({ text: reply }) ? "connect_chatgpt" as const : undefined,
      holdings,
      holdingsOnly: holdings ? reply === aeroReadText("stocks", holdings.stocks) : undefined,
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
  }
  private async steer(input: Turn) {
    if (input.retryOf || input.answerTo || input.reviewWallet) throw new Error("A steer cannot retry, answer a choice, or review a transfer.");
    const conversationId = this.owner(input);
    const eventId = `${conversationId}:${input.requestId}`;
    const existing = this.sql.exec<{ text: string; reply: string | null }>("SELECT text,reply FROM basedbot_web_turns WHERE id=?", eventId).toArray()[0];
    if (existing && existing.text !== input.text) throw new Error("This request already belongs to another message.");
    if (existing && !existing.reply) throw new Error("This request belongs to another turn.");
    if (existing?.reply) {
      if (webReplySchema.parse(JSON.parse(existing.reply)).steerOf !== input.steerOf) throw new Error("This request belongs to another turn.");
      return { status: "complete" as const };
    }
    if (this.steering.has(eventId)) return { status: "busy" as const };
    if (!this.active.has(conversationId)) throw new Error("That reply is no longer running. Send your message again.");
    this.steering.add(eventId);
    try {
      this.sql.exec("INSERT OR IGNORE INTO basedbot_web_turns(id,owner,text,created_at,reply) VALUES(?,?,?,?,?)", eventId, conversationId, input.text, Date.now(), JSON.stringify({ text: "", preview: null, steerOf: input.steerOf, steerPending: true }));
      try {
        await this.agent.steer({ senderId: input.senderId, conversationId, eventId, text: input.text, encodedEvent: "" }, `${conversationId}:${input.steerOf}`);
      } catch (error) {
        this.sql.exec("DELETE FROM basedbot_web_turns WHERE id=? AND reply=?", eventId, JSON.stringify({ text: "", preview: null, steerOf: input.steerOf, steerPending: true }));
        throw error;
      }
      return { status: "complete" as const };
    } finally { this.steering.delete(eventId); }
  }

  async resumePending(): Promise<void> {
    for (const { id, request } of this.queue.pending()) {
      if (this.active.has(this.owner(request))) continue;
      try { await this.handle(request); } catch {
        if (this.queue.state(id) === "running") this.queue.fail(id);
      }
    }
  }

  async handle(input: Turn, progress?: ParagraphSink) {
    if (input.steerOf) return this.steer(input);
    const { senderId, requestId, text } = input;
    if (input.retryOf && input.answerTo) throw new Error("A retry cannot also answer a question.");
    if (senderKind(senderId) === "x" && !this.store.wallet(senderId))
      throw new Error(
        "No Pecu wallet exists for this X account. Send /wallet to Pecu on X first.",
      );
    const conversationId = this.owner(input);
    if (input.reviewWallet) {
      const command = parseCommand(text);
      if (command.type !== "evm" || command.action !== "transfer") throw new Error("This form only reviews token transfers.");
      const wallet = this.linkedWallets?.signer(senderId, conversationId) ?? this.store.wallet(senderId)?.address;
      if (wallet?.toLowerCase() !== input.reviewWallet.toLowerCase()) throw new Error("The source wallet changed. Open Send again and choose your wallet.");
      if (this.store.yoloEnabled(senderId, conversationId)) throw new Error("Turn off YOLO before reviewing this transfer.");
    }
    const eventId = `${conversationId}:${requestId}`;
    if (this.active.has(conversationId) || this.queue.hasPending(conversationId, eventId)) return { status: "busy" as const };
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
      if (existing?.reply && !["running", "retrying", "failed"].includes(this.queue.state(eventId) ?? "")) return { status: "complete" as const };
      this.sql.exec(
        "INSERT OR IGNORE INTO basedbot_web_turns(id,owner,text,created_at) VALUES(?,?,?,?)",
        eventId,
        conversationId,
        text,
        Date.now(),
      );
      this.queue.start(eventId, input);
      const retryContext = this.sql.exec<{ context: string }>("SELECT context FROM basedbot_web_retries WHERE id=?", eventId).toArray()[0]?.context;
      let replyTarget = eventId;
      const snapshots = new Map<string, string>();
      const checkpoint = (target: string) => {
        const response: z.infer<typeof webReplySchema> = { text: snapshots.get(target) ?? "", preview: null };
        if (target !== eventId) response.steerOf = requestId;
        this.sql.exec("UPDATE basedbot_web_turns SET reply=? WHERE id=? AND owner=?", JSON.stringify(response), target, conversationId);
      };
      const sink: ParagraphSink = (text, target = eventId) => {
        if (target !== eventId) {
          const row = this.sql.exec<{ reply: string | null }>("SELECT reply FROM basedbot_web_turns WHERE id=? AND owner=?", target, conversationId).toArray()[0];
          if (!row?.reply || webReplySchema.parse(JSON.parse(row.reply)).steerOf !== requestId) return;
        }
        if (target !== replyTarget) checkpoint(replyTarget);
        replyTarget = target;
        snapshots.set(target, progress?.live === false ? [snapshots.get(target), text].filter(Boolean).join("\n\n") : text);
        progress?.(text, target);
      };
      sink.live = progress?.live ?? true;
      sink.stage = progress?.stage;
      sink.trace = progress?.trace;
      const reply = await this.agent.handle(
        { senderId, conversationId, eventId, text, encodedEvent: "", retryContext },
        true,
        sink,
      );
      if (!reply) { this.queue.retry(eventId); return { status: "busy" as const }; }
      const holdings = this.store.stockSnapshot(eventId);
      const response: z.infer<typeof webReplySchema> = await this.replyRecord(eventId, reply, this.messageIntent(eventId));
      if (replyTarget !== eventId) response.steerOf = requestId;
      this.sql.exec(
        "UPDATE basedbot_web_turns SET reply=? WHERE id=?",
        JSON.stringify(response),
        replyTarget,
      );
      if (holdings) {
        this.sql.exec(
          "INSERT INTO basedbot_web_profiles(owner,stocks,stocks_at) VALUES(?,?,?) ON CONFLICT(owner) DO UPDATE SET stocks=excluded.stocks,stocks_at=excluded.stocks_at",
          this.owner({ userId: input.userId, senderId }),
          JSON.stringify(holdings.stocks),
          holdings.observedAt,
        );
      }
      this.queue.complete(eventId);
      return { status: "complete" as const };
    } catch (error) {
      this.queue.retry(eventId);
      throw error;
    } finally {
      this.active.delete(conversationId);
    }
  }
}
