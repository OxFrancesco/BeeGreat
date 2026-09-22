import type { WebSql } from "./web";
import { CARD_RECIPIENT_LIMIT, cardViewerSchema, type CardCollection, type CardViewer } from "./cards-contract";

export class PecuCards {
  constructor(private readonly sql: WebSql) {
    sql.exec(`CREATE TABLE IF NOT EXISTS pecu_card_recipients (
      edition INTEGER PRIMARY KEY CHECK(edition BETWEEN 1 AND 3000),
      user_id TEXT NOT NULL UNIQUE, x_id TEXT NOT NULL UNIQUE,
      first_card INTEGER NOT NULL CHECK(first_card BETWEEN 1 AND 30),
      granted_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS pecu_card_inventory (
      user_id TEXT NOT NULL REFERENCES pecu_card_recipients(user_id),
      card_id INTEGER NOT NULL CHECK(card_id BETWEEN 1 AND 30),
      copies INTEGER NOT NULL CHECK(copies BETWEEN 1 AND 10),
      PRIMARY KEY(user_id, card_id)
    );
    CREATE TRIGGER IF NOT EXISTS pecu_card_first_grant AFTER INSERT ON pecu_card_recipients
    BEGIN
      INSERT INTO pecu_card_inventory(user_id,card_id,copies) VALUES(NEW.user_id,NEW.first_card,1);
    END;`);
  }

  collection(input: CardViewer): CardCollection {
    const viewer = cardViewerSchema.parse(input);
    const count = this.sql.exec<{ count: number }>("SELECT COUNT(*) AS count FROM pecu_card_recipients").toArray()[0]!.count;
    const own = this.sql.exec<{ edition: number }>("SELECT edition FROM pecu_card_recipients WHERE user_id=?", viewer.userId).toArray()[0];
    const remaining = CARD_RECIPIENT_LIMIT - count;
    if (own) return {
      status: "owned", created: false, remaining, edition: own.edition,
      cards: this.sql.exec<{ id: number; copies: number }>("SELECT card_id AS id,copies FROM pecu_card_inventory WHERE user_id=? ORDER BY card_id", viewer.userId).toArray(),
    };
    const used = viewer.xId && this.sql.exec("SELECT edition FROM pecu_card_recipients WHERE x_id=?", viewer.xId).toArray().length > 0;
    return { status: !viewer.xId ? "connect_x" : used ? "x_already_claimed" : remaining === 0 ? "sold_out" : "eligible", created: false, remaining, edition: null, cards: [] };
  }

  claim(input: CardViewer): CardCollection {
    const viewer = cardViewerSchema.parse(input);
    const current = this.collection(viewer);
    if (current.status !== "eligible") return current;
    // Rejection sampling gives every design equal probability. A retry never rerolls an existing grant.
    const random = new Uint32Array(1);
    do { crypto.getRandomValues(random); } while (random[0]! >= 4294967280);
    const card = random[0]! % 30 + 1;
    // The insert, cap check, uniqueness checks, and inventory trigger form one atomic SQL statement.
    const inserted = this.sql.exec<{ edition: number }>(`INSERT INTO pecu_card_recipients(edition,user_id,x_id,first_card,granted_at)
      SELECT COALESCE(MAX(edition),0)+1,?,?,?,? FROM pecu_card_recipients
      HAVING COUNT(*) < 3000 AND COALESCE(MAX(edition),0) < 3000
      ON CONFLICT DO NOTHING RETURNING edition`, viewer.userId, viewer.xId, card, Date.now()).toArray();
    return { ...this.collection(viewer), created: inserted.length === 1 };
  }
}
