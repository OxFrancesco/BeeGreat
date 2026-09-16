import { DurableObject } from "cloudflare:workers";
import { WebHistory, webOwner } from "../../src/web-history";
export class HistoryProbe extends DurableObject {
  override async fetch() {
    const sql = this.ctx.storage.sql;
    sql.exec("DROP TABLE IF EXISTS basedbot_web_threads");
    sql.exec("DROP TABLE IF EXISTS basedbot_web_thread_indexes");
    sql.exec("DROP TABLE IF EXISTS basedbot_web_turns");
    sql.exec(
      "CREATE TABLE basedbot_web_turns (id TEXT PRIMARY KEY,owner TEXT NOT NULL,text TEXT NOT NULL,created_at INTEGER NOT NULL,reply TEXT)",
    );
    sql.exec(
      "CREATE INDEX basedbot_web_turns_owner ON basedbot_web_turns(owner,created_at)",
    );
    const scope = { userId: "user_test", senderId: "123" };
    for (let i = 0; i < 105; i++)
      sql.exec(
        "INSERT INTO basedbot_web_turns VALUES(?,?,?,?,NULL)",
        `turn-${i}`,
        webOwner(scope),
        `Message ${i}`,
        Math.floor(i / 50),
      );
    const history = new WebHistory(sql);
    const initial = history.threadFor(scope);
    const latest = history.messages(scope);
    const older = history.messages(scope, { before: latest.olderCursor! });
    const back = history.messages(scope, { after: older.newerCursor! });
    sql.exec(
      "INSERT INTO basedbot_web_turns VALUES('new',?,'new',3,NULL)",
      webOwner(scope),
    );
    const count = new WebHistory(sql).threadFor(scope)?.count;
    sql.exec("DELETE FROM basedbot_web_turns WHERE owner=?", webOwner(scope));
    return Response.json({
      initial: initial?.count,
      latest: latest.rows.length,
      older: older.rows.length,
      roundtrip: JSON.stringify(latest.rows) === JSON.stringify(back.rows),
      count,
      deleted: history.threads(scope).threads.length === 0,
    });
  }
}
export default {
  fetch(
    request: Request,
    env: { HISTORY: DurableObjectNamespace<HistoryProbe> },
  ) {
    return env.HISTORY.get(env.HISTORY.idFromName("probe")).fetch(request);
  },
};
