import { test, expect } from "bun:test";
import { Database, type SQLQueryBindings } from "bun:sqlite";
import type { AgentHarness } from "../src/harness";
import { PecuAgent } from "../src/agent";
import { Store } from "../src/store";
import { WebAgent, type WebSql } from "../src/web";
import { services } from "./fixtures/agent-services";
import { webTurnSchema } from "../src/web-contract";
const address = "0x1111111111111111111111111111111111111111";
const identity = { userId: "user_alice", senderId: "123" };
function fixture(answer?: AgentHarness["respond"], provision = false, stockData?: import("../src/stock-contract").StockSnapshot["stocks"]) {
  const db = new Database(":memory:");
  const store = new Store(":memory:");
  let calls = 0;
  let created = 0;
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
      depositRelayMaxUsd: 500,
      depositRelayDailyMaxUsd: 2000,
    },
    store,
    {
      getOrCreate: async (senderId: string) => {
        if (!provision) throw new Error("Must reuse existing wallet");
        created++;
        store.saveWallet(senderId, address, address);
        return { address } as never;
      },
      balances: async () => "",
      usdcBalanceUnits: async () => 0n,
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
    services(stockData === undefined ? {} : { aero: { kind: "read", action: "stocks", parameters: {}, output: stockData } }),
    {
      respond: async (message, capabilities) => {
        calls++;
        return answer ? answer(message, capabilities) : `Hello ${message.senderId}`;
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
    created: () => created,
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
test("a web-only sender (Google sign-in) gets its own wallet on the first message", async () => {
  const f = fixture(undefined, true);
  const google = { userId: "user_carol", senderId: "web-user_carol" };
  try {
    expect(f.web.state(google)).toMatchObject({ wallet: null, senderKind: "web" });
    await f.web.handle({ ...google, requestId: crypto.randomUUID(), text: "hello" });
    expect(f.created()).toBe(1);
    expect(f.calls()).toBe(1);
    expect(f.web.state(google).wallet).toBe(address);
    expect(f.store.wallet("web-user_carol")?.address).toBe(address);
    expect(f.web.state(identity).senderKind).toBe("x");
    expect(f.web.state({ userId: "user_carol", senderId: "123" }).messages).toEqual([]);
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
  expect(
    webTurnSchema.safeParse({
      ...identity,
      senderId: "web-user_alice",
      requestId: crypto.randomUUID(),
      text: "hello",
    }).success,
  ).toBe(true);
  expect(
    webTurnSchema.safeParse({
      ...identity,
      senderId: "web-treasury",
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
      expect(message?.canRetry).toBe(false);
      await expect(f.web.handle({ ...identity, requestId: crypto.randomUUID(), retryOf: eventId, text: "preview" })).rejects.toThrow("transaction");
    }
  } finally {
    f.close();
  }
});

test("web threads keep their own history, YOLO and titles, and the default thread keeps the original owner", async () => {
  const f = fixture();
  try {
    f.store.saveWallet("123", address, address);
    await f.web.handle({ ...identity, requestId: crypto.randomUUID(), text: "hello default" });
    await f.web.handle({ ...identity, threadId: "swap-plan", requestId: crypto.randomUUID(), text: "quote 0.01 ETH to USDC" });
    await f.web.handle({ ...identity, threadId: "swap-plan", requestId: crypto.randomUUID(), text: "again" });
    f.store.setYolo("123", `stocks:${identity.userId}:${identity.senderId}#swap-plan`, true);
    const base = f.web.state(identity);
    expect(base.threadId).toBeNull();
    expect(base.yolo).toBe(false);
    expect(base.messages.map((m) => m.text)).toEqual(["hello default"]);
    expect(
      base.threads?.map((t) => [t.id, t.title, t.count]).sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
    ).toEqual([
      [null, "hello default", 1],
      ["swap-plan", "quote 0.01 ETH to USDC", 2],
    ]);
    const thread = f.web.state({ ...identity, threadId: "swap-plan" });
    expect(thread.threadId).toBe("swap-plan");
    expect(thread.yolo).toBe(true);
    expect(thread.messages.map((m) => m.text)).toEqual(["quote 0.01 ETH to USDC", "again"]);
    expect(f.web.state({ ...identity, userId: "user_bob" }).threads).toEqual([]);
    f.web.deleteThread(identity, "swap-plan");
    expect(f.web.state(identity).threads?.map((t) => t.id)).toEqual([null]);
    expect(f.web.state({ ...identity, threadId: "swap-plan" }).messages).toEqual([]);
    expect(webTurnSchema.safeParse({ ...identity, threadId: "Bad Thread", requestId: crypto.randomUUID(), text: "x" }).success).toBe(false);
  } finally {
    f.close();
  }
});

test("thread deletion preserves recovery for submitted transactions", async () => {
  const f = fixture();
  try {
    f.store.saveWallet(identity.senderId, address, address);
    const threadId = "recover";
    const conversationId = `stocks:${identity.userId}:${identity.senderId}#${threadId}`;
    const requestId = crypto.randomUUID();
    await f.web.handle({ ...identity, threadId, requestId, text: "hello" });
    f.store.createIntent({
      id: requestId, codeHash: "test", senderId: identity.senderId,
      conversationId, sourceEventId: `${conversationId}:${requestId}`,
      state: "executing", family: "aero", action: "stake",
      parameters: { chain: 8453, wallet: address, pool: address },
      preview: "Submitted", planDigest: "test", expiresAt: Date.now() + 60_000,
    }, []);
    expect(() => f.web.deleteThread(identity, threadId)).toThrow("submitted transaction");
    expect(f.web.state({ ...identity, threadId }).messages).toHaveLength(1);
    await f.web.handle({ ...identity, threadId: "other", requestId: crypto.randomUUID(), text: "hello" });
    f.web.deleteThread(identity, "other");
    expect(f.web.state({ ...identity, threadId: "other" }).messages).toHaveLength(0);
  } finally {
    f.close();
  }
});

test("retry replaces the latest answer and deduplicates transport retries", async () => {
  const f = fixture();
  try {
    f.store.saveWallet("123", address, address);
    await f.web.handle({ ...identity, requestId: crypto.randomUUID(), text: "hello" });
    const original = f.web.state(identity).messages[0]!;
    const retry = { ...identity, requestId: crypto.randomUUID(), text: original.text, retryOf: original.id };
    await f.web.handle(retry);
    await f.web.handle(retry);
    expect(f.calls()).toBe(2);
    const messages = f.web.state(identity).messages;
    expect(messages).toHaveLength(1);
    expect(messages[0]!.id).not.toBe(original.id);
    expect(messages[0]!.createdAt).toBe(original.createdAt);
    await expect(f.web.handle({ ...retry, requestId: crypto.randomUUID() })).rejects.toThrow("latest");
  } finally { f.close(); }
});

test("retry rejects another owner, older turns, changed text, and confirmation commands", async () => {
  const f = fixture();
  try {
    f.store.saveWallet("123", address, address);
    await f.web.handle({ ...identity, requestId: crypto.randomUUID(), text: "hello" });
    const original = f.web.state(identity).messages[0]!;
    const retry = { ...identity, requestId: crypto.randomUUID(), text: original.text, retryOf: original.id };
    await expect(f.web.handle({ ...retry, userId: "user_bob" })).rejects.toThrow("latest");
    await expect(f.web.handle({ ...retry, text: "changed" })).rejects.toThrow("latest");
    await f.web.handle({ ...identity, requestId: crypto.randomUUID(), text: "/confirm ABCDEF" });
    await expect(f.web.handle(retry)).rejects.toThrow("latest");
    const last = f.web.state(identity).messages.at(-1)!;
    await expect(f.web.handle({ ...retry, retryOf: last.id, text: last.text })).rejects.toThrow("transaction");
  } finally { f.close(); }
});


test("question choices persist and accept one owned, current option", async () => {
  const f = fixture(async (_message, tools) => tools.askUser("How should we fund it?", ["ETH", "AERO", "Cancel"]));
  try {
    f.store.saveWallet("123", address, address);
    await f.web.handle({ ...identity, requestId: crypto.randomUUID(), text: "choose funding" });
    const restarted = new WebAgent(f.agent, f.store, f.sql);
    const question = restarted.state(identity).messages.at(-1)!;
    expect(question.reply?.question).toEqual({ question: "How should we fund it?", options: ["ETH", "AERO", "Cancel"] });
    const choice = { ...identity, requestId: crypto.randomUUID(), answerTo: question.id, text: "Cancel" };
    await expect(restarted.handle({ ...choice, userId: "user_bob" })).rejects.toThrow("latest question");
    await expect(restarted.handle({ ...choice, text: "Invented token" })).rejects.toThrow("latest question");
    await restarted.handle(choice);
    await restarted.handle(choice);
    expect(restarted.state(identity).messages).toHaveLength(2);
    expect(restarted.state(identity).messages.at(-1)?.reply?.text).toBe("Cancelled. No new transaction was sent.");
    await expect(restarted.handle({ ...choice, requestId: crypto.randomUUID() })).rejects.toThrow("latest question");
    expect(f.calls()).toBe(1);
  } finally { f.close(); }
});


test("stock snapshots follow command and model tool replies, persist on replay, and never leak to other turns", async () => {
  const stocks = [{ symbol: "NVDAc", name: "NVIDIA", address, balance: "2", price_usdc: "150", error: null }];
  const f = fixture(async (_message, capabilities) => capabilities.aeroRead("stocks", {}), true, stocks);
  try {
    f.store.saveWallet("123", address, address);
    for (const text of ["/stocks", "How many stocks do I own?", "Please inspect the stocks I hold today"]) {
      const turn = { ...identity, requestId: crypto.randomUUID(), text };
      await f.web.handle(turn);
      const before = f.web.state(identity).messages.at(-1)!.reply!.holdings;
      expect(before?.stocks).toEqual(stocks);
      await f.web.handle(turn);
      expect(f.web.state(identity).messages.at(-1)!.reply!.holdings).toEqual(before);
      expect(JSON.parse(f.web.state(identity).stocks!)).toEqual(stocks);
    }
    await f.web.handle({ ...identity, requestId: crypto.randomUUID(), text: "/help" });
    expect(f.web.state(identity).messages.at(-1)!.reply!.holdings).toBeUndefined();
    expect(f.web.state({ ...identity, senderId: "456" }).stocks).toBeNull();
    const restarted = new WebAgent(f.agent, f.store, f.sql);
    expect(restarted.state(identity).messages[0]!.reply!.holdings?.stocks).toEqual(stocks);
  } finally { f.close(); }
});

test("missing ChatGPT connection replies carry a typed recovery action", async () => {
  const { chatGptConnectionRequired } = await import("../src/inference-recovery");
  const f = fixture(async () => chatGptConnectionRequired);
  try {
    f.store.saveWallet("123", address, address);
    await f.web.handle({ ...identity, requestId: crypto.randomUUID(), text: "hello" });
    expect(f.web.state(identity).messages.at(-1)?.reply?.recovery).toBe("connect_chatgpt");
  } finally { f.close(); }
});
