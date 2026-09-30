import { z } from "zod";
import type { WebSql } from "../web";
import type { ResearchPack } from "../integrations/chain-data";
import type { ChainProfile } from "./agents";
import { findingsSchema, reportSchema, researchRoles, researchStateSchema, researchWindowSchema, stageStateSchema, type Findings, type ResearchReport, type ResearchRole, type ResearchState, type ResearchWindow, type StageState } from "../research-contract";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export type ResearchRun = Readonly<{
  id: string;
  code: string;
  senderId: string;
  conversationId: string;
  /** The verified X event that asked for the run; replies anchor to it. Empty for web. */
  encodedEvent: string;
  /** Whether the finished report is posted back into the conversation. Runs started from the research page only notify. */
  deliver: boolean;
  chainId: string;
  chainName: string;
  window: ResearchWindow;
  state: ResearchState;
  periodStart: string | null;
  periodEnd: string | null;
  error: string | null;
  headline: string | null;
  attempt: number;
  createdAt: number;
  updatedAt: number;
  completedAt: number | null;
}>;

export type ResearchStage = Readonly<{
  runId: string;
  role: ResearchRole;
  state: StageState;
  attempt: number;
  startedAt: number | null;
  endedAt: number | null;
  calls: number;
  summary: string | null;
  error: string | null;
}>;

type RunRow = {
  id: string; code: string; sender_id: string; conversation_id: string; encoded_event: string; deliver: number; chain_id: string; chain_name: string;
  span: string; state: string; period_start: string | null; period_end: string | null; error: string | null; headline: string | null;
  attempt: number; created_at: number; updated_at: number; completed_at: number | null;
};
type StageRow = { run_id: string; role: string; state: string; attempt: number; started_at: number | null; ended_at: number | null; calls: number; summary: string | null; error: string | null };

function runFromRow(row: RunRow): ResearchRun {
  return {
    id: row.id, code: row.code, senderId: row.sender_id, conversationId: row.conversation_id, encodedEvent: row.encoded_event, deliver: row.deliver === 1,
    chainId: row.chain_id, chainName: row.chain_name, window: researchWindowSchema.parse(row.span), state: researchStateSchema.parse(row.state),
    periodStart: row.period_start, periodEnd: row.period_end, error: row.error, headline: row.headline, attempt: row.attempt,
    createdAt: row.created_at, updatedAt: row.updated_at, completedAt: row.completed_at,
  };
}

function stageFromRow(row: StageRow): ResearchStage {
  return {
    runId: row.run_id, role: z.enum(researchRoles).parse(row.role), state: stageStateSchema.parse(row.state), attempt: row.attempt,
    startedAt: row.started_at, endedAt: row.ended_at, calls: row.calls, summary: row.summary, error: row.error,
  };
}

const runColumns = "id,code,sender_id,conversation_id,encoded_event,deliver,chain_id,chain_name,span,state,period_start,period_end,error,headline,attempt,created_at,updated_at,completed_at";

/** A run's editor report, null when the editor did not submit one, and its rendered Markdown. */
export type StoredReport = Readonly<{ report: ResearchReport | null; markdown: string | null }>;

export class ResearchStore {
  constructor(private readonly sql: WebSql) {
    sql.exec(`CREATE TABLE IF NOT EXISTS basedbot_research_runs (
      id TEXT PRIMARY KEY, code TEXT NOT NULL, sender_id TEXT NOT NULL, conversation_id TEXT NOT NULL, encoded_event TEXT NOT NULL, deliver INTEGER NOT NULL,
      chain_id TEXT NOT NULL, chain_name TEXT NOT NULL, span TEXT NOT NULL, state TEXT NOT NULL, period_start TEXT, period_end TEXT,
      error TEXT, headline TEXT, attempt INTEGER NOT NULL DEFAULT 0, chain_json TEXT NOT NULL, pack_json TEXT, report_json TEXT, markdown TEXT,
      created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, completed_at INTEGER, deleted_at INTEGER, UNIQUE(sender_id, code))`);
    sql.exec("CREATE INDEX IF NOT EXISTS basedbot_research_runs_sender ON basedbot_research_runs(sender_id, created_at)");
    sql.exec("CREATE INDEX IF NOT EXISTS basedbot_research_runs_state ON basedbot_research_runs(state, updated_at)");
    sql.exec(`CREATE TABLE IF NOT EXISTS basedbot_research_stages (
      run_id TEXT NOT NULL, role TEXT NOT NULL, state TEXT NOT NULL, attempt INTEGER NOT NULL DEFAULT 0, started_at INTEGER, ended_at INTEGER,
      calls INTEGER NOT NULL DEFAULT 0, summary TEXT, error TEXT, findings_json TEXT, PRIMARY KEY(run_id, role))`);
  }

  create(input: Pick<ResearchRun, "senderId" | "conversationId" | "encodedEvent" | "deliver" | "window"> & { chain: ChainProfile }, now = Date.now()): ResearchRun {
    const id = crypto.randomUUID();
    for (let attempt = 0; attempt < 8; attempt++) {
      const code = Array.from(crypto.getRandomValues(new Uint8Array(6)), (byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length]).join("");
      if (this.sql.exec<{ id: string }>("SELECT id FROM basedbot_research_runs WHERE sender_id=? AND code=?", input.senderId, code).toArray().length) continue;
      this.sql.exec(`INSERT INTO basedbot_research_runs(id,code,sender_id,conversation_id,encoded_event,deliver,chain_id,chain_name,span,state,chain_json,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        id, code, input.senderId, input.conversationId, input.encodedEvent, input.deliver ? 1 : 0, input.chain.id, input.chain.name, input.window, "queued", JSON.stringify(input.chain), now, now);
      for (const role of researchRoles) this.sql.exec("INSERT INTO basedbot_research_stages(run_id,role,state) VALUES(?,?,?)", id, role, "pending");
      return this.byId(id)!;
    }
    throw new Error("Could not allocate a research code. Try again.");
  }

  byId(id: string): ResearchRun | undefined {
    const row = this.sql.exec<RunRow>(`SELECT ${runColumns} FROM basedbot_research_runs WHERE id=? AND deleted_at IS NULL`, id).toArray()[0];
    return row ? runFromRow(row) : undefined;
  }

  get(senderId: string, code: string): ResearchRun | undefined {
    const row = this.sql.exec<RunRow>(`SELECT ${runColumns} FROM basedbot_research_runs WHERE sender_id=? AND code=? AND deleted_at IS NULL`, senderId, code.toUpperCase()).toArray()[0];
    return row ? runFromRow(row) : undefined;
  }

  /** The newest run with this code across senders, for operator tools. */
  byCode(code: string): ResearchRun | undefined {
    const row = this.sql.exec<RunRow>(`SELECT ${runColumns} FROM basedbot_research_runs WHERE code=? AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 1`, code.toUpperCase()).toArray()[0];
    return row ? runFromRow(row) : undefined;
  }

  list(senderId: string, limit = 50): ResearchRun[] {
    return this.sql.exec<RunRow>(`SELECT ${runColumns} FROM basedbot_research_runs WHERE sender_id=? AND deleted_at IS NULL ORDER BY created_at DESC LIMIT ?`, senderId, limit).toArray().map(runFromRow);
  }

  /** Runs counted against the daily limit, deleted ones included since their credits were spent. Failed runs and runs cancelled before they started are free. */
  startedSince(senderId: string | null, since: number): number {
    const counted = "created_at>=? AND state<>'failed' AND NOT (state='cancelled' AND attempt=0)";
    const row = senderId === null
      ? this.sql.exec<{ count: number }>(`SELECT COUNT(*) AS count FROM basedbot_research_runs WHERE ${counted}`, since).toArray()[0]
      : this.sql.exec<{ count: number }>(`SELECT COUNT(*) AS count FROM basedbot_research_runs WHERE sender_id=? AND ${counted}`, senderId, since).toArray()[0];
    return row?.count ?? 0;
  }

  active(senderId?: string): ResearchRun[] {
    const rows = senderId === undefined
      ? this.sql.exec<RunRow>(`SELECT ${runColumns} FROM basedbot_research_runs WHERE state IN ('queued','collecting','researching','synthesizing') AND deleted_at IS NULL ORDER BY created_at`).toArray()
      : this.sql.exec<RunRow>(`SELECT ${runColumns} FROM basedbot_research_runs WHERE sender_id=? AND state IN ('queued','collecting','researching','synthesizing') AND deleted_at IS NULL ORDER BY created_at`, senderId).toArray();
    return rows.map(runFromRow);
  }

  update(id: string, patch: Partial<Pick<ResearchRun, "state" | "periodStart" | "periodEnd" | "error" | "headline" | "attempt" | "completedAt">>, now = Date.now()): ResearchRun {
    const current = this.byId(id);
    if (!current) throw new Error("Research not found.");
    const next = { ...current, ...patch };
    this.sql.exec("UPDATE basedbot_research_runs SET state=?,period_start=?,period_end=?,error=?,headline=?,attempt=?,completed_at=?,updated_at=? WHERE id=?",
      next.state, next.periodStart, next.periodEnd, next.error, next.headline, next.attempt, next.completedAt, now, id);
    return this.byId(id)!;
  }

  /** Only moves from an active state, so a cancel is never overwritten by a finishing stage. */
  transition(id: string, from: readonly ResearchState[], patch: Parameters<ResearchStore["update"]>[1], now = Date.now()): ResearchRun | undefined {
    const current = this.byId(id);
    if (!current || !from.includes(current.state)) return undefined;
    return this.update(id, patch, now);
  }

  delete(id: string, now = Date.now()): void {
    this.sql.exec("UPDATE basedbot_research_runs SET deleted_at=?,pack_json=NULL,report_json=NULL,markdown=NULL,updated_at=? WHERE id=?", now, now, id);
    this.sql.exec("UPDATE basedbot_research_stages SET findings_json=NULL WHERE run_id=?", id);
  }

  chain(id: string): ChainProfile {
    const row = this.sql.exec<{ chain_json: string }>("SELECT chain_json FROM basedbot_research_runs WHERE id=?", id).toArray()[0];
    if (!row) throw new Error("Research not found.");
    // SAFETY: the column holds only JSON this store wrote from a resolved ChainProfile.
    return JSON.parse(row.chain_json) as ChainProfile;
  }

  savePack(id: string, pack: ResearchPack): void {
    this.sql.exec("UPDATE basedbot_research_runs SET pack_json=? WHERE id=?", JSON.stringify(pack), id);
  }

  pack(id: string): ResearchPack | undefined {
    const row = this.sql.exec<{ pack_json: string | null }>("SELECT pack_json FROM basedbot_research_runs WHERE id=?", id).toArray()[0];
    // SAFETY: the column holds only JSON this store wrote from a ResearchPack built by ChainDataService.
    return row?.pack_json ? JSON.parse(row.pack_json) as ResearchPack : undefined;
  }

  saveReport(id: string, report: ResearchReport | null, markdown: string): void {
    this.sql.exec("UPDATE basedbot_research_runs SET report_json=?,markdown=? WHERE id=?", report ? JSON.stringify(report) : null, markdown, id);
  }

  report(id: string): StoredReport {
    const row = this.sql.exec<{ report_json: string | null; markdown: string | null }>("SELECT report_json,markdown FROM basedbot_research_runs WHERE id=?", id).toArray()[0];
    const parsed = row?.report_json ? reportSchema.safeParse(JSON.parse(row.report_json)) : undefined;
    return { report: parsed?.success ? parsed.data : null, markdown: row?.markdown ?? null };
  }

  stages(id: string): ResearchStage[] {
    const order = new Map(researchRoles.map((role, index) => [role, index]));
    return this.sql.exec<StageRow>("SELECT run_id,role,state,attempt,started_at,ended_at,calls,summary,error FROM basedbot_research_stages WHERE run_id=?", id).toArray().map(stageFromRow).sort((a, b) => order.get(a.role)! - order.get(b.role)!);
  }

  startStage(id: string, role: ResearchRole, now = Date.now()): void {
    this.sql.exec("UPDATE basedbot_research_stages SET state='running',attempt=attempt+1,started_at=?,ended_at=NULL,error=NULL WHERE run_id=? AND role=?", now, id, role);
  }

  finishStage(id: string, role: ResearchRole, result: Readonly<{ state: Exclude<StageState, "pending" | "running">; calls: number; summary: string | null; error?: string; findings?: Findings }>, now = Date.now()): void {
    this.sql.exec("UPDATE basedbot_research_stages SET state=?,ended_at=?,calls=calls+?,summary=?,error=?,findings_json=? WHERE run_id=? AND role=?",
      result.state, now, result.calls, result.summary?.slice(0, 2000) ?? null, result.error?.slice(0, 500) ?? null, result.findings ? JSON.stringify(result.findings) : null, id, role);
  }

  /** Stages an evicted object left running go back to pending for another attempt. */
  resetStage(id: string, role: ResearchRole): void {
    this.sql.exec("UPDATE basedbot_research_stages SET state='pending',started_at=NULL WHERE run_id=? AND role=? AND state='running'", id, role);
  }

  findings(id: string): Partial<Record<ResearchRole, Findings>> {
    const rows = this.sql.exec<{ role: string; findings_json: string | null }>("SELECT role,findings_json FROM basedbot_research_stages WHERE run_id=? AND findings_json IS NOT NULL", id).toArray();
    return Object.fromEntries(rows.flatMap((row) => {
      const parsed = findingsSchema.safeParse(JSON.parse(row.findings_json!));
      return parsed.success ? [[row.role, parsed.data]] : [];
    }));
  }
}
