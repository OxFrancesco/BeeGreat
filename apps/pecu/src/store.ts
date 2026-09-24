import { coalescePolymarketAnalytics } from "./integrations/polymarket/analytics";
import { polymarketTokenSchema, type PolymarketToken } from "./integrations/polymarket/model-output";
import { analyticsResultSchema, type AnalyticsResult } from "./analytics-contract";
import { stockSnapshotSchema, type StockSnapshot } from "./stock-contract";
import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { agentQuestionSchema, type AgentQuestion, plannedCallSchema, type PlannedCall, type VerifiedMessage } from "./domain";
import { eventProcessingLeaseMs, parseIntentAction, type PecuStore, type DepositRecord, type DepositState, type ExecutionStep, type FundingAccount, type Intent, type IntentState } from "./state";

export type { ExecutionStep, Intent, IntentState } from "./state";

type FundingAccountRow = {
  sender_id: string;
  whop_account_id: string;
  email: string;
  conversation_id: string;
  encoded_event: string;
};

type DepositRow = {
  id: string;
  webhook_id: string;
  whop_account_id: string;
  sender_id: string | null;
  amount: string;
  currency: string;
  precision: string;
  usd_amount: string | null;
  available_at: number | null;
  relay_usdc_units: string | null;
  state: DepositState;
  hold_reason: string | null;
  intent_id: string | null;
  result: string | null;
  posted_at: number;
  created_at: number;
  updated_at: number;
};

type IntentRow = {
  id: string;
  code_hash: string;
  sender_id: string;
  conversation_id: string;
  source_event_id: string;
  state: IntentState;
  action: string;
  parameters_json: string;
  preview: string;
  plan_digest: string;
  expires_at: number;
  result: string | null;
};

export class Store implements PecuStore {
  readonly db: Database;

  constructor(path: string) {
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
    this.db = new Database(path, { create: true, strict: true });
    this.db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;");
    this.migrate();
  }

  close(): void { this.db.close(); }

  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS polymarket_tokens (event_id TEXT NOT NULL, token_id TEXT NOT NULL, json TEXT NOT NULL, PRIMARY KEY(event_id,token_id));
      CREATE TABLE IF NOT EXISTS analytics (event_id TEXT NOT NULL, chart_key TEXT NOT NULL, json TEXT NOT NULL, PRIMARY KEY(event_id,chart_key));
      CREATE TABLE IF NOT EXISTS stock_snapshots (event_id TEXT PRIMARY KEY, json TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS questions (
        event_id TEXT PRIMARY KEY, sender_id TEXT NOT NULL, conversation_id TEXT NOT NULL,
        json TEXT NOT NULL, answered_event_id TEXT
      );
      CREATE INDEX IF NOT EXISTS questions_owner ON questions(sender_id,conversation_id);
      CREATE TABLE IF NOT EXISTS chat_preferences (
        sender_id TEXT NOT NULL, conversation_id TEXT NOT NULL, yolo INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY(sender_id, conversation_id)
      );
      CREATE TABLE IF NOT EXISTS chat_details (
        sender_id TEXT NOT NULL,
        conversation_id TEXT NOT NULL,
        json TEXT NOT NULL,
        PRIMARY KEY(sender_id, conversation_id)
      );
      CREATE TABLE IF NOT EXISTS inbox_events (
        event_id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        sender_id TEXT NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('processing','completed','failed')),
        reply_text TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS wallets (
        sender_id TEXT PRIMARY KEY,
        locator TEXT NOT NULL UNIQUE,
        address TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS intents (
        id TEXT PRIMARY KEY,
        code_hash TEXT NOT NULL UNIQUE,
        sender_id TEXT NOT NULL,
        conversation_id TEXT NOT NULL,
        source_event_id TEXT NOT NULL UNIQUE,
        state TEXT NOT NULL CHECK(state IN ('pending','executing','succeeded','failed','cancelled','expired')),
        amount TEXT NOT NULL,
        from_token TEXT NOT NULL,
        to_token TEXT NOT NULL,
        minimum_out_atomic TEXT NOT NULL,
        quote_json TEXT NOT NULL,
        expires_at INTEGER NOT NULL,
        result TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS execution_steps (
        intent_id TEXT NOT NULL REFERENCES intents(id),
        position INTEGER NOT NULL,
        role TEXT NOT NULL,
        from_address TEXT NOT NULL,
        to_address TEXT NOT NULL,
        data TEXT NOT NULL,
        value TEXT NOT NULL,
        state TEXT NOT NULL CHECK(state IN ('planned','prepared','submitted','succeeded','failed')),
        transaction_id TEXT UNIQUE,
        hash TEXT,
        error TEXT,
        PRIMARY KEY(intent_id, position)
      );
      CREATE TABLE IF NOT EXISTS aero_intents (
        id TEXT PRIMARY KEY,
        code_hash TEXT NOT NULL UNIQUE,
        sender_id TEXT NOT NULL,
        conversation_id TEXT NOT NULL,
        source_event_id TEXT NOT NULL UNIQUE,
        state TEXT NOT NULL CHECK(state IN ('pending','executing','succeeded','failed','cancelled','expired')),
        action TEXT NOT NULL,
        parameters_json TEXT NOT NULL,
        preview TEXT NOT NULL,
        plan_digest TEXT NOT NULL,
        expires_at INTEGER NOT NULL,
        result TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS aero_execution_steps (
        intent_id TEXT NOT NULL REFERENCES aero_intents(id),
        position INTEGER NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('approval','action')),
        from_address TEXT NOT NULL,
        to_address TEXT NOT NULL,
        data TEXT NOT NULL,
        value TEXT NOT NULL,
        state TEXT NOT NULL CHECK(state IN ('planned','prepared','submitted','succeeded','failed')),
        transaction_id TEXT UNIQUE,
        hash TEXT,
        error TEXT,
        PRIMARY KEY(intent_id, position)
      );
      CREATE TABLE IF NOT EXISTS outbox (
        id TEXT PRIMARY KEY,
        correlation_key TEXT NOT NULL UNIQUE,
        conversation_id TEXT NOT NULL,
        reply_to_event TEXT NOT NULL,
        text TEXT NOT NULL,
        payload_json TEXT,
        state TEXT NOT NULL CHECK(state IN ('pending','prepared','sent','failed')),
        attempts INTEGER NOT NULL DEFAULT 0,
        last_error TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS transport_state (
        conversation_id TEXT PRIMARY KEY,
        pagination_token TEXT,
        updated_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS agent_sessions (
        sender_id TEXT NOT NULL,
        conversation_id TEXT NOT NULL,
        session_id TEXT NOT NULL UNIQUE,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        event_id TEXT,
        message_text TEXT,
        encoded_event TEXT,
        PRIMARY KEY(sender_id, conversation_id)
      );
      CREATE TABLE IF NOT EXISTS funding_accounts (
        sender_id TEXT PRIMARY KEY,
        whop_account_id TEXT NOT NULL UNIQUE,
        email TEXT NOT NULL,
        conversation_id TEXT NOT NULL,
        encoded_event TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS deposits (
        id TEXT PRIMARY KEY,
        webhook_id TEXT NOT NULL,
        whop_account_id TEXT NOT NULL,
        sender_id TEXT,
        amount TEXT NOT NULL,
        currency TEXT NOT NULL,
        precision TEXT NOT NULL,
        usd_amount TEXT,
        available_at INTEGER,
        relay_usdc_units TEXT,
        state TEXT NOT NULL CHECK(state IN ('received','relaying','relayed','held','failed')),
        hold_reason TEXT,
        intent_id TEXT UNIQUE,
        result TEXT,
        posted_at INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `);
  }

  savePolymarketTokens(eventId: string, tokens: readonly PolymarketToken[]): void {
    for (const token of tokens) {
      const value = polymarketTokenSchema.parse(token);
      this.db.query("INSERT OR REPLACE INTO polymarket_tokens VALUES(?,?,?)").run(eventId, value.tokenId, JSON.stringify(value));
    }
  }

  polymarketToken(eventId: string, tokenId: string): PolymarketToken | undefined {
    const row = this.db.query<{json:string}, [string,string]>("SELECT json FROM polymarket_tokens WHERE event_id=? AND token_id=?").get(eventId,tokenId);
    return row ? polymarketTokenSchema.parse(JSON.parse(row.json)) : undefined;
  }

  saveAnalytics(eventId: string, result: AnalyticsResult): void {
    const value = analyticsResultSchema.parse(result);
    this.db.query("INSERT OR REPLACE INTO analytics(event_id,chart_key,json) VALUES(?,?,?)").run(eventId, value.snapshot.key, JSON.stringify(value));
  }

  analytics(eventId: string): AnalyticsResult[] {
    return coalescePolymarketAnalytics(this.db.query<{ json: string }, [string]>("SELECT json FROM analytics WHERE event_id=? ORDER BY rowid DESC LIMIT 12").all(eventId).reverse().map((row) => analyticsResultSchema.parse(JSON.parse(row.json))));
  }

  saveStockSnapshot(eventId: string, snapshot: StockSnapshot): void {
    this.db.query("INSERT OR REPLACE INTO stock_snapshots(event_id,json) VALUES(?,?)").run(eventId, JSON.stringify(stockSnapshotSchema.parse(snapshot)));
  }

  stockSnapshot(eventId: string): StockSnapshot | undefined {
    const row = this.db.query<{ json: string }, [string]>("SELECT json FROM stock_snapshots WHERE event_id=?").get(eventId);
    return row ? stockSnapshotSchema.parse(JSON.parse(row.json)) : undefined;
  }

  saveQuestion(message: VerifiedMessage, question: AgentQuestion): void {
    this.db.query("UPDATE questions SET answered_event_id=? WHERE sender_id=? AND conversation_id=? AND answered_event_id IS NULL AND event_id<>?").run(message.eventId, message.senderId, message.conversationId, message.eventId);
    this.db.query("INSERT OR IGNORE INTO questions(event_id,sender_id,conversation_id,json) VALUES(?,?,?,?)").run(message.eventId, message.senderId, message.conversationId, JSON.stringify(agentQuestionSchema.parse(question)));
  }

  questionForEvent(eventId: string): AgentQuestion | undefined {
    const row = (this.db.query("SELECT json FROM questions WHERE event_id=?").get(eventId) as { json: string } | null);
    return row ? agentQuestionSchema.parse(JSON.parse(row.json)) : undefined;
  }

  answerPendingQuestion(message: VerifiedMessage): boolean {
    const row = (this.db.query("SELECT event_id FROM questions WHERE sender_id=? AND conversation_id=? AND event_id<>? AND (answered_event_id IS NULL OR answered_event_id=?) ORDER BY rowid DESC LIMIT 1").get(message.senderId, message.conversationId, message.eventId, message.eventId) as { event_id: string } | null);
    if (!row) return false;
    this.db.query("UPDATE questions SET answered_event_id=? WHERE event_id=?").run(message.eventId, row.event_id);
    return true;
  }

  yoloEnabled(senderId: string, conversationId: string): boolean {
    return this.db.query<{ yolo: number }, [string, string]>("SELECT yolo FROM chat_preferences WHERE sender_id=? AND conversation_id=?").get(senderId, conversationId)?.yolo === 1;
  }
  setYolo(senderId: string, conversationId: string, enabled: boolean): void {
    this.db.query("INSERT INTO chat_preferences VALUES (?, ?, ?) ON CONFLICT(sender_id, conversation_id) DO UPDATE SET yolo=excluded.yolo").run(senderId, conversationId, Number(enabled));
  }
  outgoingReplyText(messageId: string, conversationId: string): string | undefined {
    return this.db.query<{ text: string }, [string, string]>("SELECT text FROM outbox WHERE conversation_id=? AND json_extract(payload_json, '$.messageId')=?").get(conversationId, messageId)?.text;
  }

  chatDetails(senderId: string, conversationId: string): string | undefined {
    return this.db.query<{ json: string }, [string, string]>("SELECT json FROM chat_details WHERE sender_id=? AND conversation_id=?").get(senderId, conversationId)?.json;
  }

  saveChatDetails(senderId: string, conversationId: string, json: string): void {
    this.db.query("INSERT INTO chat_details VALUES (?, ?, ?) ON CONFLICT(sender_id, conversation_id) DO UPDATE SET json=excluded.json").run(senderId, conversationId, json);
  }

  claimEvent(eventId: string, conversationId: string, senderId: string, retryUnanswered = false, now = Date.now()): "claimed" | "completed" | "busy" {
    const reclaimed = retryUnanswered
      ? this.db.query(
        "UPDATE inbox_events SET status = 'processing', updated_at = ? WHERE event_id = ? AND reply_text IS NULL",
      ).run(now, eventId)
      : this.db.query(
        "UPDATE inbox_events SET status = 'processing', updated_at = ? WHERE event_id = ? AND status = 'processing' AND reply_text IS NULL AND updated_at <= ?",
      ).run(now, eventId, now - eventProcessingLeaseMs);
    if (reclaimed.changes === 1) return "claimed";
    const result = this.db.query("INSERT OR IGNORE INTO inbox_events VALUES (?, ?, ?, 'processing', NULL, ?, ?)").run(eventId, conversationId, senderId, now, now);
    if (result.changes === 1) return "claimed";
    const row = this.db.query("SELECT status FROM inbox_events WHERE event_id = ?").get(eventId) as { status: string };
    return row.status === "completed" ? "completed" : "busy";
  }

  completeEvent(eventId: string, replyText: string): void {
    this.db.query("UPDATE inbox_events SET status = 'completed', reply_text = ?, updated_at = ? WHERE event_id = ?").run(replyText, Date.now(), eventId);
  }

  ignoreEvent(eventId: string, conversationId: string, senderId: string): void {
    const now = Date.now();
    this.db.query("INSERT OR IGNORE INTO inbox_events VALUES (?, ?, ?, 'completed', NULL, ?, ?)").run(eventId, conversationId, senderId, now, now);
  }

  failEvent(eventId: string): void {
    this.db.query("UPDATE inbox_events SET status = 'failed', updated_at = ? WHERE event_id = ?").run(Date.now(), eventId);
  }

  eventReply(eventId: string): string | undefined {
    return (this.db.query("SELECT reply_text FROM inbox_events WHERE event_id = ?").get(eventId) as { reply_text: string | null } | null)?.reply_text ?? undefined;
  }

  wallet(senderId: string): { locator: string; address: string } | undefined {
    return this.db.query("SELECT locator, address FROM wallets WHERE sender_id = ?").get(senderId) as { locator: string; address: string } | null ?? undefined;
  }

  saveWallet(senderId: string, locator: string, address: string): void {
    this.db.query("INSERT INTO wallets VALUES (?, ?, ?, ?) ON CONFLICT(sender_id) DO UPDATE SET locator=excluded.locator,address=excluded.address").run(senderId, locator, address, Date.now());
  }

  createIntent(intent: Intent, calls: readonly PlannedCall[]): void {
    const now = Date.now();
    const insertIntent = this.db.query(`INSERT INTO aero_intents
      (id,code_hash,sender_id,conversation_id,source_event_id,state,action,parameters_json,preview,plan_digest,expires_at,result,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
    const insertStep = this.db.query("INSERT INTO aero_execution_steps (intent_id,position,role,from_address,to_address,data,value,state) VALUES (?,?,?,?,?,?,?,'planned')");
    this.db.transaction(() => {
      insertIntent.run(
        intent.id, intent.codeHash, intent.senderId, intent.conversationId, intent.sourceEventId, intent.state,
        intent.action, JSON.stringify(intent.parameters), intent.preview, intent.planDigest, intent.expiresAt,
        intent.result ?? null, now, now,
      );
      calls.forEach((call, index) => {
        insertStep.run(intent.id, index, call.role, call.from, call.to, call.data, call.value);
      });
    })();
  }

  intentForSource(eventId: string): Intent | undefined {
    const row = this.db.query("SELECT * FROM aero_intents WHERE source_event_id = ?").get(eventId) as IntentRow | null;
    return row ? this.toIntent(row) : undefined;
  }

  intentForCode(codeHash: string, senderId: string, conversationId: string): Intent | undefined {
    const row = this.db.query("SELECT * FROM aero_intents WHERE code_hash = ? AND sender_id = ? AND conversation_id = ?").get(codeHash, senderId, conversationId) as IntentRow | null;
    return row ? this.toIntent(row) : undefined;
  }

  executingIntents(): Intent[] {
    return (this.db.query("SELECT * FROM aero_intents WHERE state='executing' ORDER BY created_at").all() as IntentRow[]).map((row) => this.toIntent(row));
  }

  transitionIntent(id: string, from: IntentState, to: IntentState, result?: string): boolean {
    const changed = this.db.query("UPDATE aero_intents SET state=?, result=?, updated_at=? WHERE id=? AND state=?").run(to, result ?? null, Date.now(), id, from);
    return changed.changes === 1;
  }

  steps(intentId: string): ExecutionStep[] {
    const rows = this.db.query("SELECT * FROM aero_execution_steps WHERE intent_id=? ORDER BY position").all(intentId) as Array<Record<string, string | number | null>>;
    return rows.map((row) => ({
      intentId: String(row.intent_id), position: Number(row.position), state: String(row.state) as ExecutionStep["state"],
      call: plannedCallSchema.parse({ role: row.role, from: row.from_address, to: row.to_address, data: row.data, value: row.value }),
      ...(row.transaction_id === null ? {} : { transactionId: String(row.transaction_id) }),
      ...(row.hash === null ? {} : { hash: String(row.hash) }),
    }));
  }

  markStepPrepared(intentId: string, position: number, transactionId: string): void {
    this.db.query("UPDATE aero_execution_steps SET state='prepared',transaction_id=? WHERE intent_id=? AND position=? AND state='planned'").run(transactionId, intentId, position);
  }

  markStepSubmitted(intentId: string, position: number, hash: string): void {
    this.db.query("UPDATE aero_execution_steps SET state='submitted',hash=? WHERE intent_id=? AND position=? AND state IN ('prepared','submitted')").run(hash, intentId, position);
  }

  markStepSucceeded(intentId: string, position: number, hash?: string): void {
    this.db.query("UPDATE aero_execution_steps SET state='succeeded',hash=? WHERE intent_id=? AND position=?").run(hash ?? null, intentId, position);
  }

  markStepFailed(intentId: string, position: number, error: string): void {
    this.db.query("UPDATE aero_execution_steps SET state='failed',error=? WHERE intent_id=? AND position=?").run(error, intentId, position);
  }

  enqueueReply(correlationKey: string, conversationId: string, replyToEvent: string, text: string): void {
    const now = Date.now();
    this.db.query("INSERT OR IGNORE INTO outbox (id,correlation_key,conversation_id,reply_to_event,text,state,created_at,updated_at) VALUES (?,?,?,?,?,'pending',?,?)").run(crypto.randomUUID(), correlationKey, conversationId, replyToEvent, text, now, now);
  }

  pendingReplies(): Array<{ id: string; conversationId: string; replyToEvent: string; text: string; payloadJson?: string }> {
    const rows = this.db.query("SELECT id,conversation_id,reply_to_event,text,payload_json FROM outbox WHERE state IN ('pending','prepared','failed') ORDER BY created_at LIMIT 50").all() as Array<{ id: string; conversation_id: string; reply_to_event: string; text: string; payload_json: string | null }>;
    return rows.map((row) => ({ id: row.id, conversationId: row.conversation_id, replyToEvent: row.reply_to_event, text: row.text, ...(row.payload_json ? { payloadJson: row.payload_json } : {}) }));
  }

  prepareReply(id: string, payloadJson: string): void { this.db.query("UPDATE outbox SET state='prepared',payload_json=?,updated_at=? WHERE id=?").run(payloadJson, Date.now(), id); }
  sentReply(id: string): void { this.db.query("UPDATE outbox SET state='sent',updated_at=? WHERE id=?").run(Date.now(), id); }
  failReply(id: string, error: string): void { this.db.query("UPDATE outbox SET state='failed',attempts=attempts+1,last_error=?,updated_at=? WHERE id=?").run(error, Date.now(), id); }

  paginationToken(conversationId: string): string | undefined {
    return (this.db.query("SELECT pagination_token FROM transport_state WHERE conversation_id=?").get(conversationId) as { pagination_token: string | null } | null)?.pagination_token ?? undefined;
  }
  transportInitialized(conversationId: string, bootstrapVersion?: string): boolean {
    const row = this.db.query("SELECT pagination_token FROM transport_state WHERE conversation_id=?").get(conversationId) as { pagination_token: string | null } | null;
    return row !== null && (bootstrapVersion === undefined || row.pagination_token === bootstrapVersion);
  }
  savePaginationToken(conversationId: string, token?: string): void {
    this.db.query("INSERT INTO transport_state VALUES (?,?,?) ON CONFLICT(conversation_id) DO UPDATE SET pagination_token=excluded.pagination_token,updated_at=excluded.updated_at").run(conversationId, token ?? null, Date.now());
  }

  agentSession(senderId: string, conversationId: string): string | undefined {
    const row = this.db.query(
      "SELECT session_id FROM agent_sessions WHERE sender_id=? AND conversation_id=?",
    ).get(senderId, conversationId) as { session_id: string } | null;
    return row?.session_id;
  }

  saveAgentSession(senderId: string, conversationId: string, sessionId: string): void {
    const now = Date.now();
    this.db.query(`INSERT INTO agent_sessions (sender_id,conversation_id,session_id,created_at,updated_at)
      VALUES (?,?,?,?,?) ON CONFLICT(sender_id,conversation_id) DO UPDATE SET
      session_id=excluded.session_id,updated_at=excluded.updated_at`).run(
      senderId, conversationId, sessionId, now, now,
    );
  }

  saveAgentTurn(sessionId: string, message: VerifiedMessage): void {
    this.db.query(`UPDATE agent_sessions SET event_id=?,message_text=?,encoded_event=?,updated_at=?
      WHERE session_id=? AND sender_id=? AND conversation_id=?`).run(
      message.eventId, message.text, message.encodedEvent, Date.now(), sessionId, message.senderId, message.conversationId,
    );
  }

  agentTurn(sessionId: string): VerifiedMessage | undefined {
    const row = this.db.query(`SELECT sender_id,conversation_id,event_id,message_text,encoded_event
      FROM agent_sessions WHERE session_id=?`).get(sessionId) as {
        sender_id: string;
        conversation_id: string;
        event_id: string | null;
        message_text: string | null;
        encoded_event: string | null;
      } | null;
    if (!row?.event_id || row.message_text === null || row.encoded_event === null) return undefined;
    return {
      senderId: row.sender_id,
      conversationId: row.conversation_id,
      eventId: row.event_id,
      text: row.message_text,
      encodedEvent: row.encoded_event,
    };
  }

  fundingAccount(senderId: string): FundingAccount | undefined {
    const row = this.db.query("SELECT * FROM funding_accounts WHERE sender_id=?").get(senderId) as FundingAccountRow | null;
    return row ? this.toFundingAccount(row) : undefined;
  }

  fundingAccountByWhopId(whopAccountId: string): FundingAccount | undefined {
    const row = this.db.query("SELECT * FROM funding_accounts WHERE whop_account_id=?").get(whopAccountId) as FundingAccountRow | null;
    return row ? this.toFundingAccount(row) : undefined;
  }

  saveFundingAccount(account: FundingAccount): void {
    const now = Date.now();
    this.db.query(`INSERT INTO funding_accounts (sender_id,whop_account_id,email,conversation_id,encoded_event,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?)
      ON CONFLICT(sender_id) DO UPDATE SET whop_account_id=excluded.whop_account_id,email=excluded.email,
      conversation_id=excluded.conversation_id,encoded_event=excluded.encoded_event,updated_at=excluded.updated_at`).run(
      account.senderId, account.whopAccountId, account.email, account.conversationId, account.encodedEvent, now, now,
    );
  }

  touchFundingAccount(senderId: string, conversationId: string, encodedEvent: string): void {
    if (encodedEvent === "") return;
    this.db.query("UPDATE funding_accounts SET conversation_id=?,encoded_event=?,updated_at=? WHERE sender_id=?").run(conversationId, encodedEvent, Date.now(), senderId);
  }

  recordDeposit(deposit: Omit<DepositRecord, "createdAt" | "updatedAt">): boolean {
    const now = Date.now();
    const result = this.db.query(`INSERT OR IGNORE INTO deposits
      (id,webhook_id,whop_account_id,sender_id,amount,currency,precision,usd_amount,available_at,relay_usdc_units,state,hold_reason,intent_id,result,posted_at,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
      deposit.id, deposit.webhookId, deposit.whopAccountId, deposit.senderId ?? null,
      deposit.amount, deposit.currency, deposit.precision, deposit.usdAmount ?? null,
      deposit.availableAt ?? null, deposit.relayUsdcUnits ?? null, deposit.state,
      deposit.holdReason ?? null, deposit.intentId ?? null, deposit.result ?? null,
      deposit.postedAt, now, now,
    );
    return result.changes === 1;
  }

  deposit(id: string): DepositRecord | undefined {
    const row = this.db.query("SELECT * FROM deposits WHERE id=?").get(id) as DepositRow | null;
    return row ? this.toDeposit(row) : undefined;
  }

  depositForIntent(intentId: string): DepositRecord | undefined {
    const row = this.db.query("SELECT * FROM deposits WHERE intent_id=?").get(intentId) as DepositRow | null;
    return row ? this.toDeposit(row) : undefined;
  }

  depositsForSender(senderId: string, limit: number): DepositRecord[] {
    return (this.db.query("SELECT * FROM deposits WHERE sender_id=? ORDER BY created_at DESC LIMIT ?").all(senderId, limit) as DepositRow[]).map((row) => this.toDeposit(row));
  }

  recentDeposits(limit: number): DepositRecord[] {
    return (this.db.query("SELECT * FROM deposits ORDER BY created_at DESC LIMIT ?").all(limit) as DepositRow[]).map((row) => this.toDeposit(row));
  }

  pendingDeposits(): DepositRecord[] {
    return (this.db.query("SELECT * FROM deposits WHERE state IN ('received','held') ORDER BY created_at").all() as DepositRow[]).map((row) => this.toDeposit(row));
  }

  transitionDeposit(id: string, from: DepositState, to: DepositState, patch: Partial<Pick<DepositRecord, "holdReason" | "intentId" | "relayUsdcUnits" | "result" | "senderId">> = {}): boolean {
    const sets = ["state=?", "updated_at=?"];
    const values: Array<string | number | null> = [to, Date.now()];
    if (patch.holdReason !== undefined) { sets.push("hold_reason=?"); values.push(patch.holdReason); }
    if (patch.intentId !== undefined) { sets.push("intent_id=?"); values.push(patch.intentId); }
    if (patch.relayUsdcUnits !== undefined) { sets.push("relay_usdc_units=?"); values.push(patch.relayUsdcUnits); }
    if (patch.result !== undefined) { sets.push("result=?"); values.push(patch.result); }
    if (patch.senderId !== undefined) { sets.push("sender_id=?"); values.push(patch.senderId); }
    values.push(id, from);
    return this.db.query(`UPDATE deposits SET ${sets.join(",")} WHERE id=? AND state=?`).run(...values).changes === 1;
  }

  relayedUsdcUnitsSince(sinceMs: number): bigint {
    const rows = this.db.query("SELECT relay_usdc_units FROM deposits WHERE state IN ('relaying','relayed') AND relay_usdc_units IS NOT NULL AND updated_at >= ?").all(sinceMs) as Array<{ relay_usdc_units: string }>;
    return rows.reduce((sum, row) => sum + BigInt(row.relay_usdc_units), 0n);
  }

  private toFundingAccount(row: FundingAccountRow): FundingAccount {
    return {
      senderId: row.sender_id,
      whopAccountId: row.whop_account_id,
      email: row.email,
      conversationId: row.conversation_id,
      encodedEvent: row.encoded_event,
    };
  }

  private toDeposit(row: DepositRow): DepositRecord {
    return {
      id: row.id,
      webhookId: row.webhook_id,
      whopAccountId: row.whop_account_id,
      ...(row.sender_id === null ? {} : { senderId: row.sender_id }),
      amount: row.amount,
      currency: row.currency,
      precision: row.precision,
      ...(row.usd_amount === null ? {} : { usdAmount: row.usd_amount }),
      ...(row.available_at === null ? {} : { availableAt: row.available_at }),
      ...(row.relay_usdc_units === null ? {} : { relayUsdcUnits: row.relay_usdc_units }),
      state: row.state,
      ...(row.hold_reason === null ? {} : { holdReason: row.hold_reason }),
      ...(row.intent_id === null ? {} : { intentId: row.intent_id }),
      ...(row.result === null ? {} : { result: row.result }),
      postedAt: row.posted_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private toIntent(row: IntentRow): Intent {
    return {
      id: row.id, codeHash: row.code_hash, senderId: row.sender_id, conversationId: row.conversation_id,
      sourceEventId: row.source_event_id, state: row.state, ...parseIntentAction(row.action, row.parameters_json),
      preview: row.preview, planDigest: row.plan_digest,
      expiresAt: row.expires_at, ...(row.result === null ? {} : { result: row.result }),
    };
  }
}
