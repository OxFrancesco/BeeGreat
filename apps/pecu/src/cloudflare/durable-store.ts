import { plannedCallSchema, type PlannedCall, type VerifiedMessage } from "../domain";
import { eventProcessingLeaseMs, parseIntentAction, type PecuStore, type ExecutionStep, type Intent, type IntentState } from "../state";

type SqlValue = ArrayBuffer | string | number | null;
type Row = Record<string, SqlValue>;

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
      CREATE TABLE IF NOT EXISTS pecu_chat_preferences (
        sender_id TEXT NOT NULL, conversation_id TEXT NOT NULL, yolo INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY(sender_id, conversation_id)
      );
      CREATE TABLE IF NOT EXISTS pecu_chat_details (
        sender_id TEXT NOT NULL,
        conversation_id TEXT NOT NULL,
        json TEXT NOT NULL,
        PRIMARY KEY(sender_id, conversation_id)
      );
      CREATE TABLE IF NOT EXISTS pecu_inbox_events (
        event_id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        sender_id TEXT NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('processing','completed','failed')),
        reply_text TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS pecu_wallets (
        sender_id TEXT PRIMARY KEY,
        locator TEXT NOT NULL UNIQUE,
        address TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS pecu_aero_intents (
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
      CREATE TABLE IF NOT EXISTS pecu_aero_execution_steps (
        intent_id TEXT NOT NULL REFERENCES pecu_aero_intents(id),
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
      CREATE TABLE IF NOT EXISTS pecu_outbox (
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
      CREATE TABLE IF NOT EXISTS pecu_transport_state (
        conversation_id TEXT PRIMARY KEY,
        pagination_token TEXT,
        updated_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS pecu_agent_sessions (
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
    `);
  }

  yoloEnabled(senderId: string, conversationId: string): boolean {
    return this.first<{ yolo: number }>("SELECT yolo FROM pecu_chat_preferences WHERE sender_id=? AND conversation_id=?", senderId, conversationId)?.yolo === 1;
  }
  setYolo(senderId: string, conversationId: string, enabled: boolean): void {
    this.sql.exec("INSERT INTO pecu_chat_preferences VALUES (?, ?, ?) ON CONFLICT(sender_id, conversation_id) DO UPDATE SET yolo=excluded.yolo", senderId, conversationId, Number(enabled));
  }
  outgoingReplyText(messageId: string, conversationId: string): string | undefined {
    return this.first<{ text: string }>("SELECT text FROM pecu_outbox WHERE conversation_id=? AND json_extract(payload_json, '$.messageId')=?", conversationId, messageId)?.text;
  }

  chatDetails(senderId: string, conversationId: string): string | undefined {
    return this.first<{ json: string }>("SELECT json FROM pecu_chat_details WHERE sender_id=? AND conversation_id=?", senderId, conversationId)?.json;
  }

  saveChatDetails(senderId: string, conversationId: string, json: string): void {
    this.sql.exec("INSERT INTO pecu_chat_details VALUES (?, ?, ?) ON CONFLICT(sender_id, conversation_id) DO UPDATE SET json=excluded.json", senderId, conversationId, json);
  }

  claimEvent(eventId: string, conversationId: string, senderId: string, retryUnanswered = false, now = Date.now()): "claimed" | "completed" | "busy" {
    const reclaimed = retryUnanswered
      ? this.sql.exec(
        "UPDATE pecu_inbox_events SET status='processing',updated_at=? WHERE event_id=? AND reply_text IS NULL RETURNING event_id",
        now,
        eventId,
      )
      : this.sql.exec(
        "UPDATE pecu_inbox_events SET status='processing',updated_at=? WHERE event_id=? AND status='processing' AND reply_text IS NULL AND updated_at<=? RETURNING event_id",
        now,
        eventId,
        now - eventProcessingLeaseMs,
      );
    if (reclaimed.toArray().length === 1) return "claimed";
    const inserted = this.sql.exec(
      "INSERT OR IGNORE INTO pecu_inbox_events VALUES (?, ?, ?, 'processing', NULL, ?, ?) RETURNING event_id",
      eventId,
      conversationId,
      senderId,
      now,
      now,
    );
    if (inserted.toArray().length === 1) return "claimed";
    const row = this.first<{ status: string }>("SELECT status FROM pecu_inbox_events WHERE event_id = ?", eventId);
    return row?.status === "completed" ? "completed" : "busy";
  }

  completeEvent(eventId: string, replyText: string): void {
    this.sql.exec(
      "UPDATE pecu_inbox_events SET status='completed',reply_text=?,updated_at=? WHERE event_id=?",
      replyText,
      Date.now(),
      eventId,
    );
  }

  ignoreEvent(eventId: string, conversationId: string, senderId: string): void {
    const now = Date.now();
    this.sql.exec(
      "INSERT OR IGNORE INTO pecu_inbox_events VALUES (?, ?, ?, 'completed', NULL, ?, ?)",
      eventId,
      conversationId,
      senderId,
      now,
      now,
    );
  }

  eventReply(eventId: string): string | undefined {
    return this.first<{ reply_text: string | null }>(
      "SELECT reply_text FROM pecu_inbox_events WHERE event_id=?",
      eventId,
    )?.reply_text ?? undefined;
  }

  wallet(senderId: string): { locator: string; address: string } | undefined {
    return this.first<{ locator: string; address: string }>(
      "SELECT locator,address FROM pecu_wallets WHERE sender_id=?",
      senderId,
    );
  }

  saveWallet(senderId: string, locator: string, address: string): void {
    this.sql.exec(
      `INSERT INTO pecu_wallets VALUES (?,?,?,?) ON CONFLICT(sender_id) DO UPDATE SET
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
        `INSERT INTO pecu_aero_intents
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
          `INSERT INTO pecu_aero_execution_steps
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
    const row = this.first<IntentRow>("SELECT * FROM pecu_aero_intents WHERE source_event_id=?", eventId);
    return row ? this.toIntent(row) : undefined;
  }

  intentForCode(codeHash: string): Intent | undefined {
    const row = this.first<IntentRow>("SELECT * FROM pecu_aero_intents WHERE code_hash=?", codeHash);
    return row ? this.toIntent(row) : undefined;
  }

  executingIntents(): Intent[] {
    return this.sql.exec<IntentRow>(
      "SELECT * FROM pecu_aero_intents WHERE state='executing' ORDER BY created_at",
    ).toArray().map((row) => this.toIntent(row));
  }

  transitionIntent(id: string, from: IntentState, to: IntentState, result?: string): boolean {
    return this.sql.exec(
      "UPDATE pecu_aero_intents SET state=?,result=?,updated_at=? WHERE id=? AND state=? RETURNING id",
      to,
      result ?? null,
      Date.now(),
      id,
      from,
    ).toArray().length === 1;
  }

  steps(intentId: string): ExecutionStep[] {
    return this.sql.exec<Row>(
      "SELECT * FROM pecu_aero_execution_steps WHERE intent_id=? ORDER BY position",
      intentId,
    ).toArray().map((row) => ({
      intentId: String(row.intent_id),
      position: Number(row.position),
      state: String(row.state) as ExecutionStep["state"],
      call: plannedCallSchema.parse({
        role: row.role,
        from: row.from_address,
        to: row.to_address,
        data: row.data,
        value: row.value,
      }),
      ...(row.transaction_id === null ? {} : { transactionId: String(row.transaction_id) }),
      ...(row.hash === null ? {} : { hash: String(row.hash) }),
    }));
  }

  markStepPrepared(intentId: string, position: number, transactionId: string): void {
    this.sql.exec(
      "UPDATE pecu_aero_execution_steps SET state='prepared',transaction_id=? WHERE intent_id=? AND position=? AND state='planned'",
      transactionId,
      intentId,
      position,
    );
  }

  markStepSubmitted(intentId: string, position: number, hash: string): void {
    this.sql.exec(
      "UPDATE pecu_aero_execution_steps SET state='submitted',hash=? WHERE intent_id=? AND position=? AND state IN ('prepared','submitted')",
      hash,
      intentId,
      position,
    );
  }

  markStepSucceeded(intentId: string, position: number, hash?: string): void {
    this.sql.exec(
      "UPDATE pecu_aero_execution_steps SET state='succeeded',hash=? WHERE intent_id=? AND position=?",
      hash ?? null,
      intentId,
      position,
    );
  }

  markStepFailed(intentId: string, position: number, error: string): void {
    this.sql.exec(
      "UPDATE pecu_aero_execution_steps SET state='failed',error=? WHERE intent_id=? AND position=?",
      error,
      intentId,
      position,
    );
  }

  enqueueReply(correlationKey: string, conversationId: string, replyToEvent: string, text: string): void {
    const now = Date.now();
    this.sql.exec(
      `INSERT OR IGNORE INTO pecu_outbox
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
      `SELECT id,conversation_id,reply_to_event,text,payload_json FROM pecu_outbox
       WHERE state IN ('pending','prepared','failed') ORDER BY created_at LIMIT 50`,
    ).toArray().map((row) => ({
      id: String(row.id),
      conversationId: String(row.conversation_id),
      replyToEvent: String(row.reply_to_event),
      text: String(row.text),
      ...(row.payload_json === null ? {} : { payloadJson: String(row.payload_json) }),
    }));
  }

  prepareReply(id: string, payloadJson: string): void {
    this.sql.exec("UPDATE pecu_outbox SET state='prepared',payload_json=?,updated_at=? WHERE id=?", payloadJson, Date.now(), id);
  }

  sentReply(id: string): void {
    this.sql.exec("UPDATE pecu_outbox SET state='sent',updated_at=? WHERE id=?", Date.now(), id);
  }

  failReply(id: string, error: string): void {
    this.sql.exec(
      "UPDATE pecu_outbox SET state='failed',attempts=attempts+1,last_error=?,updated_at=? WHERE id=?",
      error,
      Date.now(),
      id,
    );
  }

  transportInitialized(conversationId: string, bootstrapVersion?: string): boolean {
    const row = this.first<{ pagination_token: string | null }>(
      "SELECT pagination_token FROM pecu_transport_state WHERE conversation_id=?",
      conversationId,
    );
    return row !== undefined && (bootstrapVersion === undefined || row.pagination_token === bootstrapVersion);
  }

  savePaginationToken(conversationId: string, token?: string): void {
    this.sql.exec(
      `INSERT INTO pecu_transport_state VALUES (?,?,?) ON CONFLICT(conversation_id) DO UPDATE SET
       pagination_token=excluded.pagination_token,updated_at=excluded.updated_at`,
      conversationId,
      token ?? null,
      Date.now(),
    );
  }

  agentSession(senderId: string, conversationId: string): string | undefined {
    return this.first<{ session_id: string }>(
      "SELECT session_id FROM pecu_agent_sessions WHERE sender_id=? AND conversation_id=?",
      senderId,
      conversationId,
    )?.session_id;
  }

  saveAgentSession(senderId: string, conversationId: string, sessionId: string): void {
    const now = Date.now();
    this.sql.exec(
      `INSERT INTO pecu_agent_sessions (sender_id,conversation_id,session_id,created_at,updated_at)
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
      `UPDATE pecu_agent_sessions SET event_id=?,message_text=?,encoded_event=?,updated_at=?
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
       FROM pecu_agent_sessions WHERE session_id=?`,
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

  private first<T extends Row>(query: string, ...bindings: unknown[]): T | undefined {
    return this.sql.exec<T>(query, ...bindings).toArray()[0];
  }

  private toIntent(row: IntentRow): Intent {
    return {
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
      ...(row.result === null ? {} : { result: row.result }),
    };
  }
}
