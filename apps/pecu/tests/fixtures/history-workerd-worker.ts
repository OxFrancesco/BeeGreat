import { DurableObject } from "cloudflare:workers";
import { WebHistory, webOwner } from "../../src/web-history";
import { DurableStore } from "../../src/cloudflare/durable-store";
import { analyticsSnapshotSchema, analyticsText, type AnalyticsSnapshot } from "../../src/analytics-contract";
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
    const store = new DurableStore(this.ctx.storage);
    store.initialize();
    const snapshot: AnalyticsSnapshot = { kind: "flows", key: "test-flow", observedAt: 1, subject: "test-token", chain: "base", period: "1d", partial: false, rows: [{ label: "Whales", netUsd: -50, wallets: 2 }] };
    store.saveAnalytics("analytics-event", { snapshot, text: analyticsText(snapshot) });
    const token = {tokenId:"yes-2026",marketId:"2026",slug:"btc-2026",title:"BTC by Dec 31 2026",outcome:"Yes",endDate:"2027-01-01",url:"https://polymarket.com/event/btc"};
    store.savePolymarketTokens("analytics-event", [token]);
    store.savePolymarketTokens("other-event", [{...token,title:"Other event"}]);
    const reopened = new DurableStore(this.ctx.storage);
    return Response.json({
      initial: initial?.count,
      latest: latest.rows.length,
      older: older.rows.length,
      roundtrip: JSON.stringify(latest.rows) === JSON.stringify(back.rows),
      count,
      deleted: history.threads(scope).threads.length === 0,
      marketRestored: reopened.polymarketToken("analytics-event", "yes-2026")?.title === token.title,
      marketIsolated: reopened.polymarketToken("other-event", "yes-2026")?.title === "Other event" && reopened.polymarketToken("missing", "yes-2026") === undefined,
      analyticsRestored: JSON.stringify(reopened.analytics("analytics-event")[0]?.snapshot) === JSON.stringify(analyticsSnapshotSchema.parse(snapshot)),
      analyticsIsolated: reopened.analytics("different-event").length === 0,
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
