import { z } from "zod";
import type { WebSql } from "./web";
import { grantSchema, triggerSchema, type Grant, type NotificationKind, type NotificationView, type TaskMode, type TaskState, type Trigger } from "./task-contract";
import { isWebConversation } from "./web-identity";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export type TaskRecord = Readonly<{
  id: string;
  code: string;
  senderId: string;
  conversationId: string;
  /** The verified X event that created the task, used as the reply anchor for X deliveries. Empty for web. */
  encodedEvent: string;
  title: string;
  mode: TaskMode;
  instruction: string;
  trigger: Trigger;
  state: TaskState;
  nextRunAt: number | null;
  lastRunAt: number | null;
  lastOutcome: string | null;
  runCount: number;
  grant: Grant | null;
  createdAt: number;
  updatedAt: number;
}>;

export type RunState = "running" | "done" | "quiet" | "failed" | "deferred";
export type TaskRun = Readonly<{ id: string; taskId: string; scheduledFor: number; attempt: number; state: RunState; retryAt: number | null; result: string | null }>;

type TaskRow = {
  id: string; code: string; sender_id: string; conversation_id: string; encoded_event: string; title: string; mode: string;
  instruction: string; trigger_json: string; state: string; next_run_at: number | null; last_run_at: number | null;
  last_outcome: string | null; run_count: number; grant_json: string | null; created_at: number; updated_at: number;
};
type RunRow = { id: string; task_id: string; scheduled_for: number; attempt: number; state: string; retry_at: number | null; result: string | null };
type NotificationRow = { id: string; sender_id: string; task_code: string | null; conversation_id: string; kind: string; title: string; body: string; created_at: number; read_at: number | null };

const modeSchema = z.enum(["remind", "run", "heartbeat"]);
const stateSchema = z.enum(["active", "paused", "completed", "cancelled"]);
const runStateSchema = z.enum(["running", "done", "quiet", "failed", "deferred"]);
const kindSchema = z.enum(["reminder", "alert", "approval", "executed", "failed"]);

function taskFromRow(row: TaskRow): TaskRecord {
  return {
    id: row.id, code: row.code, senderId: row.sender_id, conversationId: row.conversation_id, encodedEvent: row.encoded_event,
    title: row.title, mode: modeSchema.parse(row.mode), instruction: row.instruction, trigger: triggerSchema.parse(JSON.parse(row.trigger_json)),
    state: stateSchema.parse(row.state), nextRunAt: row.next_run_at, lastRunAt: row.last_run_at, lastOutcome: row.last_outcome,
    runCount: row.run_count, grant: row.grant_json ? grantSchema.parse(JSON.parse(row.grant_json)) : null, createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

function runFromRow(row: RunRow): TaskRun {
  return { id: row.id, taskId: row.task_id, scheduledFor: row.scheduled_for, attempt: row.attempt, state: runStateSchema.parse(row.state), retryAt: row.retry_at, result: row.result };
}

/** The web thread id inside a web conversation id, or null for X chats and the original web conversation. */
export function threadOf(conversationId: string): string | null {
  if (!isWebConversation(conversationId)) return null;
  const index = conversationId.indexOf("#");
  return index < 0 ? null : conversationId.slice(index + 1);
}

export class TaskStore {
  constructor(private readonly sql: WebSql) {
    sql.exec(`CREATE TABLE IF NOT EXISTS basedbot_tasks (
      id TEXT PRIMARY KEY, code TEXT NOT NULL, sender_id TEXT NOT NULL, conversation_id TEXT NOT NULL, encoded_event TEXT NOT NULL,
      title TEXT NOT NULL, mode TEXT NOT NULL, instruction TEXT NOT NULL, trigger_json TEXT NOT NULL, state TEXT NOT NULL,
      next_run_at INTEGER, last_run_at INTEGER, last_outcome TEXT, run_count INTEGER NOT NULL DEFAULT 0, grant_json TEXT,
      created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, UNIQUE(sender_id, code))`);
    sql.exec("CREATE INDEX IF NOT EXISTS basedbot_tasks_due ON basedbot_tasks(state, next_run_at)");
    sql.exec(`CREATE TABLE IF NOT EXISTS basedbot_task_runs (
      id TEXT PRIMARY KEY, task_id TEXT NOT NULL, scheduled_for INTEGER NOT NULL, attempt INTEGER NOT NULL DEFAULT 1, state TEXT NOT NULL,
      retry_at INTEGER, result TEXT, created_at INTEGER NOT NULL, started_at INTEGER NOT NULL, finished_at INTEGER, UNIQUE(task_id, scheduled_for))`);
    sql.exec("CREATE INDEX IF NOT EXISTS basedbot_task_runs_retry ON basedbot_task_runs(state, retry_at)");
    sql.exec(`CREATE TABLE IF NOT EXISTS basedbot_notifications (
      id TEXT PRIMARY KEY, sender_id TEXT NOT NULL, task_code TEXT, conversation_id TEXT NOT NULL, kind TEXT NOT NULL,
      title TEXT NOT NULL, body TEXT NOT NULL, created_at INTEGER NOT NULL, read_at INTEGER)`);
    sql.exec("CREATE INDEX IF NOT EXISTS basedbot_notifications_sender ON basedbot_notifications(sender_id, created_at)");
    sql.exec(`CREATE TABLE IF NOT EXISTS basedbot_push_devices (
      token TEXT PRIMARY KEY, sender_id TEXT NOT NULL, platform TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)`);
    sql.exec("CREATE INDEX IF NOT EXISTS basedbot_push_devices_sender ON basedbot_push_devices(sender_id)");
  }

  create(input: Omit<TaskRecord, "id" | "code" | "state" | "lastRunAt" | "lastOutcome" | "runCount" | "updatedAt">): TaskRecord {
    const id = crypto.randomUUID();
    for (let attempt = 0; attempt < 8; attempt++) {
      const code = Array.from(crypto.getRandomValues(new Uint8Array(6)), (byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length]).join("");
      if (this.get(input.senderId, code)) continue;
      this.sql.exec(
        `INSERT INTO basedbot_tasks(id,code,sender_id,conversation_id,encoded_event,title,mode,instruction,trigger_json,state,next_run_at,grant_json,created_at,updated_at)
         VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        id, code, input.senderId, input.conversationId, input.encodedEvent, input.title, input.mode, input.instruction,
        JSON.stringify(input.trigger), "active", input.nextRunAt, input.grant ? JSON.stringify(input.grant) : null, input.createdAt, input.createdAt,
      );
      return this.byId(id)!;
    }
    throw new Error("Could not allocate a task code. Try again.");
  }

  byId(id: string): TaskRecord | undefined {
    const row = this.sql.exec<TaskRow>("SELECT * FROM basedbot_tasks WHERE id=?", id).toArray()[0];
    return row ? taskFromRow(row) : undefined;
  }

  get(senderId: string, code: string): TaskRecord | undefined {
    const row = this.sql.exec<TaskRow>("SELECT * FROM basedbot_tasks WHERE sender_id=? AND code=?", senderId, code.toUpperCase()).toArray()[0];
    return row ? taskFromRow(row) : undefined;
  }

  /** Active, paused and recently finished tasks, newest first. Cancelled tasks are gone from every view. */
  list(senderId: string, limit = 50): TaskRecord[] {
    return this.sql.exec<TaskRow>("SELECT * FROM basedbot_tasks WHERE sender_id=? AND state<>'cancelled' ORDER BY created_at DESC LIMIT ?", senderId, limit).toArray().map(taskFromRow);
  }

  activeCount(senderId: string): number {
    return this.sql.exec<{ count: number }>("SELECT COUNT(*) AS count FROM basedbot_tasks WHERE sender_id=? AND state IN ('active','paused')", senderId).toArray()[0]?.count ?? 0;
  }

  update(id: string, patch: Partial<Pick<TaskRecord, "title" | "mode" | "instruction" | "trigger" | "state" | "nextRunAt" | "lastRunAt" | "lastOutcome" | "runCount" | "grant">>, now = Date.now()): TaskRecord {
    const current = this.byId(id);
    if (!current) throw new Error("Task not found.");
    const next = { ...current, ...patch };
    this.sql.exec(
      "UPDATE basedbot_tasks SET title=?,mode=?,instruction=?,trigger_json=?,state=?,next_run_at=?,last_run_at=?,last_outcome=?,run_count=?,grant_json=?,updated_at=? WHERE id=?",
      next.title, next.mode, next.instruction, JSON.stringify(next.trigger), next.state, next.nextRunAt, next.lastRunAt, next.lastOutcome, next.runCount,
      next.grant ? JSON.stringify(next.grant) : null, now, id,
    );
    return this.byId(id)!;
  }

  due(now: number, limit = 10): TaskRecord[] {
    return this.sql.exec<TaskRow>("SELECT * FROM basedbot_tasks WHERE state='active' AND next_run_at IS NOT NULL AND next_run_at<=? ORDER BY next_run_at LIMIT ?", now, limit).toArray().map(taskFromRow);
  }

  /** Cancel every live task of a conversation, for example when its web thread is deleted. */
  cancelConversation(senderId: string, conversationId: string, now = Date.now()): void {
    this.sql.exec("UPDATE basedbot_tasks SET state='cancelled',next_run_at=NULL,updated_at=? WHERE sender_id=? AND conversation_id=? AND state IN ('active','paused')", now, senderId, conversationId);
  }

  /** Claim one occurrence. Returns undefined when the same occurrence was already claimed. */
  claimRun(taskId: string, scheduledFor: number, now = Date.now()): TaskRun | undefined {
    const id = crypto.randomUUID();
    this.sql.exec("INSERT OR IGNORE INTO basedbot_task_runs(id,task_id,scheduled_for,state,created_at,started_at) VALUES(?,?,?,?,?,?)", id, taskId, scheduledFor, "running", now, now);
    return this.run(id);
  }

  run(id: string): TaskRun | undefined {
    const row = this.sql.exec<RunRow>("SELECT id,task_id,scheduled_for,attempt,state,retry_at,result FROM basedbot_task_runs WHERE id=?", id).toArray()[0];
    return row ? runFromRow(row) : undefined;
  }

  deferRun(id: string, retryAt: number): void {
    this.sql.exec("UPDATE basedbot_task_runs SET state='deferred',retry_at=?,attempt=attempt+1 WHERE id=?", retryAt, id);
  }

  /** Move a deferred run back to running before retrying it; false when another sweep took it. */
  resumeRun(id: string, now = Date.now()): boolean {
    this.sql.exec("UPDATE basedbot_task_runs SET state='running',retry_at=NULL,started_at=? WHERE id=? AND state='deferred'", now, id);
    return this.run(id)?.state === "running";
  }

  finishRun(id: string, state: Exclude<RunState, "running" | "deferred">, result: string, now = Date.now()): void {
    this.sql.exec("UPDATE basedbot_task_runs SET state=?,result=?,finished_at=?,retry_at=NULL WHERE id=?", state, result.slice(0, 4000), now, id);
  }

  retryable(now: number, limit = 10): TaskRun[] {
    return this.sql.exec<RunRow>("SELECT id,task_id,scheduled_for,attempt,state,retry_at,result FROM basedbot_task_runs WHERE state='deferred' AND retry_at<=? ORDER BY retry_at LIMIT ?", now, limit).toArray().map(runFromRow);
  }

  /** Runs left `running` by an evicted object; the sweep settles them as failed instead of silently re-running. */
  staleRuns(before: number): TaskRun[] {
    return this.sql.exec<RunRow>("SELECT id,task_id,scheduled_for,attempt,state,retry_at,result FROM basedbot_task_runs WHERE state='running' AND started_at<?", before).toArray().map(runFromRow);
  }

  addNotification(input: { senderId: string; taskCode: string | null; conversationId: string; kind: NotificationKind; title: string; body: string }, now = Date.now()): NotificationView {
    const id = crypto.randomUUID();
    this.sql.exec("INSERT INTO basedbot_notifications(id,sender_id,task_code,conversation_id,kind,title,body,created_at) VALUES(?,?,?,?,?,?,?,?)",
      id, input.senderId, input.taskCode, input.conversationId, input.kind, input.title.slice(0, 120), input.body.slice(0, 1000), now);
    this.sql.exec("DELETE FROM basedbot_notifications WHERE sender_id=? AND id NOT IN (SELECT id FROM basedbot_notifications WHERE sender_id=? ORDER BY created_at DESC LIMIT 200)", input.senderId, input.senderId);
    return this.notifications(input.senderId, 1)[0]!;
  }

  notifications(senderId: string, limit = 50): NotificationView[] {
    return this.sql.exec<NotificationRow>("SELECT * FROM basedbot_notifications WHERE sender_id=? ORDER BY created_at DESC, rowid DESC LIMIT ?", senderId, limit).toArray().map((row) => ({
      id: row.id, kind: kindSchema.parse(row.kind), title: row.title, body: row.body, taskCode: row.task_code,
      channel: isWebConversation(row.conversation_id) ? "web" as const : "x" as const, threadId: threadOf(row.conversation_id), createdAt: row.created_at, readAt: row.read_at,
    }));
  }

  unread(senderId: string): number {
    return this.sql.exec<{ count: number }>("SELECT COUNT(*) AS count FROM basedbot_notifications WHERE sender_id=? AND read_at IS NULL", senderId).toArray()[0]?.count ?? 0;
  }

  markRead(senderId: string, ids: readonly string[] | undefined, now = Date.now()): void {
    if (ids === undefined) {
      this.sql.exec("UPDATE basedbot_notifications SET read_at=? WHERE sender_id=? AND read_at IS NULL", now, senderId);
      return;
    }
    for (const id of ids) this.sql.exec("UPDATE basedbot_notifications SET read_at=? WHERE sender_id=? AND id=? AND read_at IS NULL", now, senderId, id);
  }

  registerDevice(senderId: string, token: string, platform: "android", now = Date.now()): void {
    this.sql.exec("INSERT INTO basedbot_push_devices(token,sender_id,platform,created_at,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(token) DO UPDATE SET sender_id=excluded.sender_id,platform=excluded.platform,updated_at=excluded.updated_at",
      token, senderId, platform, now, now);
  }

  unregisterDevice(senderId: string, token: string): void {
    this.sql.exec("DELETE FROM basedbot_push_devices WHERE token=? AND sender_id=?", token, senderId);
  }

  devices(senderId: string): string[] {
    return this.sql.exec<{ token: string }>("SELECT token FROM basedbot_push_devices WHERE sender_id=? ORDER BY updated_at DESC LIMIT 10", senderId).toArray().map((row) => row.token);
  }

  forgetToken(token: string): void {
    this.sql.exec("DELETE FROM basedbot_push_devices WHERE token=?", token);
  }
}
