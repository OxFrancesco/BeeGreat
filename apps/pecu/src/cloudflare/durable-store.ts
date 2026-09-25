import { executionStepFromRow, type ExecutionStepRow } from "../execution-step-row";
import { coalescePolymarketAnalytics } from "../integrations/polymarket/analytics";
import { polymarketTokenSchema, type PolymarketToken } from "../integrations/polymarket/model-output";
import { analyticsResultSchema, type AnalyticsResult } from "../analytics-contract";
import { stockSnapshotSchema, type StockSnapshot } from "../stock-contract";
import { transactionPlanSchema, type TransactionPlan } from "../transaction-plan-contract";
import { agentQuestionSchema, type AgentQuestion, type PlannedCall, type VerifiedMessage } from "../domain";
import { eventProcessingLeaseMs, parseIntentAction, type PecuStore, type DepositRecord, type DepositState, type ExecutionStep, type FundingAccount, type Intent, type IntentState } from "../state";

type SqlValue = ArrayBuffer | string | number | null;
type Row = Record<string, SqlValue>;

type FundingAccountRow = Row & {
  sender_id: string;
  whop_account_id: string;
  email: string;
  conversation_id: string;
  encoded_event: string;
};

type DepositRow = Row & {
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

type IntentRow = Row & {
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

export class DurableStore implements PecuStore {
  private readonly sql: SqlStorage;

  constructor(private readonly storage: DurableObjectStorage) {
    this.sql = storage.sql;
  }

  initialize(): void {
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS basedbot_polymarket_tokens (event_id TEXT NOT NULL, token_id TEXT NOT NULL, json TEXT NOT NULL, PRIMARY KEY(event_id,token_id));
      CREATE TABLE IF NOT EXISTS basedbot_analytics (event_id TEXT NOT NULL, chart_key TEXT NOT NULL, json TEXT NOT NULL, PRIMARY KEY(event_id,chart_key));
      CREATE TABLE IF NOT EXISTS basedbot_stock_snapshots (event_id TEXT PRIMARY KEY, json TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS basedbot_transaction_plans (intent_id TEXT PRIMARY KEY, json TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS basedbot_questions (
        event_id TEXT PRIMARY KEY, sender_id TEXT NOT NULL, conversation_id TEXT NOT NULL,
        json TEXT NOT NULL, answered_event_id TEXT
      );
      CREATE INDEX IF NOT EXISTS basedbot_questions_owner ON basedbot_questions(sender_id,conversation_id);
      CREATE TABLE IF NOT EXISTS basedbot_chat_preferences (
        sender_id TEXT NOT NULL, conversation_id TEXT NOT NULL, yolo INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY(sender_id, conversation_id)
      );
      CREATE TABLE IF NOT EXISTS basedbot_chat_details (
        sender_id TEXT NOT NULL,
        conversation_id TEXT NOT NULL,
        json TEXT NOT NULL,
        PRIMARY KEY(sender_id, conversation_id)
      );
      CREATE TABLE IF NOT EXISTS basedbot_inbox_events (
        event_id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        sender_id TEXT NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('processing','completed','failed')),
        reply_text TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS basedbot_wallets (
        sender_id TEXT PRIMARY KEY,
        locator TEXT NOT NULL UNIQUE,
        address TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS basedbot_aero_intents (
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
      CREATE TABLE IF NOT EXISTS basedbot_aero_execution_steps (
        intent_id TEXT NOT NULL REFERENCES basedbot_aero_intents(id),
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
      CREATE TABLE IF NOT EXISTS basedbot_outbox (
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
      CREATE TABLE IF NOT EXISTS basedbot_transport_state (
        conversation_id TEXT PRIMARY KEY,
        pagination_token TEXT,
        updated_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS basedbot_agent_sessions (
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
      CREATE TABLE IF NOT EXISTS basedbot_funding_accounts (
        sender_id TEXT PRIMARY KEY,
        whop_account_id TEXT NOT NULL UNIQUE,
        email TEXT NOT NULL,
        conversation_id TEXT NOT NULL,
        encoded_event TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS basedbot_deposits (
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
      this.sql.exec("INSERT OR REPLACE INTO basedbot_polymarket_tokens VALUES(?,?,?)", eventId, value.tokenId, JSON.stringify(value));
    }
  }

  polymarketToken(eventId: string, tokenId: string): PolymarketToken | undefined {
    const row = this.first<{json:string}>("SELECT json FROM basedbot_polymarket_tokens WHERE event_id=? AND token_id=?",eventId,tokenId);
    return row ? polymarketTokenSchema.parse(JSON.parse(row.json)) : undefined;
  }

  saveAnalytics(eventId: string, result: AnalyticsResult): void {
    const value = analyticsResultSchema.parse(result);
    this.sql.exec("INSERT OR REPLACE INTO basedbot_analytics(event_id,chart_key,json) VALUES(?,?,?)", eventId, value.snapshot.key, JSON.stringify(value));
  }

  analytics(eventId: string): AnalyticsResult[] {
    return coalescePolymarketAnalytics(this.sql.exec<{ json: string }>("SELECT json FROM basedbot_analytics WHERE event_id=? ORDER BY rowid DESC LIMIT 12", eventId).toArray().reverse().map((row) => analyticsResultSchema.parse(JSON.parse(row.json))));
  }

  saveStockSnapshot(eventId: string, snapshot: StockSnapshot): void {
    this.sql.exec("INSERT OR REPLACE INTO basedbot_stock_snapshots(event_id,json) VALUES(?,?)", eventId, JSON.stringify(stockSnapshotSchema.parse(snapshot)));
  }

  stockSnapshot(eventId: string): StockSnapshot | undefined {
    const row = this.first<{ json: string }>("SELECT json FROM basedbot_stock_snapshots WHERE event_id=?", eventId);
    return row ? stockSnapshotSchema.parse(JSON.parse(row.json)) : undefined;
  }

  saveTransactionPlan(intentId: string, plan: TransactionPlan): void {
    this.sql.exec("INSERT OR REPLACE INTO basedbot_transaction_plans(intent_id,json) VALUES(?,?)", intentId, JSON.stringify(transactionPlanSchema.parse(plan)));
  }

  /** A plan stored by an older release that no longer parses is treated as missing. */
  transactionPlan(intentId: string): TransactionPlan | undefined {
    const row = this.first<{ json: string }>("SELECT json FROM basedbot_transaction_plans WHERE intent_id=?", intentId);
    return row ? transactionPlanSchema.safeParse(JSON.parse(row.json)).data : undefined;
  }

  saveQuestion(message: VerifiedMessage, question: AgentQuestion): void {
    this.sql.exec("UPDATE basedbot_questions SET answered_event_id=? WHERE sender_id=? AND conversation_id=? AND answered_event_id IS NULL AND event_id<>?", message.eventId, message.senderId, message.conversationId, message.eventId);
    this.sql.exec("INSERT OR IGNORE INTO basedbot_questions(event_id,sender_id,conversation_id,json) VALUES(?,?,?,?)", message.eventId, message.senderId, message.conversationId, JSON.stringify(agentQuestionSchema.parse(question)));
  }

  questionForEvent(eventId: string): AgentQuestion | undefined {
    const row = this.first<{ json: string }>("SELECT json FROM basedbot_questions WHERE event_id=?", eventId);
    return row ? agentQuestionSchema.parse(JSON.parse(row.json)) : undefined;
  }

  answerPendingQuestion(message: VerifiedMessage): boolean {
    const row = this.first<{ event_id: string }>("SELECT event_id FROM basedbot_questions WHERE sender_id=? AND conversation_id=? AND event_id<>? AND (answered_event_id IS NULL OR answered_event_id=?) ORDER BY rowid DESC LIMIT 1", message.senderId, message.conversationId, message.eventId, message.eventId);
    if (!row) return false;
    this.sql.exec("UPDATE basedbot_questions SET answered_event_id=? WHERE event_id=?", message.eventId, row.event_id);
    return true;
  }

  yoloEnabled(senderId: string, conversationId: string): boolean {
    return this.first<{ yolo: number }>("SELECT yolo FROM basedbot_chat_preferences WHERE sender_id=? AND conversation_id=?", senderId, conversationId)?.yolo === 1;
  }
  setYolo(senderId: string, conversationId: string, enabled: boolean): void {
    this.sql.exec("INSERT INTO basedbot_chat_preferences VALUES (?, ?, ?) ON CONFLICT(sender_id, conversation_id) DO UPDATE SET yolo=excluded.yolo", senderId, conversationId, Number(enabled));
  }
  outgoingReplyText(messageId: string, conversationId: string): string | undefined {
    return this.first<{ text: string }>("SELECT text FROM basedbot_outbox WHERE conversation_id=? AND json_extract(payload_json, '$.messageId')=?", conversationId, messageId)?.text;
  }

  chatDetails(senderId: string, conversationId: string): string | undefined {
    return this.first<{ json: string }>("SELECT json FROM basedbot_chat_details WHERE sender_id=? AND conversation_id=?", senderId, conversationId)?.json;
  }

  saveChatDetails(senderId: string, conversationId: string, json: string): void {
    this.sql.exec("INSERT INTO basedbot_chat_details VALUES (?, ?, ?) ON CONFLICT(sender_id, conversation_id) DO UPDATE SET json=excluded.json", senderId, conversationId, json);
  }

  claimEvent(eventId: string, conversationId: string, senderId: string, retryUnanswered = false, now = Date.now()): "claimed" | "completed" | "busy" {
    const reclaimed = retryUnanswered
      ? this.sql.exec(
        "UPDATE basedbot_inbox_events SET status='processing',updated_at=? WHERE event_id=? AND reply_text IS NULL RETURNING event_id",
        now,
        eventId,
      )
      : this.sql.exec(
        "UPDATE basedbot_inbox_events SET status='processing',updated_at=? WHERE event_id=? AND status='processing' AND reply_text IS NULL AND updated_at<=? RETURNING event_id",
        now,
        eventId,
        now - eventProcessingLeaseMs,
      );
    if (reclaimed.toArray().length === 1) return "claimed";
    const inserted = this.sql.exec(
      "INSERT OR IGNORE INTO basedbot_inbox_events VALUES (?, ?, ?, 'processing', NULL, ?, ?) RETURNING event_id",
      eventId,
      conversationId,
      senderId,
      now,
      now,
    );
    if (inserted.toArray().length === 1) return "claimed";
    const row = this.first<{ status: string }>("SELECT status FROM basedbot_inbox_events WHERE event_id = ?", eventId);
    return row?.status === "completed" ? "completed" : "busy";
  }

  completeEvent(eventId: string, replyText: string): void {
    this.sql.exec(
      "UPDATE basedbot_inbox_events SET status='completed',reply_text=?,updated_at=? WHERE event_id=?",
      replyText,
      Date.now(),
      eventId,
    );
  }

  ignoreEvent(eventId: string, conversationId: string, senderId: string): void {
    const now = Date.now();
    this.sql.exec(
      "INSERT OR IGNORE INTO basedbot_inbox_events VALUES (?, ?, ?, 'completed', NULL, ?, ?)",
      eventId,
      conversationId,
      senderId,
      now,
      now,
    );
  }

  eventReply(eventId: string): string | undefined {
    return this.first<{ reply_text: string | null }>(
      "SELECT reply_text FROM basedbot_inbox_events WHERE event_id=?",
      eventId,
    )?.reply_text ?? undefined;
  }

  wallet(senderId: string): { locator: string; address: string } | undefined {
    return this.first<{ locator: string; address: string }>(
      "SELECT locator,address FROM basedbot_wallets WHERE sender_id=?",
      senderId,
    );
  }

  saveWallet(senderId: string, locator: string, address: string): void {
    this.sql.exec(
      `INSERT INTO basedbot_wallets VALUES (?,?,?,?) ON CONFLICT(sender_id) DO UPDATE SET
       locator=excluded.locator,address=excluded.address`,
      senderId,
      locator,
      address,
      Date.now(),
    );
  }

  createIntent(intent: Intent, calls: readonly PlannedCall[]): void {
    const now = Date.now();
    this.storage.transactionSync(() => {
      this.sql.exec(
        `INSERT INTO basedbot_aero_intents
        (id,code_hash,sender_id,conversation_id,source_event_id,state,action,parameters_json,preview,plan_digest,expires_at,result,created_at,updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        intent.id,
        intent.codeHash,
        intent.senderId,
        intent.conversationId,
        intent.sourceEventId,
        intent.state,
        intent.action,
        JSON.stringify(intent.parameters),
        intent.preview,
        intent.planDigest,
        intent.expiresAt,
        intent.result ?? null,
        now,
        now,
      );
      calls.forEach((call, position) => {
        this.sql.exec(
          `INSERT INTO basedbot_aero_execution_steps
          (intent_id,position,role,from_address,to_address,data,value,state) VALUES (?,?,?,?,?,?,?,'planned')`,
          intent.id,
          position,
          call.role,
          call.from,
          call.to,
          call.data,
          call.value,
        );
      });
    });
  }

  intentForSource(eventId: string): Intent | undefined {
    const row = this.first<IntentRow>("SELECT * FROM basedbot_aero_intents WHERE source_event_id=?", eventId);
    return row ? this.toIntent(row) : undefined;
  }

  intentForCode(codeHash: string, senderId: string, conversationId: string): Intent | undefined {
    const row = this.first<IntentRow>(
      "SELECT * FROM basedbot_aero_intents WHERE code_hash=? AND sender_id=? AND conversation_id=?",
      codeHash,
      senderId,
      conversationId,
    );
    return row ? this.toIntent(row) : undefined;
  }

  executingIntents(): Intent[] {
    return this.sql.exec<IntentRow>(
      "SELECT * FROM basedbot_aero_intents WHERE state='executing' ORDER BY created_at",
    ).toArray().map((row) => this.toIntent(row));
  }

  transitionIntent(id: string, from: IntentState, to: IntentState, result?: string): boolean {
    return this.sql.exec(
      "UPDATE basedbot_aero_intents SET state=?,result=?,updated_at=? WHERE id=? AND state=? RETURNING id",
      to,
      result ?? null,
      Date.now(),
      id,
      from,
    ).toArray().length === 1;
  }

  steps(intentId: string): ExecutionStep[] {
    return this.sql.exec<ExecutionStepRow>("SELECT * FROM basedbot_aero_execution_steps WHERE intent_id=? ORDER BY position", intentId).toArray().map(executionStepFromRow);
  }

  markStepPrepared(intentId: string, position: number, transactionId: string): void {
    this.sql.exec(
      "UPDATE basedbot_aero_execution_steps SET state='prepared',transaction_id=? WHERE intent_id=? AND position=? AND state='planned'",
      transactionId,
      intentId,
      position,
    );
  }

  markStepSubmitted(intentId: string, position: number, hash: string): void {
    this.sql.exec(
      "UPDATE basedbot_aero_execution_steps SET state='submitted',hash=? WHERE intent_id=? AND position=? AND state IN ('prepared','submitted')",
      hash,
      intentId,
      position,
    );
  }

  markStepSucceeded(intentId: string, position: number, hash?: string): void {
    this.sql.exec(
      "UPDATE basedbot_aero_execution_steps SET state='succeeded',hash=? WHERE intent_id=? AND position=?",
      hash ?? null,
      intentId,
      position,
    );
  }

  markStepFailed(intentId: string, position: number, error: string): void {
    this.sql.exec(
      "UPDATE basedbot_aero_execution_steps SET state='failed',error=? WHERE intent_id=? AND position=?",
      error,
      intentId,
      position,
    );
  }

  enqueueReply(correlationKey: string, conversationId: string, replyToEvent: string, text: string): void {
    const now = Date.now();
    this.sql.exec(
      `INSERT OR IGNORE INTO basedbot_outbox
       (id,correlation_key,conversation_id,reply_to_event,text,state,created_at,updated_at)
       VALUES (?,?,?,?,?,'pending',?,?)`,
      crypto.randomUUID(),
      correlationKey,
      conversationId,
      replyToEvent,
      text,
      now,
      now,
    );
  }

  pendingReplies(): Array<{ id: string; conversationId: string; replyToEvent: string; text: string; payloadJson?: string }> {
    return this.sql.exec<Row>(
      `SELECT id,conversation_id,reply_to_event,text,payload_json FROM basedbot_outbox
       WHERE state IN ('pending','prepared','failed') ORDER BY created_at LIMIT 50`,
    ).toArray().map((row) => {
      const reply = { id: String(row.id), conversationId: String(row.conversation_id), replyToEvent: String(row.reply_to_event), text: String(row.text) };
      return row.payload_json === null ? reply : { ...reply, payloadJson: String(row.payload_json) };
    });
  }

  prepareReply(id: string, payloadJson: string): void {
    this.sql.exec("UPDATE basedbot_outbox SET state='prepared',payload_json=?,updated_at=? WHERE id=?", payloadJson, Date.now(), id);
  }

  sentReply(id: string): void {
    this.sql.exec("UPDATE basedbot_outbox SET state='sent',updated_at=? WHERE id=?", Date.now(), id);
  }

  failReply(id: string, error: string): void {
    this.sql.exec(
      "UPDATE basedbot_outbox SET state='failed',attempts=attempts+1,last_error=?,updated_at=? WHERE id=?",
      error,
      Date.now(),
      id,
    );
  }

  transportInitialized(conversationId: string, bootstrapVersion?: string): boolean {
    const row = this.first<{ pagination_token: string | null }>(
      "SELECT pagination_token FROM basedbot_transport_state WHERE conversation_id=?",
      conversationId,
    );
    return row !== undefined && (bootstrapVersion === undefined || row.pagination_token === bootstrapVersion);
  }

  savePaginationToken(conversationId: string, token?: string): void {
    this.sql.exec(
      `INSERT INTO basedbot_transport_state VALUES (?,?,?) ON CONFLICT(conversation_id) DO UPDATE SET
       pagination_token=excluded.pagination_token,updated_at=excluded.updated_at`,
      conversationId,
      token ?? null,
      Date.now(),
    );
  }

  agentSession(senderId: string, conversationId: string): string | undefined {
    return this.first<{ session_id: string }>(
      "SELECT session_id FROM basedbot_agent_sessions WHERE sender_id=? AND conversation_id=?",
      senderId,
      conversationId,
    )?.session_id;
  }

  saveAgentSession(senderId: string, conversationId: string, sessionId: string): void {
    const now = Date.now();
    this.sql.exec(
      `INSERT INTO basedbot_agent_sessions (sender_id,conversation_id,session_id,created_at,updated_at)
       VALUES (?,?,?,?,?) ON CONFLICT(sender_id,conversation_id) DO UPDATE SET
       session_id=excluded.session_id,updated_at=excluded.updated_at`,
      senderId,
      conversationId,
      sessionId,
      now,
      now,
    );
  }

  saveAgentTurn(sessionId: string, message: VerifiedMessage): void {
    this.sql.exec(
      `UPDATE basedbot_agent_sessions SET event_id=?,message_text=?,encoded_event=?,updated_at=?
       WHERE session_id=? AND sender_id=? AND conversation_id=?`,
      message.eventId,
      message.text,
      message.encodedEvent,
      Date.now(),
      sessionId,
      message.senderId,
      message.conversationId,
    );
  }

  agentTurn(sessionId: string): VerifiedMessage | undefined {
    const row = this.first<{
      sender_id: string;
      conversation_id: string;
      event_id: string | null;
      message_text: string | null;
      encoded_event: string | null;
    }>(
      `SELECT sender_id,conversation_id,event_id,message_text,encoded_event
       FROM basedbot_agent_sessions WHERE session_id=?`,
      sessionId,
    );
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
    const row = this.first<FundingAccountRow>("SELECT * FROM basedbot_funding_accounts WHERE sender_id=?", senderId);
    return row ? this.toFundingAccount(row) : undefined;
  }

  fundingAccountByWhopId(whopAccountId: string): FundingAccount | undefined {
    const row = this.first<FundingAccountRow>("SELECT * FROM basedbot_funding_accounts WHERE whop_account_id=?", whopAccountId);
    return row ? this.toFundingAccount(row) : undefined;
  }

  saveFundingAccount(account: FundingAccount): void {
    const now = Date.now();
    this.sql.exec(
      `INSERT INTO basedbot_funding_accounts (sender_id,whop_account_id,email,conversation_id,encoded_event,created_at,updated_at)
       VALUES (?,?,?,?,?,?,?)
       ON CONFLICT(sender_id) DO UPDATE SET whop_account_id=excluded.whop_account_id,email=excluded.email,
       conversation_id=excluded.conversation_id,encoded_event=excluded.encoded_event,updated_at=excluded.updated_at`,
      account.senderId,
      account.whopAccountId,
      account.email,
      account.conversationId,
      account.encodedEvent,
      now,
      now,
    );
  }

  touchFundingAccount(senderId: string, conversationId: string, encodedEvent: string): void {
    if (encodedEvent === "") return;
    this.sql.exec(
      "UPDATE basedbot_funding_accounts SET conversation_id=?,encoded_event=?,updated_at=? WHERE sender_id=?",
      conversationId,
      encodedEvent,
      Date.now(),
      senderId,
    );
  }

  recordDeposit(deposit: Omit<DepositRecord, "createdAt" | "updatedAt">): boolean {
    const now = Date.now();
    return this.sql.exec(
      `INSERT OR IGNORE INTO basedbot_deposits
       (id,webhook_id,whop_account_id,sender_id,amount,currency,precision,usd_amount,available_at,relay_usdc_units,state,hold_reason,intent_id,result,posted_at,created_at,updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) RETURNING id`,
      deposit.id,
      deposit.webhookId,
      deposit.whopAccountId,
      deposit.senderId ?? null,
      deposit.amount,
      deposit.currency,
      deposit.precision,
      deposit.usdAmount ?? null,
      deposit.availableAt ?? null,
      deposit.relayUsdcUnits ?? null,
      deposit.state,
      deposit.holdReason ?? null,
      deposit.intentId ?? null,
      deposit.result ?? null,
      deposit.postedAt,
      now,
      now,
    ).toArray().length === 1;
  }

  deposit(id: string): DepositRecord | undefined {
    const row = this.first<DepositRow>("SELECT * FROM basedbot_deposits WHERE id=?", id);
    return row ? this.toDeposit(row) : undefined;
  }

  depositForIntent(intentId: string): DepositRecord | undefined {
    const row = this.first<DepositRow>("SELECT * FROM basedbot_deposits WHERE intent_id=?", intentId);
    return row ? this.toDeposit(row) : undefined;
  }

  depositsForSender(senderId: string, limit: number): DepositRecord[] {
    return this.sql.exec<DepositRow>(
      "SELECT * FROM basedbot_deposits WHERE sender_id=? ORDER BY created_at DESC LIMIT ?",
      senderId,
      limit,
    ).toArray().map((row) => this.toDeposit(row));
  }

  recentDeposits(limit: number): DepositRecord[] {
    return this.sql.exec<DepositRow>(
      "SELECT * FROM basedbot_deposits ORDER BY created_at DESC LIMIT ?",
      limit,
    ).toArray().map((row) => this.toDeposit(row));
  }

  pendingDeposits(): DepositRecord[] {
    return this.sql.exec<DepositRow>(
      "SELECT * FROM basedbot_deposits WHERE state IN ('received','held') ORDER BY created_at",
    ).toArray().map((row) => this.toDeposit(row));
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
    return this.sql.exec(`UPDATE basedbot_deposits SET ${sets.join(",")} WHERE id=? AND state=? RETURNING id`, ...values).toArray().length === 1;
  }

  relayedUsdcUnitsSince(sinceMs: number): bigint {
    return this.sql.exec<{ relay_usdc_units: string } & Row>(
      "SELECT relay_usdc_units FROM basedbot_deposits WHERE state IN ('relaying','relayed') AND relay_usdc_units IS NOT NULL AND updated_at >= ?",
      sinceMs,
    ).toArray().reduce((sum, row) => sum + BigInt(row.relay_usdc_units), 0n);
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
    let deposit: DepositRecord = {
      id: row.id, webhookId: row.webhook_id, whopAccountId: row.whop_account_id,
      amount: row.amount, currency: row.currency, precision: row.precision, state: row.state,
      postedAt: row.posted_at, createdAt: row.created_at, updatedAt: row.updated_at,
    };
    if (row.sender_id !== null) deposit = { ...deposit, senderId: row.sender_id };
    if (row.usd_amount !== null) deposit = { ...deposit, usdAmount: row.usd_amount };
    if (row.available_at !== null) deposit = { ...deposit, availableAt: row.available_at };
    if (row.relay_usdc_units !== null) deposit = { ...deposit, relayUsdcUnits: row.relay_usdc_units };
    if (row.hold_reason !== null) deposit = { ...deposit, holdReason: row.hold_reason };
    if (row.intent_id !== null) deposit = { ...deposit, intentId: row.intent_id };
    if (row.result !== null) deposit = { ...deposit, result: row.result };
    return deposit;
  }

  private first<T extends Row>(query: string, ...bindings: SqlValue[]): T | undefined {
    return this.sql.exec<T>(query, ...bindings).toArray()[0];
  }

  private toIntent(row: IntentRow): Intent {
    const intent: Intent = {
      id: row.id,
      codeHash: row.code_hash,
      senderId: row.sender_id,
      conversationId: row.conversation_id,
      sourceEventId: row.source_event_id,
      state: row.state,
      ...parseIntentAction(row.action, row.parameters_json),
      preview: row.preview,
      planDigest: row.plan_digest,
      expiresAt: row.expires_at,
    };
    return row.result === null ? intent : { ...intent, result: row.result };
  }
}
