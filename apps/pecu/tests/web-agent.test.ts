import { test, expect } from "bun:test";
import { Database, type SQLQueryBindings } from "bun:sqlite";
import { PecuAgent } from "../src/agent";
import { Store } from "../src/store";
import { WebAgent, type WebSql } from "../src/web";
import { services } from "./fixtures/agent-services";
import { webTurnSchema } from "../src/web-contract";
const address = "0x1111111111111111111111111111111111111111";
const identity = { userId: "user_alice", senderId: "123" };
function fixture() {
  const db = new Database(":memory:");
  const store = new Store(":memory:");
  let calls = 0;
  const sql: WebSql = {
    exec: <Row extends Record<string, SqlStorageValue>>(
      query: string,
      ...params: SqlStorageValue[]
    ) => {
      const rows = db
        .query<Row, SQLQueryBindings[]>(query)
        .all(
          ...params.map((p) =>
            p instanceof ArrayBuffer ? new Uint8Array(p) : p,
          ),
        );
      return { toArray: () => rows };
    },
  };
  const agent = new PecuAgent(
    {
      enableMainnetExecution: false,
      maxSlippageBps: 100,
      quoteTtlSeconds: 120,
    },
    store,
    {
      getOrCreate: async () => {
        throw new Error("Must reuse existing wallet");
      },
      balances: async () => "",
      prepare: async () => {
        throw new Error("No signing");
      },
      approve: async () => {
        throw new Error("No signing");
      },
      transaction: async () => {
        throw new Error("No signing");
      },
    },
    services({}),
    {
      respond: async (message) => {
        calls++;
        return `Hello ${message.senderId}`;
      },
    },
  );
  const web = new WebAgent(agent, store, sql);
  return {
    web,
    store,
    db,
    sql,
    agent,
    calls: () => calls,
    close: () => {
      db.close();
      store.close();
    },
  };
}
test("web reuses an existing X wallet and persists deduplicated history across adapter restarts", async () => {
  const f = fixture();
  try {
    f.store.saveWallet("123", address, address);
    const turn = { ...identity, requestId: crypto.randomUUID(), text: "hello" };
    await f.web.handle(turn);
    await f.web.handle(turn);
    expect(f.calls()).toBe(1);
    const restarted = new WebAgent(f.agent, f.store, f.sql);
    expect(restarted.state(identity).wallet).toBe(address);
    expect(restarted.state(identity).messages[0].reply?.text).toBe("Hello 123");
    expect(
      restarted.state({ ...identity, userId: "user_bob" }).messages,
    ).toEqual([]);
    expect(restarted.state({ ...identity, senderId: "456" }).messages).toEqual(
      [],
    );
    await expect(f.web.handle({ ...turn, text: "different" })).rejects.toThrow(
      "another message",
    );
  } finally {
    f.close();
  }
});
test("web never creates a wallet or invokes the agent for an unlinked X account", async () => {
  const f = fixture();
  try {
    await expect(
      f.web.handle({
        ...identity,
        requestId: crypto.randomUUID(),
        text: "/wallet",
      }),
    ).rejects.toThrow("No Pecu wallet");
    expect(f.calls()).toBe(0);
  } finally {
    f.close();
  }
});
test("web settings and baskets are scoped to the authenticated web conversation", async () => {
  const f = fixture();
  try {
    f.store.saveWallet("123", address, address);
    f.store.setYolo("123", "x-chat", true);
    expect(f.web.state(identity).yolo).toBe(false);
    f.web.saveBasket(identity, {
      name: "Tech",
      allocations: "NVDAc=50,AAPLc=50",
    });
    expect(f.web.state(identity).basket?.name).toBe("Tech");
    expect(f.web.state({ ...identity, userId: "user_bob" }).basket).toBeNull();
  } finally {
    f.close();
  }
});
test("web request validation rejects wallet overrides and malformed identity", () => {
  expect(
    webTurnSchema.safeParse({
      ...identity,
      requestId: crypto.randomUUID(),
      text: "hello",
      wallet: address,
    }).success,
  ).toBe(false);
  expect(
    webTurnSchema.safeParse({
      ...identity,
      senderId: "@alice",
      requestId: crypto.randomUUID(),
      text: "hello",
    }).success,
  ).toBe(false);
});

test("saved baskets reject unknown stocks and incomplete allocations", () => {
  const f = fixture();
  try {
    expect(() =>
      f.web.saveBasket(identity, { name: "Bad", allocations: "NOPE=100" }),
    ).toThrow();
    expect(() =>
      f.web.saveBasket(identity, { name: "Bad", allocations: "NVDAc=10" }),
    ).toThrow();
    expect(f.web.state(identity).basket).toBeNull();
  } finally {
    f.close();
  }
});

test("confirmation controls require the code belonging to the persisted preview", async () => {
  const f = fixture();
  try {
    f.store.saveWallet(identity.senderId, address, address);
    const conversationId = `stocks:${identity.userId}:${identity.senderId}`;
    for (const replyCode of ["ABC123", "ABC124"]) {
      const requestId = crypto.randomUUID();
      const eventId = `${conversationId}:${requestId}`;
      f.store.createIntent({
        id: requestId,
        codeHash: new Bun.CryptoHasher("sha256").update(replyCode === "ABC123" ? "ABC123" : "ABC125").digest("hex"),
        senderId: identity.senderId, conversationId, sourceEventId: eventId,
        state: "pending", family: "aero", action: "stake",
        parameters: { chain: 8453, wallet: address, pool: address },
        preview: "Stored preview", planDigest: "test", expiresAt: Date.now() + 60_000,
      }, []);
      f.store.claimEvent(eventId, conversationId, identity.senderId);
      f.store.completeEvent(eventId, `Preview /confirm ${replyCode}`);
      await f.web.handle({ ...identity, requestId, text: "preview" });
      const message = f.web.state(identity).messages.find((m) => m.id === eventId);
      expect(message?.reply?.preview?.code ?? null).toBe(replyCode === "ABC123" ? "ABC123" : null);
    }
  } finally {
    f.close();
  }
});
