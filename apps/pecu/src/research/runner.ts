import type { JsonValue } from "../json-contract";
import type { ResearchPack } from "../integrations/chain-data";
import { log } from "../logger";
import { findingsSchema, reportSchema, researchRoles, specialistRoles, type Findings, type ResearchReport, type ResearchRole, type ResearchWindow } from "../research-contract";
import type { MessageOrigin, NotificationKind } from "../task-contract";
import { isWebConversation } from "../web-identity";
import { researchAgent, roleLabel, type ChainProfile } from "./agents";
import { completionText, packBrief, prettyRange, renderMarkdown, usesNansen } from "./report";
import type { ResearchRun, ResearchStore } from "./store";

export type ResearchTurn = Readonly<{
  key: string;
  code: string;
  role: ResearchRole;
  chain: ChainProfile;
  prompt: string;
  senderId: string;
}>;
export type ResearchTurnResult = Readonly<{ text: string; submission: JsonValue | null; calls: number }>;

/** The isolated inference runtimes that collect data and run each research agent. */
export type ResearchInference = Readonly<{
  collect(key: string, chain: ChainProfile, window: ResearchWindow): Promise<ResearchPack>;
  run(turn: ResearchTurn): Promise<ResearchTurnResult>;
  forget(key: string): Promise<void>;
}>;

export type ResearchDelivery = Readonly<{
  enqueueReply(correlationKey: string, conversationId: string, replyToEvent: string, text: string): void;
  recordWeb?(conversationId: string, eventId: string, origin: MessageOrigin, text: string): Promise<void>;
  notify?(input: Readonly<{ senderId: string; conversationId: string; code: string; kind: NotificationKind; title: string; body: string }>): Promise<void>;
}>;

export const researchLink = (code: string) => `https://pecu.app/researches/${code}`;

/** Runs that may advance at once across all users. The rest wait queued. */
const concurrentRuns = 2;
const maxStageAttempts = 2;
const maxCollectAttempts = 3;
/** A queued run that never got a slot in this long fails instead of starting hours late. */
const queuedExpiryMs = 6 * 60 * 60_000;

export class ResearchRunner {
  private readonly running = new Set<string>();
  private sweeping?: Promise<void>;

  constructor(
    private readonly store: ResearchStore,
    private readonly inference: ResearchInference,
    private readonly delivery: ResearchDelivery,
    private readonly clock: () => number = Date.now,
    /** Specialists start this far apart, so their runtimes do not all boot OpenCode in the same second. */
    private readonly staggerMs = 8_000,
    private readonly sleep: (ms: number) => Promise<void> = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  ) {}

  /** Advance every active run that has a free slot. Concurrent callers share one sweep. */
  sweep(): Promise<void> {
    return this.sweeping ??= this.performSweep().finally(() => { this.sweeping = undefined; });
  }

  private async performSweep(): Promise<void> {
    const now = this.clock();
    const work: Promise<void>[] = [];
    for (const run of this.store.active()) {
      if (this.running.has(run.id)) continue;
      // Nothing in memory owns this run, so any running stage was interrupted by an eviction or deploy.
      for (const stage of this.store.stages(run.id)) if (stage.state === "running") this.store.resetStage(run.id, stage.role);
      if (run.state === "queued" && now - run.createdAt > queuedExpiryMs) {
        this.fail(run, "It waited too long for a free research slot.");
        continue;
      }
      if (this.running.size + work.length >= concurrentRuns) break;
      work.push(this.advance(run.id));
    }
    await Promise.allSettled(work);
  }

  /** Runs still waiting for a slot ahead of this one. */
  queuePosition(run: ResearchRun): number {
    if (run.state !== "queued") return 0;
    const active = this.store.active();
    const ahead = active.filter((other) => other.createdAt < run.createdAt).length;
    return Math.max(0, ahead - concurrentRuns + 1);
  }

  async advance(id: string): Promise<void> {
    if (this.running.has(id)) return;
    this.running.add(id);
    try {
      for (let step = 0; step < 8; step++) {
        const run = this.store.byId(id);
        if (!run) return;
        if (!(await this.step(run))) return;
      }
    } catch (error) {
      log("error", "research_advance_failed", { runId: id, error: (error instanceof Error ? error.message : String(error)) });
    } finally {
      this.running.delete(id);
    }
  }

  /** One state transition. Returns whether another step should follow. */
  private async step(run: ResearchRun): Promise<boolean> {
    switch (run.state) {
      case "queued":
        return this.store.transition(run.id, ["queued"], { state: "collecting" }) !== undefined;
      case "collecting":
        return this.collect(run);
      case "researching":
        return this.research(run);
      case "synthesizing":
        return this.synthesize(run);
      default:
        return false;
    }
  }

  private async collect(run: ResearchRun): Promise<boolean> {
    const attempt = run.attempt + 1;
    this.store.update(run.id, { attempt });
    const chain = this.store.chain(run.id);
    try {
      const pack = await this.inference.collect(`research:${run.id}:collect:${attempt}`, chain, run.window);
      this.store.savePack(run.id, pack);
      void this.inference.forget(`research:${run.id}:collect:${attempt}`).catch(() => undefined);
      return this.store.transition(run.id, ["collecting"], { state: "researching", periodStart: pack.period.start, periodEnd: pack.period.end, error: null }) !== undefined;
    } catch (error) {
      log("warn", "research_collect_failed", { runId: run.id, attempt, error: (error instanceof Error ? error.message : String(error)) });
      if (attempt >= maxCollectAttempts) return this.fail(run, "Pecu could not load the chain data for this research. Try again later.");
      this.store.update(run.id, { error: `Data collection failed, retrying: ${(error instanceof Error ? error.message : String(error)).slice(0, 200)}` });
      return false;
    }
  }

  private async research(run: ResearchRun): Promise<boolean> {
    const pack = this.store.pack(run.id);
    if (!pack) return this.store.transition(run.id, ["researching"], { state: "collecting" }) !== undefined;
    const chain = this.store.chain(run.id);
    const brief = packBrief(pack);
    const stages = this.store.stages(run.id).filter((stage) => specialistRoles.some((role) => role === stage.role));
    const pending = stages.filter((stage) => stage.state === "pending" || (stage.state === "failed" && stage.attempt < maxStageAttempts));
    const starting = pending.filter((stage) => stage.role !== "flows" || chain.nansen);
    await Promise.all(pending.map(async (stage) => {
      if (stage.role === "flows" && !chain.nansen) {
        this.store.finishStage(run.id, stage.role, { state: "skipped", calls: 0, summary: `Nansen does not cover ${chain.name}.` });
        return;
      }
      const slot = starting.indexOf(stage);
      if (slot > 0) await this.sleep(slot * this.staggerMs);
      if (this.store.byId(run.id)?.state !== "researching") return;
      this.store.startStage(run.id, stage.role);
      const attempt = stage.attempt + 1;
      const key = `research:${run.id}:${stage.role}:${attempt}`;
      try {
        const result = await this.inference.run({ key, code: run.code, role: stage.role, chain, senderId: run.senderId, prompt: specialistPrompt(run, stage.role, chain, brief) });
        if (this.store.byId(run.id)?.state !== "researching") {
          this.store.finishStage(run.id, stage.role, { state: "skipped", calls: result.calls, summary: null, error: "Cancelled" });
          return;
        }
        const findings = specialistFindings(result);
        if (!findings) {
          this.store.finishStage(run.id, stage.role, { state: "failed", calls: result.calls, summary: null, error: "No findings were submitted." });
          return;
        }
        this.store.finishStage(run.id, stage.role, { state: "done", calls: result.calls, summary: findings.summary, findings });
      } catch (error) {
        log("warn", "research_stage_failed", { runId: run.id, role: stage.role, attempt, error: (error instanceof Error ? error.message : String(error)) });
        this.store.finishStage(run.id, stage.role, { state: "failed", calls: 0, summary: null, error: (error instanceof Error ? error.message : String(error)) });
      }
    }));
    const current = this.store.byId(run.id);
    if (!current || current.state !== "researching") return false;
    const after = this.store.stages(run.id).filter((stage) => specialistRoles.some((role) => role === stage.role));
    if (after.some((stage) => stage.state === "pending" || (stage.state === "failed" && stage.attempt < maxStageAttempts))) return true;
    if (!after.some((stage) => stage.state === "done")) return this.fail(current, "None of the research specialists finished. Try again later.");
    return this.store.transition(run.id, ["researching"], { state: "synthesizing" }) !== undefined;
  }

  private async synthesize(run: ResearchRun): Promise<boolean> {
    const pack = this.store.pack(run.id);
    if (!pack) return this.fail(run, "The research data was lost before the report was written.");
    const chain = this.store.chain(run.id);
    const findings = this.store.findings(run.id);
    const missing = this.store.stages(run.id).filter((stage) => stage.role !== "synthesis" && stage.state !== "done").map((stage) => stage.role);
    let report: ResearchReport | null = null;
    let calls = 0;
    for (let attempt = (this.store.stages(run.id).find((stage) => stage.role === "synthesis")?.attempt ?? 0) + 1; attempt <= maxStageAttempts && !report; attempt++) {
      this.store.startStage(run.id, "synthesis");
      try {
        const result = await this.inference.run({ key: `research:${run.id}:synthesis:${attempt}`, code: run.code, role: "synthesis", chain, senderId: run.senderId, prompt: synthesisPrompt(run, chain, pack, findings, missing) });
        calls += result.calls;
        const parsed = reportSchema.safeParse(result.submission);
        if (parsed.success) report = parsed.data;
      } catch (error) {
        log("warn", "research_synthesis_failed", { runId: run.id, attempt, error: (error instanceof Error ? error.message : String(error)) });
      }
      if (this.store.byId(run.id)?.state !== "synthesizing") return false;
    }
    this.store.finishStage(run.id, "synthesis", { state: report ? "done" : "failed", calls, summary: report?.headline ?? null, error: report ? undefined : "The editor did not submit a report." });
    const markdown = renderMarkdown({ code: run.code, pack, report, findings, missing });
    this.store.saveReport(run.id, report, markdown);
    const done = this.store.transition(run.id, ["synthesizing"], { state: "completed", headline: report?.headline ?? null, completedAt: this.clock(), error: null });
    if (!done) return false;
    this.cleanup(done);
    await this.deliver(done, completionText({ code: run.code, pack, report, link: researchLink(run.code), nansen: usesNansen(findings) }), "alert", `${chain.name} research ready`, report?.headline ?? `${chain.name}, ${prettyRange(pack.period.start, pack.period.end)}`);
    return false;
  }

  private fail(run: ResearchRun, message: string): boolean {
    const failed = this.store.transition(run.id, ["queued", "collecting", "researching", "synthesizing"], { state: "failed", error: message, completedAt: this.clock() });
    if (failed) {
      this.cleanup(failed);
      void this.deliver(failed, `${failed.chainName} research ${failed.code} did not finish. ${message} It does not count toward your daily limit.`, "failed", `${failed.chainName} research failed`, message);
    }
    return false;
  }

  /** Delete the finished run's isolated runtimes. */
  private cleanup(run: ResearchRun): void {
    const keys = [
      ...Array.from({ length: run.attempt }, (_, index) => `research:${run.id}:collect:${index + 1}`),
      ...this.store.stages(run.id).flatMap((stage) => Array.from({ length: stage.attempt }, (_, index) => `research:${run.id}:${stage.role}:${index + 1}`)),
    ];
    for (const key of keys) void this.inference.forget(key).catch(() => undefined);
  }

  private async deliver(run: ResearchRun, text: string, kind: NotificationKind, title: string, body: string): Promise<void> {
    try {
      if (run.deliver) {
        if (isWebConversation(run.conversationId)) await this.delivery.recordWeb?.(run.conversationId, `research:${run.id}`, { kind: "research", code: run.code, title: `${run.chainName} research`, mode: "research" }, text);
        else if (run.encodedEvent) this.delivery.enqueueReply(`research:${run.id}`, run.conversationId, run.encodedEvent, text);
      }
      await this.delivery.notify?.({ senderId: run.senderId, conversationId: run.conversationId, code: run.code, kind, title, body });
    } catch (error) {
      log("warn", "research_delivery_failed", { runId: run.id, error: (error instanceof Error ? error.message : String(error)) });
    }
  }
}

function specialistFindings(result: ResearchTurnResult): Findings | undefined {
  const parsed = findingsSchema.safeParse(result.submission);
  if (parsed.success) return parsed.data;
  const text = result.text.trim();
  if (text.length < 200) return undefined;
  return { summary: text.slice(0, 1500), findings: [], gaps: ["This specialist wrote notes but did not submit structured findings."] };
}

function specialistPrompt(run: ResearchRun, role: ResearchRole, chain: ChainProfile, brief: string): string {
  const agent = researchAgent(role);
  return [
    `Research run ${run.code}: why did ${chain.name} move over the last ${run.window}?`,
    `You are the ${agent.label} specialist. ${agent.description} You have ${agent.budget} tool calls. The other specialists cover the rest, so stay on your sources.`,
    brief,
    "When you can explain the main moves in your area, call research_findings once with your structured findings.",
  ].join("\n\n");
}

function synthesisPrompt(run: ResearchRun, chain: ChainProfile, pack: ResearchPack, findings: Partial<Record<ResearchRole, Findings>>, missing: readonly ResearchRole[]): string {
  return [
    `Research run ${run.code}: ${chain.name}, ${pack.period.start} to ${pack.period.end}.`,
    packBrief(pack),
    `Specialist findings as JSON, keyed by specialist:\n${JSON.stringify(Object.fromEntries(researchRoles.flatMap((role) => findings[role] ? [[roleLabel(role), findings[role]]] : [])))}`,
    missing.length ? `These specialists did not finish, so their sources are missing: ${missing.map(roleLabel).join(", ")}. Say so in unexplained where it matters.` : "Every specialist finished.",
    "Write the report now with research_report.",
  ].join("\n\n");
}
