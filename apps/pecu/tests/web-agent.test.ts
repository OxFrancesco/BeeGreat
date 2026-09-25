import { jsonFieldsSchema, type JsonFields } from "../src/json-contract";
import { NansenService } from "../src/integrations/nansen";
import { test, expect } from "bun:test";
import { Database, type SQLQueryBindings } from "bun:sqlite";
import type { AgentHarness } from "../src/harness";
import { PecuAgent } from "../src/agent";
import { Store } from "../src/store";
import { pnlCacheMs, WebAgent, type WebSql } from "../src/web";
import { services } from "./fixtures/agent-services";
import { confirmationCommand, webTurnSchema } from "../src/web-contract";
const address = "0x1111111111111111111111111111111111111111";
const identity = { userId: "user_alice", senderId: "123" };

test("Nansen charts persist with direct and model replies, replay without a new read, and never leak into another turn", async () => {
  let reads = 0;
  const fetcher: typeof fetch = Object.assign(async () => {
    reads++;
    return Response.json({ data: [{ smart_trader_net_flow_usd: 100, whale_net_flow_usd: -50 }] });
  }, { preconnect: fetch.preconnect });
  const nansen = new NansenService("test", "https://nansen.test/api/v1", fetcher);
  const f = fixture(async (message, capabilities) => {
    if (message.text === "explain flows") {
      await capabilities.nansenCall("token_flow_intelligence", { token: address });
      return "Smart trader inflows and whale outflows differ.";
    }
    return "Hello";
  }, false, undefined, nansen);
  try {
    f.store.saveWallet(identity.senderId, address, address);
    const direct = { ...identity, requestId: crypto.randomUUID(), text: `/nansen flows ${address}` };
    await f.web.handle(direct);
    const first = f.web.state(identity).messages.at(-1)?.reply;
    expect(first?.analyticsOnly).toBe(true);
    expect(first?.analytics?.[0]?.snapshot.kind).toBe("flows");
    const saved = first?.analytics;
    await f.web.handle(direct);
    expect(reads).toBe(1);
    expect(new WebAgent(f.agent, f.store, f.sql).state(identity).messages.at(-1)?.reply?.analytics).toEqual(saved);
    await f.web.handle({ ...identity, requestId: crypto.randomUUID(), text: "hello" });
    expect(f.web.state(identity).messages.at(-1)?.reply?.analytics).toBeUndefined();
    await f.web.handle({ ...identity, requestId: crypto.randomUUID(), text: "explain flows" });
    const explained = f.web.state(identity).messages.at(-1)?.reply;
    expect(explained?.analyticsOnly).toBe(false);
    expect(explained?.analytics).toHaveLength(1);
    expect(explained?.text).toContain("differ");
  } finally { f.close(); }
});
test("wallet P&L reads the sender's own Base wallet once per period for ten minutes and never touches chat history", async () => {
  const bodies: JsonFields[] = [];
  let fail = false;
  let open!: () => void;
  const gate = new Promise<void>((resolve) => { open = resolve; });
  const fetcher: typeof fetch = Object.assign(async (_input: string | URL | Request, init?: RequestInit) => {
    bodies.push(jsonFieldsSchema.parse(JSON.parse(String(init?.body))));
    await gate;
    if (fail) return Response.json({ code: "rate_limit_exceeded", retry_after: 30 }, { status: 429 });
    return Response.json({ pagination: { page: 1, per_page: 1000, is_last_page: true }, data: [{ token_address: "0x2222", token_symbol: "AERO", pnl_usd_realised: 12, pnl_usd_unrealised: -2 }] });
  }, { preconnect: fetch.preconnect });
  const f = fixture(undefined, false, undefined, new NansenService("test", "https://nansen.test/api/v1", fetcher));
  try {
    expect(await f.web.pnl(identity, 30)).toEqual({ wallet: null, days: 30, snapshot: null });
    expect(bodies).toHaveLength(0);
    f.store.saveWallet(identity.senderId, address, address);
    const reads = [f.web.pnl(identity, 30), f.web.pnl(identity, 30)];
    open();
    const [first, second] = await Promise.all(reads);
    expect(bodies).toHaveLength(1);
    expect(bodies[0]).toMatchObject({ address, chain: "base", pagination: { per_page: 1000 } });
    expect(first.snapshot?.rows).toEqual([{ chain: "base", address: "0x2222", symbol: "AERO", realizedUsd: 12, unrealizedUsd: -2 }]);
    expect(second).toEqual(first);
    expect(await new WebAgent(f.agent, f.store, f.sql).pnl(identity, 30)).toEqual(first);
    expect(bodies).toHaveLength(1);
    await f.web.pnl(identity, 90);
    expect(bodies).toHaveLength(2);
    const stale = { ...first.snapshot!, observedAt: Date.now() - pnlCacheMs - 1 };
    f.sql.exec("UPDATE basedbot_web_pnl SET snapshot=? WHERE days=30", JSON.stringify(stale));
    fail = true;
    expect((await f.web.pnl(identity, 30)).snapshot).toEqual(stale);
    expect(bodies).toHaveLength(3);
    await expect(f.web.pnl(identity, 7)).rejects.toThrow("Nansen is busy. Try again in 30 seconds.");
    expect(f.web.state(identity).messages).toEqual([]);
  } finally { f.close(); }
});
function fixture(answer?: AgentHarness["respond"], provision = false, stockData?: import("../src/stock-contract").StockSnapshot["stocks"], nansen?: NansenService) {
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
        return { address };
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
    { ...services(stockData === undefined ? {} : { aero: { kind: "read", action: "stocks", parameters: {}, output: stockData } }), nansen },
    {
      respond: async (message, capabilities, mode, progress) => {
        calls++;
        return answer ? answer(message, capabilities, mode, progress) : `Hello ${message.senderId}`;
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
test("a web turn forwards finished paragraphs to the caller while the model writes, and deterministic commands never stream", async () => {
  const f = fixture(async (message, _capabilities, _mode, progress) => {
    progress?.("Checking your wallet.");
    progress?.("Done, here is the summary.");
    return `Checking your wallet.\nDone, here is the summary.`;
  });
  try {
    f.store.saveWallet(identity.senderId, address, address);
    const seen: string[] = [];
    const scope = { ...identity };
    expect(f.web.busy(scope)).toBe(false);
    const turn = f.web.handle({ ...identity, requestId: crypto.randomUUID(), text: "how is my wallet doing" }, (paragraph) => {
      seen.push(paragraph);
      expect(f.web.busy(scope)).toBe(true);
    });
    expect(f.web.busy(scope)).toBe(true);
    expect(await turn).toEqual({ status: "complete" });
    expect(seen).toEqual(["Checking your wallet.", "Done, here is the summary."]);
    expect(f.web.busy(scope)).toBe(false);
    expect(f.web.state(identity).messages.at(-1)?.reply?.text).toContain("summary");
    const direct: string[] = [];
    await f.web.handle({ ...identity, requestId: crypto.randomUUID(), text: "/help" }, (paragraph) => direct.push(paragraph));
    expect(direct).toEqual([]);
    expect(f.calls()).toBe(1);
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
      expect(message?.reply?.preview?.title ?? null).toBe(replyCode === "ABC123" ? "Stake position" : null);
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

test("a completed intent exposes its stored result on the preview", async () => {
  const f = fixture();
  try {
    f.store.saveWallet(identity.senderId, address, address);
    const conversationId = `stocks:${identity.userId}:${identity.senderId}`;
    const requestId = crypto.randomUUID();
    const eventId = `${conversationId}:${requestId}`;
    const code = "ABC123";
    const result = "Aerodrome stake confirmed on Base mainnet.\nhttps://basescan.org/tx/0xabc";
    f.store.createIntent({
      id: requestId,
      codeHash: new Bun.CryptoHasher("sha256").update(code).digest("hex"),
      senderId: identity.senderId, conversationId, sourceEventId: eventId,
      state: "pending", family: "aero", action: "stake",
      parameters: { chain: 8453, wallet: address, pool: address },
      preview: "Stored preview", planDigest: "test", expiresAt: Date.now() + 60_000,
    }, []);
    f.store.claimEvent(eventId, conversationId, identity.senderId);
    f.store.completeEvent(eventId, `Preview /confirm ${code}`);
    await f.web.handle({ ...identity, requestId, text: "preview" });
    let preview = f.web.state(identity).messages.find((m) => m.id === eventId)?.reply?.preview;
    expect(preview?.title).toBe("Stake position");
    expect(preview?.result).toBeUndefined();
    f.store.transitionIntent(requestId, "pending", "succeeded", result);
    preview = f.web.state(identity).messages.find((m) => m.id === eventId)?.reply?.preview;
    expect(preview?.state).toBe("succeeded");
    expect(preview?.title).toBe("Stake position");
    expect(preview?.result).toBe(result);
  } finally { f.close(); }
});

test("previews carry the decoded transaction plan and its live step progress", async () => {
  const f = fixture();
  try {
    f.store.saveWallet(identity.senderId, address, address);
    const conversationId = `stocks:${identity.userId}:${identity.senderId}`;
    const requestId = crypto.randomUUID();
    const eventId = `${conversationId}:${requestId}`;
    const usdc = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
    const permit2 = "0x000000000022D473030F116dDEE9F6B43aC78BA3";
    const approve = `0x095ea7b3${permit2.slice(2).toLowerCase().padStart(64, "0")}${(25_000_000).toString(16).padStart(64, "0")}` as const;
    f.store.createIntent({
      id: requestId,
      codeHash: new Bun.CryptoHasher("sha256").update("ABC123").digest("hex"),
      senderId: identity.senderId, conversationId, sourceEventId: eventId,
      state: "pending", family: "aero", action: "stake",
      parameters: { chain: 8453, wallet: address, pool: address },
      preview: "Stored preview", planDigest: "test", expiresAt: Date.now() + 60_000,
    }, [
      { role: "approval", from: address, to: usdc, data: approve, value: "0" },
      { role: "action", from: address, to: address, data: "0x12345678", value: "0" },
    ]);
    f.store.claimEvent(eventId, conversationId, identity.senderId);
    f.store.completeEvent(eventId, "Preview /confirm ABC123");
    await f.web.handle({ ...identity, requestId, text: "preview" });
    const preview = () => f.web.state(identity).messages.find((m) => m.id === eventId)?.reply?.preview;
    expect(preview()?.plan?.steps.map((step) => [step.title, step.status])).toEqual([
      ["Allow Permit2 to spend 25 USDC", undefined],
      ["Call 0x1111…1111", undefined],
    ]);
    const hash = `0x${"cd".repeat(32)}`;
    f.store.transitionIntent(requestId, "pending", "executing");
    f.store.markStepPrepared(requestId, 0, "tx-1");
    f.store.markStepSubmitted(requestId, 0, hash);
    f.store.markStepSucceeded(requestId, 0, hash);
    expect(preview()?.plan?.steps.map((step) => [step.status, step.hash])).toEqual([["confirmed", hash], ["waiting", undefined]]);
  } finally { f.close(); }
});

test("confirmationCommand parses only exact confirm and cancel commands", () => {
  expect(confirmationCommand("/confirm 39d685")).toEqual({ kind: "confirm", code: "39D685" });
  expect(confirmationCommand("/cancel 39d685")).toEqual({ kind: "cancel", code: "39D685" });
  expect(confirmationCommand("  /confirm ABC123  ")).toEqual({ kind: "confirm", code: "ABC123" });
  expect(confirmationCommand("/confirm")).toBeUndefined();
  expect(confirmationCommand("/confirm 12345")).toBeUndefined();
  expect(confirmationCommand("/confirm 1234567")).toBeUndefined();
  expect(confirmationCommand("/confirm ABCDEF extra")).toBeUndefined();
  expect(confirmationCommand("confirm ABC123")).toBeUndefined();
});

test("portfolio reads only the authenticated sender wallet, isolates failures and leaves chat untouched", async () => {
  const f = fixture();
  try {
    const reads: string[] = [];
    f.agent.portfolioBalance = async (wallet, reference) => {
      expect(wallet).toBe(address);
      reads.push(reference);
      if (reference === "bad") throw new Error("Unknown token bad");
      return { kind: "read", command: "balance", output: { token: reference.toUpperCase(), amount: "0.000000000000000001" } };
    };
    f.agent.portfolioStocks = async () => { throw new Error("upstream offline"); };
    expect((await f.web.portfolio(identity, { tokens: ["ETH"], stocks: true })).wallet).toBeNull();
    expect(reads).toEqual([]);
    f.store.saveWallet(identity.senderId, address, address);
    const result = await f.web.portfolio(identity, { tokens: ["ETH", "eth", "USDC", "bad"], stocks: true });
    expect(reads).toEqual(["eth", "usdc", "bad"]);
    expect(result.balances[0]?.amount).toBe("0.000000000000000001");
    expect(result.balances[2]?.error).toContain("Base contract address");
    expect(result.stocksError).toContain("unavailable");
    expect(f.web.state(identity).messages).toEqual([]);
    expect((await f.web.portfolio({ ...identity, senderId: "other" }, { tokens: ["ETH"], stocks: false })).wallet).toBeNull();
  } finally { f.close(); }
});
