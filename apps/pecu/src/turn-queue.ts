import { z } from "zod";
import { webTurnSchema } from "./web-contract";
import type { WebSql } from "./web";

export const turnStateSchema = z.enum(["running", "retrying", "complete", "failed"]);
export type TurnState = z.infer<typeof turnStateSchema>;

export class TurnQueue {
  constructor(private readonly sql: WebSql) {
    sql.exec(`CREATE TABLE IF NOT EXISTS pecu_turn_queue (id TEXT PRIMARY KEY, request TEXT NOT NULL, state TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, retry_at INTEGER NOT NULL DEFAULT 0)`);
  }

  start(id: string, request: z.infer<typeof webTurnSchema>): void {
    this.sql.exec("INSERT OR IGNORE INTO pecu_turn_queue(id,request,state) VALUES(?,?,'running')", id, JSON.stringify(request));
    this.sql.exec("UPDATE pecu_turn_queue SET state='running',attempts=attempts+1 WHERE id=?", id);
  }

  state(id: string): TurnState | undefined {
    const row = this.sql.exec<{ state: string }>("SELECT state FROM pecu_turn_queue WHERE id=?", id).toArray()[0];
    return row ? turnStateSchema.parse(row.state) : undefined;
  }

  hasPending(owner: string, except = ""): boolean {
    return this.sql.exec("SELECT q.id FROM pecu_turn_queue q JOIN basedbot_web_turns t ON t.id=q.id WHERE t.owner=? AND q.id<>? AND q.state IN ('running','retrying') LIMIT 1", owner, except).toArray().length > 0;
  }

  complete(id: string): void {
    this.sql.exec("UPDATE pecu_turn_queue SET state='complete' WHERE id=?", id);
  }

  fail(id: string): void {
    this.sql.exec("UPDATE pecu_turn_queue SET state='failed' WHERE id=?", id);
  }

  retry(id: string): void {
    this.sql.exec("UPDATE pecu_turn_queue SET state=CASE WHEN attempts>=10 THEN 'failed' ELSE 'retrying' END,retry_at=? WHERE id=?", Date.now() + 30_000, id);
  }

  pending() {
    return this.sql.exec<{ id: string; request: string }>("SELECT id,request FROM pecu_turn_queue WHERE state='running' OR (state='retrying' AND retry_at<=?) ORDER BY rowid LIMIT 20", Date.now()).toArray()
      .map(row => ({ id: row.id, request: webTurnSchema.parse(JSON.parse(row.request)) }));
  }

  deleteConversation(owner: string): void {
    this.sql.exec("DELETE FROM pecu_turn_queue WHERE id IN (SELECT id FROM basedbot_web_turns WHERE owner=?)", owner);
  }
}
