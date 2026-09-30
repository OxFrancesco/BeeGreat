import { researchPeriod, type ChainDataService } from "../integrations/chain-data";
import { activeResearchStates, type ResearchAction, type ResearchDetail, type ResearchList, type ResearchSummary, type ResearchWindow } from "../research-contract";
import { threadOf } from "../tasks";
import { isWebConversation } from "../web-identity";
import { curatedChains, resolveChainProfile, roleLabel, type ChainProfile } from "./agents";
import { prettyRange, renderSourceMarkdown } from "./report";
import { researchLink, type ResearchRunner } from "./runner";
import type { ResearchRun, ResearchStore } from "./store";

export class ResearchError extends Error {}

export type ResearchLimits = Readonly<{ perSenderDaily: number; globalDaily: number }>;

export type ResearchCommand = Readonly<
  | { type: "research"; action: "start"; chain: string; window: ResearchWindow }
  | { type: "research"; action: "list" }
  | { type: "research"; action: "help" }
  | { type: "research"; action: "status" | "cancel" | "delete"; code: string }
>;

export type ResearchOrigin = Readonly<{ senderId: string; conversationId: string; encodedEvent: string; deliver: boolean }>;

const day = 86_400_000;
const stateText = {
  queued: "waiting for a slot", collecting: "collecting chain data", researching: "specialists at work", synthesizing: "writing the report",
  completed: "ready", failed: "failed", cancelled: "cancelled",
} satisfies Record<ResearchRun["state"], string>;

export const researchHelpText = [
  "Research explains why a chain moved. Four specialists read chain metrics, protocol data, Nansen flows and X posts, then an editor writes a causal report.",
  "",
  "@research base  Research Base over the last 7 days",
  "@research solana 30d  Pick 1d, 7d or 30d",
  "@research  List your research",
  "@research status CODE  Check one run",
  "@research cancel CODE  Stop a run",
  "@research delete CODE  Remove a report",
  "",
  "Reports arrive in this chat and at pecu.app/researches.",
].join("\n");

export class ResearchControl {
  constructor(
    private readonly store: ResearchStore,
    private readonly runner: Pick<ResearchRunner, "advance" | "queuePosition" | "sweep">,
    private readonly data: Pick<ChainDataService, "findChain">,
    private readonly limits: ResearchLimits,
    private readonly schedule: (work: Promise<void>) => void,
    private readonly clock: () => number = Date.now,
  ) {}

  async resolveChain(query: string): Promise<ChainProfile> {
    const chain = await resolveChainProfile(query, this.data);
    if (!chain) throw new ResearchError(`I don't know the chain "${query.trim().slice(0, 40)}". Try ${curatedChains().slice(0, 6).map((entry) => entry.id).join(", ")} or another DefiLlama chain name.`);
    return chain;
  }

  private used(senderId: string): number {
    return this.store.startedSince(senderId, this.clock() - (this.clock() % day));
  }

  async start(origin: ResearchOrigin, chainQuery: string, window: ResearchWindow): Promise<ResearchRun> {
    const chain = await this.resolveChain(chainQuery);
    const since = this.clock() - (this.clock() % day);
    if (this.store.active(origin.senderId).length) {
      const running = this.store.active(origin.senderId)[0]!;
      throw new ResearchError(`Your ${running.chainName} research ${running.code} is still running. Wait for it or send @research cancel ${running.code}.`);
    }
    if (this.store.startedSince(origin.senderId, since) >= this.limits.perSenderDaily) throw new ResearchError(`You have used today's ${this.limits.perSenderDaily} research runs. The limit resets at 00:00 UTC.`);
    if (this.store.startedSince(null, since) >= this.limits.globalDaily) throw new ResearchError("Pecu has reached today's research capacity. Try again after 00:00 UTC.");
    const run = this.store.create({ ...origin, chain, window }, this.clock());
    this.schedule(this.runner.sweep());
    return run;
  }

  startedText(run: ResearchRun): string {
    const period = researchPeriod(run.window, run.createdAt);
    const position = this.runner.queuePosition(run);
    return [
      `Researching ${run.chainName} for ${prettyRange(period.start, period.end)} against the ${run.window} before. Code ${run.code}.`,
      `Four specialists read chain data, Nansen flows and X posts, then an editor writes the causal report. It usually takes 5 to 15 minutes${position ? `, after ${position} ${position === 1 ? "run" : "runs"} ahead of yours` : ""}.`,
      `${run.deliver ? "I'll post it here when it's done. " : ""}Follow it at ${researchLink(run.code)}`,
    ].join("\n\n");
  }

  summary(run: ResearchRun): ResearchSummary {
    return {
      code: run.code,
      chain: { id: run.chainId, name: run.chainName },
      window: run.window,
      period: run.periodStart && run.periodEnd ? { start: run.periodStart, end: run.periodEnd } : null,
      state: run.state,
      headline: run.headline,
      error: run.error,
      stages: this.store.stages(run.id).map((stage) => ({ role: stage.role, label: roleLabel(stage.role), state: stage.state, startedAt: stage.startedAt, endedAt: stage.endedAt, calls: stage.calls, summary: stage.summary, error: stage.error })),
      channel: isWebConversation(run.conversationId) ? "web" : "x",
      threadId: threadOf(run.conversationId),
      createdAt: run.createdAt,
      completedAt: run.completedAt,
    };
  }

  list(senderId: string): ResearchList {
    return {
      researches: this.store.list(senderId).map((run) => this.summary(run)),
      chains: curatedChains().map((chain) => ({ id: chain.id, name: chain.name })),
      limit: { used: this.used(senderId), daily: this.limits.perSenderDaily },
    };
  }

  private owned(senderId: string, code: string): ResearchRun {
    const run = this.store.get(senderId, code);
    if (!run) throw new ResearchError(`No research ${code.toUpperCase()} in your account.`);
    return run;
  }

  detail(senderId: string, code: string): ResearchDetail {
    const run = this.owned(senderId, code);
    const { report, markdown } = this.store.report(run.id);
    return { ...this.summary(run), report, markdown, findings: this.store.findings(run.id) };
  }

  /** A finished run for the operator export: the report, the structured findings, and the pack in OnChain-Reports' source format. */
  export(code: string) {
    const run = this.store.byCode(code);
    if (!run) return undefined;
    const stored = this.store.report(run.id);
    const pack = this.store.pack(run.id);
    return {
      research: this.summary(run),
      markdown: stored.markdown,
      report: stored.report,
      findings: this.store.findings(run.id),
      pack: pack ?? null,
      source: pack ? renderSourceMarkdown(run.code, pack) : null,
    };
  }

  cancel(senderId: string, code: string): ResearchRun {
    const run = this.owned(senderId, code);
    if (!activeResearchStates.has(run.state)) throw new ResearchError(`Research ${run.code} has already ${run.state === "completed" ? "finished" : run.state === "failed" ? "failed" : "been cancelled"}.`);
    return this.store.transition(run.id, [...activeResearchStates], { state: "cancelled", completedAt: this.clock() }) ?? this.owned(senderId, code);
  }

  delete(senderId: string, code: string): void {
    const run = this.owned(senderId, code);
    if (activeResearchStates.has(run.state)) throw new ResearchError(`Research ${run.code} is still running. Cancel it first with @research cancel ${run.code}.`);
    this.store.delete(run.id, this.clock());
  }

  async act(senderId: string, action: ResearchAction, origin: ResearchOrigin): Promise<Readonly<{ research: ResearchSummary | null; message: string }>> {
    switch (action.kind) {
      case "start": {
        const run = await this.start(origin, action.chain, action.window);
        return { research: this.summary(run), message: `Started ${run.chainName} research ${run.code}.` };
      }
      case "rerun": {
        const previous = this.owned(senderId, action.code);
        const run = await this.start(origin, previous.chainName, previous.window);
        return { research: this.summary(run), message: `Started ${run.chainName} research ${run.code}.` };
      }
      case "cancel": {
        const run = this.cancel(senderId, action.code);
        return { research: this.summary(run), message: `Cancelled research ${run.code}.` };
      }
      case "delete":
        this.delete(senderId, action.code);
        return { research: null, message: `Deleted research ${action.code}.` };
    }
  }

  statusText(run: ResearchRun): string {
    const summary = this.summary(run);
    const period = summary.period ? prettyRange(summary.period.start, summary.period.end) : `last ${run.window}`;
    const stages = summary.stages.map((stage) => `${stage.label}: ${stage.state}`).join(", ");
    const head = `${run.chainName}, ${period} (${run.code}): ${stateText[run.state]}.`;
    if (run.state === "completed") return `${head}\n\n${run.headline ?? "The report is ready."}\n\n${researchLink(run.code)}`;
    if (run.state === "failed") return `${head} ${run.error ?? ""}`.trim();
    if (run.state === "cancelled") return head;
    return `${head} ${stages}.\n\n${researchLink(run.code)}`;
  }

  listText(senderId: string): string {
    const runs = this.store.list(senderId, 8);
    const used = this.used(senderId);
    const left = Math.max(0, this.limits.perSenderDaily - used);
    const header = `${left} of ${this.limits.perSenderDaily} research runs left today.`;
    if (!runs.length) return `${header}\n\nNo research yet. Send @research base, or another chain such as ${curatedChains().slice(1, 4).map((chain) => chain.id).join(", ")}.`;
    return [header, "", ...runs.map((run) => `${run.code}  ${run.chainName} ${run.window}  ${stateText[run.state]}${run.headline ? `. ${run.headline}` : ""}`), "", "pecu.app/researches"].join("\n");
  }

  /** Chat command replies. Errors the user can fix come back as text. */
  async command(origin: ResearchOrigin, command: ResearchCommand): Promise<string> {
    try {
      switch (command.action) {
        case "help": return researchHelpText;
        case "list": return this.listText(origin.senderId);
        case "start": return this.startedText(await this.start(origin, command.chain, command.window));
        case "status": return this.statusText(this.owned(origin.senderId, command.code));
        case "cancel": {
          const run = this.cancel(origin.senderId, command.code);
          return `Cancelled ${run.chainName} research ${run.code}.${run.attempt === 0 ? " It had not started, so it does not count toward today's limit." : ""}`;
        }
        case "delete":
          this.delete(origin.senderId, command.code);
          return `Deleted research ${command.code.toUpperCase()}.`;
      }
    } catch (error) {
      if (error instanceof ResearchError) return error.message;
      throw error;
    }
  }

  /** The report for the chat model: finished Markdown, or the run's status. */
  modelDetail(senderId: string, code: string): string {
    const run = this.owned(senderId, code);
    const { markdown } = this.store.report(run.id);
    if (run.state !== "completed" || !markdown) return this.statusText(run);
    return markdown.length > 14_000 ? `${markdown.slice(0, 14_000)}\n\n(Truncated. The full report is at ${researchLink(run.code)})` : markdown;
  }
}
