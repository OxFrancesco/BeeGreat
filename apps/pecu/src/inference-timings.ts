export type InferenceRequest = {
  id: string;
  session_id: string;
  provider: string;
  model: string;
  started_at: number;
  response_at: number | null;
  status: number | null;
};

export type TimingSql = {
  exec<R extends Record<string, SqlStorageValue>>(query: string, ...params: SqlStorageValue[]): { toArray(): R[] };
};

export class InferenceTimings {
  constructor(private readonly sql: TimingSql) {
    sql.exec(`CREATE TABLE IF NOT EXISTS pecu_inference_requests (
      id TEXT PRIMARY KEY, session_id TEXT NOT NULL, provider TEXT NOT NULL,
      model TEXT NOT NULL, started_at INTEGER NOT NULL, response_at INTEGER, status INTEGER
    )`);
    sql.exec("CREATE INDEX IF NOT EXISTS pecu_inference_requests_session ON pecu_inference_requests(session_id,started_at)");
  }

  begin(sessionId: string, provider: string, model: string, at = Date.now()): string {
    const id = crypto.randomUUID();
    this.sql.exec("INSERT INTO pecu_inference_requests VALUES(?,?,?,?,?,NULL,NULL)", id, sessionId, provider, model, at);
    return id;
  }

  response(id: string, status: number, at = Date.now()): void {
    this.sql.exec("UPDATE pecu_inference_requests SET response_at=?,status=? WHERE id=?", at, status, id);
  }

  read(sessionId: string, since: number): InferenceRequest[] {
    return this.sql.exec<InferenceRequest>("SELECT * FROM pecu_inference_requests WHERE session_id=? AND started_at>=? ORDER BY started_at,rowid", sessionId, since).toArray();
  }

  clear(sessionId: string, through: number): void {
    this.sql.exec("DELETE FROM pecu_inference_requests WHERE session_id=? AND started_at<=?", sessionId, through);
  }
}
