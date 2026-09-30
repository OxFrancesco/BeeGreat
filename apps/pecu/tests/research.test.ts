import { Database, type SQLQueryBindings } from "bun:sqlite";
import { afterEach, expect, test } from "bun:test";
import { ChainDataService } from "../src/integrations/chain-data";
import type { JsonValue } from "../src/json-contract";
import { researchInstructions, curatedChain, curatedChains, resolveChainProfile } from "../src/research/agents";
import { ResearchControl, type ResearchOrigin } from "../src/research/control";
import { completionText, renderSourceMarkdown } from "../src/research/report";
import { ResearchRunner, type ResearchInference, type ResearchTurn } from "../src/research/runner";
import { ResearchStore } from "../src/research/store";
import type { Findings, ResearchReport, ResearchRole } from "../src/research-contract";
import { messageOriginSchema } from "../src/task-contract";
import type { WebSql } from "../src/web";
import { base, chainFetch, now } from "./fixtures/chain-data";

const open: Database[] = [];
afterEach(() => { for (const db of open.splice(0)) db.close(); });

const findings = (role: string): Findings => ({
  summary: `${role} summary with numbers.`,
  findings: [{ title: `${role}: Morpho Blue +$250M`, detail: "Deposits into new vaults after a campaign.", date: "2026-09-22", magnitude: "+$250M over 7d", actors: ["@morpho"], evidence: [{ kind: "protocol", label: "Morpho Blue Base TVL +$250M", url: "https://api.llama.fi/lite/protocols2?b=2" }], confidence: "medium" }],
  gaps: [],
});
const report: ResearchReport = {
  headline: "Morpho vault deposits carried Base TVL",
  summary: "Morpho Blue added $250M on Base after a vault campaign. Fees spiked on 24 Sep.",
  causes: [{ movement: "Morpho Blue TVL +$250M over 7d", mechanism: "A vault campaign pulled deposits. ETH rose 3.8%, so price explains a small part.", drivers: ["Campaign announced 22 Sep", "Deposits 22 to 24 Sep"], catalyst: "2026-09-22 vault campaign", explains: "$250M; price about $15M", evidence: [{ kind: "post", label: "@morpho campaign post", url: "https://x.com/morpho/status/1" }], confidence: "high" }],
  timeline: [{ date: "2026-09-22", title: "Morpho vault campaign", url: "https://x.com/morpho/status/1" }],
  actors: [{ name: "Morpho", role: "Ran the campaign that drew deposits." }],
  unexplained: ["The 24 Sep fee spike has no matching post."],
  watch: ["Campaign ends 2026-10-06."],
};

type Options = Readonly<{ run?: (turn: ResearchTurn) => Promise<{ text: string; submission: JsonValue | null; calls: number }>; chain?: typeof base }>;

function fixture(options: Options = {}) {
  const db = new Database(":memory:");
  open.push(db);
  const sql: WebSql = {
    exec: <Row extends Record<string, SqlStorageValue>>(query: string, ...params: SqlStorageValue[]) => {
      const rows = db.query<Row, SQLQueryBindings[]>(query).all(...params.map((p) => (p instanceof ArrayBuffer ? new Uint8Array(p) : p)));
      return { toArray: () => rows };
    },
  };
  let clock = now;
  const store = new ResearchStore(sql);
  const data = new ChainDataService(chainFetch().request, () => clock);
  const turns: ResearchTurn[] = [];
  const forgotten: string[] = [];
  const replies: { key: string; conversationId: string; text: string }[] = [];
  const web: { conversationId: string; origin: unknown; text: string }[] = [];
  const notes: { title: string; kind: string }[] = [];
  const inference: ResearchInference = {
    collect: async (_key, chain, window) => data.pack(chain, window),
    run: async (turn) => {
      turns.push(turn);
      if (options.run) return options.run(turn);
      return { text: "Done.", calls: 3, submission: turn.role === "synthesis" ? report : findings(turn.role) };
    },
    forget: async (key) => { forgotten.push(key); },
  };
  const runner = new ResearchRunner(store, inference, {
    enqueueReply: (key, conversationId, _event, text) => replies.push({ key, conversationId, text }),
    recordWeb: async (conversationId, _eventId, origin, text) => { web.push({ conversationId, origin, text }); },
    notify: async (input) => { notes.push({ title: input.title, kind: input.kind }); },
  }, () => clock, 0);
  const scheduled: Promise<void>[] = [];
  const control = new ResearchControl(store, runner, data, { perSenderDaily: 2, globalDaily: 3 }, (work) => { scheduled.push(work); }, () => clock);
  return { store, runner, control, turns, forgotten, replies, web, notes, scheduled, advance: (ms: number) => { clock += ms; }, settle: () => Promise.all(scheduled) };
}

const x: ResearchOrigin = { senderId: "123", conversationId: "dm:123", encodedEvent: "encoded-x-event", deliver: true };

test("chain profiles resolve by id, name or alias and carry verified accounts", async () => {
  expect(curatedChain("OP Mainnet")?.id).toBe("optimism");
  expect(curatedChain("bsc")?.id).toBe("bnb");
  expect(curatedChain("Base")?.accounts).toContain("jessepollak");
  expect(curatedChains().length).toBeGreaterThanOrEqual(12);
  const tron = await resolveChainProfile("tron", new ChainDataService(chainFetch().request));
  expect(tron).toMatchObject({ id: "tron", defillama: "Tron", nansen: "tron", coins: ["coingecko:tron", "coingecko:bitcoin"], curated: false });
  expect(await resolveChainProfile("nowhere", new ChainDataService(chainFetch().request))).toBeUndefined();
  const prompt = researchInstructions("social", base);
  expect(prompt).toContain("Narrative scout");
  expect(prompt).toContain("@base");
  expect(prompt).toContain("A cause comes before or on the day of the move");
});

test("a run collects data, runs four specialists and an editor, then reports back in the X chat", async () => {
  const f = fixture();
  const text = await f.control.command(x, { type: "research", action: "start", chain: "base", window: "7d" });
  expect(text).toMatch(/^Researching Base for 23–29 Sep 2026 against the 7d before\. Code [A-HJ-NP-Z2-9]{6}\./);
  expect(text).toContain("https://pecu.app/researches/");
  await f.settle();
  const run = f.store.list("123")[0]!;
  expect(run).toMatchObject({ state: "completed", headline: report.headline, periodStart: "2026-09-23", periodEnd: "2026-09-29" });
  expect(f.turns.map((turn) => turn.role).sort()).toEqual(["activity", "capital", "flows", "social", "synthesis"]);
  const specialist = f.turns.find((turn) => turn.role === "social")!;
  expect(specialist.prompt).toContain("Evidence pack for Base, 2026-09-23 to 2026-09-29");
  expect(specialist.prompt).toContain("Morpho Blue");
  expect(specialist.key).toBe(`research:${run.id}:social:1`);
  const editor = f.turns.find((turn) => turn.role === "synthesis")!;
  expect(editor.prompt).toContain("\"Narrative\":{\"summary\":\"social summary with numbers.\"");
  const detail = f.control.detail("123", run.code);
  expect(detail.stages.every((stage) => stage.state === "done")).toBe(true);
  expect(Object.keys(detail.findings).sort()).toEqual(["activity", "capital", "flows", "social"]);
  expect(detail.markdown).toContain("# Base, 23–29 Sep 2026");
  expect(detail.markdown).toContain("## Why it moved");
  expect(detail.markdown).toContain("[@morpho campaign post](https://x.com/morpho/status/1)");
  expect(detail.markdown).toContain("## Protocol TVL");
  expect(detail.markdown).toContain("## Method and sources");
  expect(f.replies).toEqual([{ key: `research:${run.id}`, conversationId: "dm:123", text: expect.stringContaining(report.headline) }]);
  expect(f.replies[0]!.text).toContain(`Full report: https://pecu.app/researches/${run.code}`);
  expect(f.replies[0]!.text).toEndWith("Data: Nansen (nansen.ai)");
  expect(detail.markdown).toEndWith("Data: Nansen (nansen.ai)");
  expect(f.notes).toEqual([{ title: "Base research ready", kind: "alert" }]);
  expect(f.forgotten).toContain(`research:${run.id}:collect:1`);
  expect(f.forgotten).toContain(`research:${run.id}:synthesis:1`);
});

test("web threads get the report as a research row; page runs only notify", async () => {
  const f = fixture();
  const webOrigin: ResearchOrigin = { senderId: "web-user_a", conversationId: "stocks:user_a:web-user_a#t1", encodedEvent: "", deliver: true };
  await f.control.command(webOrigin, { type: "research", action: "start", chain: "base", window: "7d" });
  await f.settle();
  expect(f.web).toHaveLength(1);
  expect(messageOriginSchema.parse(f.web[0]!.origin)).toMatchObject({ kind: "research", title: "Base research", mode: "research" });
  const page = fixture();
  await page.control.act("web-user_a", { kind: "start", chain: "base", window: "30d" }, { ...webOrigin, deliver: false });
  await page.settle();
  expect(page.web).toHaveLength(0);
  expect(page.notes).toHaveLength(1);
});

test("limits: one active run per user, a daily cap per user and overall", async () => {
  const f = fixture();
  await f.control.start(x, "base", "7d");
  expect(await f.control.command(x, { type: "research", action: "start", chain: "solana", window: "7d" })).toContain("is still running");
  await f.settle();
  await f.control.start(x, "ethereum", "7d");
  await f.settle();
  expect(await f.control.command(x, { type: "research", action: "start", chain: "solana", window: "7d" })).toBe("You have used today's 2 research runs. The limit resets at 00:00 UTC.");
  await f.control.start({ ...x, senderId: "456" }, "solana", "1d");
  await f.settle();
  expect(await f.control.command({ ...x, senderId: "789" }, { type: "research", action: "start", chain: "base", window: "7d" })).toContain("today's research capacity");
  f.advance(86_400_000);
  expect((await f.control.start(x, "arbitrum", "7d")).chainName).toBe("Arbitrum");
  expect(await f.control.command(x, { type: "research", action: "start", chain: "nowhere", window: "7d" })).toContain(`I don't know the chain "nowhere"`);
});

test("a failed specialist is retried once; the editor still writes and names what is missing", async () => {
  let socialCalls = 0;
  const f = fixture({ run: async (turn) => {
    if (turn.role === "social") { socialCalls++; throw new Error("X data is busy"); }
    return { text: "Done.", calls: 2, submission: turn.role === "synthesis" ? report : findings(turn.role) };
  } });
  const run = await f.control.start(x, "base", "7d");
  await f.settle();
  expect(socialCalls).toBe(2);
  const detail = f.control.detail("123", run.code);
  expect(detail.state).toBe("completed");
  expect(detail.stages.find((stage) => stage.role === "social")?.state).toBe("failed");
  expect(f.turns.find((turn) => turn.role === "synthesis")?.prompt).toContain("These specialists did not finish, so their sources are missing: Narrative");
  expect(detail.markdown).toContain("The narrative specialist did not finish");
});

test("prose instead of a submission is kept as notes; no specialist at all fails the run for free", async () => {
  const f = fixture({ run: async (turn) => ({ text: turn.role === "capital" ? "Long notes. ".repeat(40) : "", calls: 1, submission: turn.role === "synthesis" ? report : null }) });
  const run = await f.control.start(x, "base", "7d");
  await f.settle();
  expect(f.control.detail("123", run.code).findings.capital?.gaps[0]).toContain("did not submit structured findings");
  const none = fixture({ run: async () => ({ text: "", calls: 0, submission: null }) });
  const failed = await none.control.start(x, "base", "7d");
  await none.settle();
  expect(none.control.detail("123", failed.code)).toMatchObject({ state: "failed", error: "None of the research specialists finished. Try again later." });
  expect(none.replies[0]!.text).toContain("does not count toward your daily limit");
  expect(none.store.startedSince("123", 0)).toBe(0);
});

test("chains without Nansen skip the flow specialist", async () => {
  const f = fixture();
  const run = await f.control.start(x, "unichain", "7d");
  await f.settle();
  expect(f.turns.map((turn) => turn.role)).not.toContain("flows");
  expect(f.control.detail("123", run.code).stages.find((stage) => stage.role === "flows")).toMatchObject({ state: "skipped", summary: "Nansen does not cover Unichain." });
  expect(f.control.detail("123", run.code).markdown).not.toContain("Data: Nansen");
});

test("cancel stops a run without delivering it; delete removes a finished one", async () => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const f = fixture({ run: async (turn) => { await gate; return { text: "", calls: 1, submission: findings(turn.role) }; } });
  const run = await f.control.start(x, "base", "7d");
  await new Promise((resolve) => setTimeout(resolve, 20));
  expect(f.store.byId(run.id)?.state).toBe("researching");
  expect(await f.control.command(x, { type: "research", action: "delete", code: run.code })).toContain("still running");
  expect(await f.control.command(x, { type: "research", action: "cancel", code: run.code })).toBe(`Cancelled Base research ${run.code}.`);
  release();
  await f.settle();
  expect(f.store.byId(run.id)?.state).toBe("cancelled");
  expect(f.replies).toHaveLength(0);
  expect(f.turns.map((turn) => turn.role)).not.toContain("synthesis");
  expect(await f.control.command(x, { type: "research", action: "delete", code: run.code })).toBe(`Deleted research ${run.code}.`);
  expect(f.control.list("123").researches).toHaveLength(0);
  expect(await f.control.command(x, { type: "research", action: "status", code: run.code })).toBe(`No research ${run.code} in your account.`);
});

test("a run interrupted by an eviction resumes from its saved stage with a fresh runtime", async () => {
  const f = fixture();
  const run = f.store.create({ ...x, chain: base, window: "7d" }, now);
  f.store.update(run.id, { state: "researching", attempt: 1 });
  f.store.savePack(run.id, await new ChainDataService(chainFetch().request, () => now).pack(base, "7d"));
  for (const role of ["capital", "activity", "flows"] as const) f.store.finishStage(run.id, role, { state: "done", calls: 1, summary: "s", findings: findings(role) });
  f.store.startStage(run.id, "social");
  await f.runner.sweep();
  expect(f.turns.map((turn) => turn.role)).toEqual(["social", "synthesis"]);
  expect(f.turns[0]!.key).toBe(`research:${run.id}:social:2`);
  expect(f.store.byId(run.id)?.state).toBe("completed");
});

test("the source export follows OnChain-Reports' parser format", async () => {
  const pack = await new ChainDataService(chainFetch().request, () => now).pack(base, "7d");
  const markdown = renderSourceMarkdown("ABC234", pack);
  const lines = markdown.split("\n");
  expect(lines[0]).toBe("# Base ecosystem, 7 days to 29 Sep 2026");
  expect(lines).toContain("Window: 23 Sep 2026 through 29 Sep 2026 inclusive (UTC dates).");
  expect(lines).toContain("For DeFi TVL, USD-pegged stablecoin supply, and median tx fee, 7-day change is 2026-09-29 versus 2026-09-22.");
  expect(lines).toContain("| Metric | Latest (2026-09-29) | 7-day change | Prior 7-day change |");
  const summary = lines.filter((line) => /^\| (DeFi TVL|App fees) \(USD\) \|/.test(line));
  expect(summary[0]).toBe("| DeFi TVL (USD) | 6300000000.00 | +0.00 (+0.00%) | +300000000.00 (+5.00%) |");
  expect(summary[1]).toMatch(/^\| App fees \(USD\) \| 2000000\.00 \| \+6000000\.00 \(\+42\.86%\) \|/);
  const versus = lines.find((line) => line.startsWith("Versus "))!;
  expect(versus).toContain("App fees (USD) 20000000.00 vs 14000000.00 (+42.86%)");
  expect(versus).toMatch(/Transactions \(count\) 70000000 vs 70000000 \(\+0\.00%\)/);
  expect(lines).toContain("## DeFi TVL (USD)");
  expect(lines).toContain("| 2026-09-22 | 6300000000.00 |");
  expect(lines).toContain("Source: DefiLlama, https://api.llama.fi/v2/historicalChainTvl/Base.");
  expect(lines).toContain("### Largest increases");
  expect(lines).toContain("| Morpho Blue | 4150000000.00 | 4400000000.00 | +250000000.00 | +6.02% |");
  expect(lines).toContain("### Not ranked (missing day)");
  expect(markdown).toMatch(/among 2 protocols/);
  expect(completionText({ code: "ABC234", pack, report, link: "https://pecu.app/researches/ABC234" })).toContain("1. Morpho Blue TVL +$250M over 7d: A vault campaign pulled deposits. (high)");
});

test("the operator export carries the report, findings and the OnChain-Reports source file", async () => {
  const f = fixture();
  const run = await f.control.start(x, "base", "7d");
  await f.settle();
  const exported = f.control.export(run.code)!;
  expect(exported.research).toMatchObject({ code: run.code, state: "completed", period: { start: "2026-09-23", end: "2026-09-29" } });
  expect(exported.report?.headline).toBe(report.headline);
  expect(Object.keys(exported.findings).sort()).toEqual(["activity", "capital", "flows", "social"]);
  expect(exported.source).toStartWith("# Base ecosystem, 7 days to 29 Sep 2026");
  expect(exported.pack?.period.priorEnd).toBe("2026-09-22");
  expect(JSON.parse(JSON.stringify(exported))).toEqual(exported);
  expect(f.control.export("ZZZZZZ")).toBeUndefined();
});

test("list and status text show state, remaining runs and links", async () => {
  const f = fixture();
  expect(await f.control.command(x, { type: "research", action: "list" })).toContain("2 of 2 research runs left today.");
  const run = await f.control.start(x, "base", "7d");
  await f.settle();
  const list = await f.control.command(x, { type: "research", action: "list" });
  expect(list).toContain(`${run.code}  Base 7d  ready. ${report.headline}`);
  expect(await f.control.command(x, { type: "research", action: "status", code: run.code })).toContain(`https://pecu.app/researches/${run.code}`);
  expect(f.control.modelDetail("123", run.code)).toContain("## Why it moved");
  expect((await f.control.command(x, { type: "research", action: "help" }))).toContain("@research solana 30d");
});

const roles: ResearchRole[] = ["capital", "activity", "flows", "social", "synthesis"];
test("every role has instructions, a label and a budget", () => {
  for (const role of roles) expect(researchInstructions(role, base).length).toBeGreaterThan(1000);
});
