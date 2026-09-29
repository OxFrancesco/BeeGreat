import type { PecuAgent, TaskRunContext } from "./agent";
import type { VerifiedMessage } from "./domain";
import { log } from "./logger";
import type { PecuStore } from "./state";
import { grantActive, type MessageOrigin, type NotificationKind } from "./task-contract";
import { describeTrigger, nextOccurrence } from "./task-schedule";
import { threadOf, type TaskRecord, type TaskRun, type TaskStore } from "./tasks";
import { isWebConversation } from "./web-identity";

/** A run left `running` this long was interrupted by an eviction or deploy. */
const staleRunMs = 15 * 60_000;
const retryDelayMs = 60_000;
const maxAttempts = 10;
const concurrency = 4;
const heartbeatOk = "HEARTBEAT_OK";

export type PushMessage = Readonly<{ title: string; body: string; tag: string; kind: NotificationKind; code: string; threadId: string | null; channel: "x" | "web" }>;

export interface PushSender {
  /** Send to every token. Returns the tokens the provider says are no longer registered. */
  send(tokens: readonly string[], message: PushMessage): Promise<string[]>;
}

export type ProactiveDeps = Readonly<{
  tasks: TaskStore;
  agent: Pick<PecuAgent, "runTask" | "tokenPriceUsd">;
  chat: Pick<PecuStore, "enqueueReply" | "intentForSource">;
  web?: Readonly<{
    lock(conversationId: string): (() => void) | undefined;
    recordTask(conversationId: string, eventId: string, origin: MessageOrigin, reply: string): Promise<void>;
  }>;
  push?: PushSender;
  clock?: () => number;
}>;

type Outcome = Readonly<{ kind: NotificationKind; summary: string } | { kind: "quiet"; summary: string }>;

/** Whether a heartbeat reply is only the acknowledgement, following OpenClaw's 300-character budget. */
export function quietHeartbeat(reply: string): boolean {
  const trimmed = reply.trim();
  if (!trimmed.startsWith(heartbeatOk) && !trimmed.endsWith(heartbeatOk)) return false;
  return trimmed.replaceAll(heartbeatOk, "").trim().length <= 300;
}

function firstLine(text: string, limit = 180): string {
  const line = text.replaceAll(heartbeatOk, "").replace(/\s+/g, " ").trim();
  return line.length > limit ? `${line.slice(0, limit - 1)}…` : line;
}

/** The message an automated run sends to the agent. It frames the stored instruction as the user's words from earlier. */
export function taskPrompt(task: TaskRecord, now: number): string {
  const grant = task.grant;
  const unattended = grantActive(grant, now)
    ? `Transactions inside this automation's allowance (${grant.scopes.join(" and ")}, up to $${grant.maxUsdPerRun} per run) execute without asking when YOLO is on; anything else returns a preview for the user. You may prepare up to 4 transactions in sequence, each only after the previous one is confirmed on Base. After a preview that needs approval, stop and summarize what is waiting.`
    : "Transaction tools return a preview the user confirms later. Prepare at most one, then stop and summarize what is waiting.";
  const lines = [
    `Scheduled run of the user's automation ${task.code} "${task.title}" (${describeTrigger(task.trigger)}). The user set this up earlier and is not watching; your reply is delivered to this chat and as a phone notification, so lead with the outcome in one or two sentences.`,
    `When the request says when to stop or change (for example "until I hold 100 AERO" or "then check hourly instead"), and that point is reached, call task_update on ${task.code} to delete, pause or edit it, or task_create for the follow-up, and say so. Otherwise leave automations unchanged.`,
    `The user's request: ${task.instruction}`,
    task.mode === "heartbeat"
      ? `This is a heartbeat check. Treat the request as a checklist and use read tools. Do not repeat older requests. If nothing needs the user's attention, reply exactly ${heartbeatOk} and nothing else.`
      : unattended,
  ];
  if (task.trigger.kind === "price") lines.push(`The price condition was just met: ${describeTrigger(task.trigger)}.`);
  return lines.join("\n\n");
}

export class ProactiveRunner {
  private sweeping?: Promise<void>;
  private readonly running = new Set<string>();
  private readonly clock: () => number;

  constructor(private readonly deps: ProactiveDeps) {
    this.clock = deps.clock ?? Date.now;
  }

  /** Run everything that is due. Concurrent callers share one sweep. */
  sweep(): Promise<void> {
    return this.sweeping ??= this.performSweep().finally(() => { this.sweeping = undefined; });
  }

  private async performSweep(): Promise<void> {
    const now = this.clock();
    const { tasks } = this.deps;
    for (const run of tasks.staleRuns(now - staleRunMs)) {
      if (this.running.has(run.id)) continue;
      tasks.finishRun(run.id, "failed", "Interrupted before it finished", now);
      log("warn", "task_run_interrupted", { runId: run.id });
    }
    const work: Array<() => Promise<void>> = [];
    for (const run of tasks.retryable(now)) {
      const task = tasks.byId(run.taskId);
      if (!task || task.state === "cancelled" || task.state === "paused") {
        tasks.finishRun(run.id, "failed", task?.state === "paused" ? "Paused before it ran" : "Automation was deleted", now);
        continue;
      }
      if (tasks.resumeRun(run.id, now)) work.push(() => this.execute(task, { ...run, state: "running" }));
    }
    for (const task of tasks.due(now)) {
      const run = await this.claim(task, now);
      if (run) work.push(() => this.execute(tasks.byId(task.id) ?? task, run));
    }
    await this.limit(work);
  }

  private async limit(work: Array<() => Promise<void>>): Promise<void> {
    const queue = [...work];
    const workers = Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
      for (let job = queue.shift(); job; job = queue.shift()) {
        try { await job(); }
        catch (error) { log("error", "task_run_crashed", { error: error instanceof Error ? error.message : String(error) }); }
      }
    });
    await Promise.all(workers);
  }

  /** Advance the task past this occurrence and claim a run for it. Price triggers only claim once the condition holds. */
  private async claim(task: TaskRecord, now: number): Promise<TaskRun | undefined> {
    const { tasks } = this.deps;
    if (task.trigger.kind === "price") {
      const trigger = task.trigger;
      let price: number;
      try {
        price = await this.deps.agent.tokenPriceUsd(task.senderId, trigger.token);
      } catch (error) {
        tasks.update(task.id, { nextRunAt: nextOccurrence(trigger, now), lastOutcome: "Price unavailable" }, now);
        log("warn", "task_price_unavailable", { code: task.code, error: error instanceof Error ? error.message : String(error) });
        return undefined;
      }
      const target = Number(trigger.priceUsd);
      const met = trigger.direction === "above" ? price >= target : price <= target;
      if (!met) {
        tasks.update(task.id, { nextRunAt: nextOccurrence(trigger, now), lastOutcome: `Checked at $${price < 1 ? price.toPrecision(4) : price.toFixed(2)}` }, now);
        return undefined;
      }
      tasks.update(task.id, { nextRunAt: null }, now);
      return tasks.claimRun(task.id, now, now);
    }
    const scheduledFor = task.nextRunAt ?? now;
    tasks.update(task.id, { nextRunAt: nextOccurrence(task.trigger, Math.max(now, scheduledFor)) }, now);
    return tasks.claimRun(task.id, scheduledFor, now);
  }

  private async execute(task: TaskRecord, run: TaskRun): Promise<void> {
    const { tasks } = this.deps;
    this.running.add(run.id);
    try {
      const outcome = await this.perform(task, run);
      if (outcome === "deferred") return;
      const now = this.clock();
      tasks.finishRun(run.id, outcome.kind === "quiet" ? "quiet" : outcome.kind === "failed" ? "failed" : "done", outcome.summary, now);
      const current = tasks.byId(task.id) ?? task;
      const finished = (current.trigger.kind === "once" || current.trigger.kind === "price") && current.state === "active";
      tasks.update(task.id, { lastRunAt: now, runCount: current.runCount + 1, lastOutcome: outcome.summary }, now);
      if (finished) tasks.update(task.id, { state: "completed", nextRunAt: null }, now);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log("error", "task_run_failed", { code: task.code, runId: run.id, error: message });
      tasks.finishRun(run.id, "failed", message);
      tasks.update(task.id, { lastRunAt: this.clock(), lastOutcome: "Failed" });
      await this.notify(task, run, "failed", `${task.title} failed`, "Pecu could not finish this automation. Open the chat for details.");
    } finally {
      this.running.delete(run.id);
    }
  }

  private async perform(task: TaskRecord, run: TaskRun): Promise<Outcome | "deferred"> {
    const origin: MessageOrigin = { kind: "task", code: task.code, title: task.title, mode: task.mode };
    const eventId = `task:${run.id}:${run.attempt}`;
    if (task.mode === "remind") {
      const text = `Reminder: ${task.instruction}`;
      await this.deliver(task, run, eventId, origin, text);
      await this.notify(task, run, "reminder", task.title, task.instruction);
      return { kind: "reminder", summary: "Reminder sent" };
    }
    const web = isWebConversation(task.conversationId);
    const release = web ? this.deps.web?.lock(task.conversationId) : () => {};
    if (!release) return this.defer(task, run, "Thread busy");
    let result: { reply?: string; run: TaskRunContext };
    try {
      const message: VerifiedMessage = { eventId, senderId: task.senderId, conversationId: task.conversationId, encodedEvent: task.encodedEvent, text: taskPrompt(task, this.clock()) };
      result = await this.deps.agent.runTask(message, { taskCode: task.code, mode: task.mode, grant: task.grant });
      if (result.run.busy || result.reply === undefined) return this.defer(task, run, "Pecu was busy");
      if (task.mode === "heartbeat" && !result.run.intents.length && quietHeartbeat(result.reply)) {
        return { kind: "quiet", summary: "Nothing needed attention" };
      }
      const waiting = result.run.waiting;
      const answer = task.mode === "heartbeat" ? result.reply.replaceAll(heartbeatOk, "").trim() : result.reply;
      // The confirmation code must reach the user even when the model's summary left it out.
      const reply = waiting && !answer.includes(waiting.code) ? `${answer}\n\nReply "confirm" to proceed or send /confirm ${waiting.code}. Cancel: /cancel ${waiting.code}` : answer;
      await this.deliver(task, run, eventId, origin, reply);
      const kind = this.kind(result.run);
      const title = kind === "approval" ? `${task.title}: confirm the transaction` : kind === "executed" ? `${task.title}: done` : kind === "failed" ? `${task.title} failed` : task.title;
      const body = kind === "approval" && result.run.waiting ? `${firstLine(reply, 140)} ${result.run.waiting.reason}` : firstLine(reply);
      await this.notify(task, run, kind, title, body);
      return { kind, summary: firstLine(reply, 120) };
    } finally {
      release();
    }
  }

  private kind(run: TaskRunContext): NotificationKind {
    const states = run.intents.map((source) => this.deps.chat.intentForSource(source)?.state);
    if (states.includes("failed")) return "failed";
    if (run.waiting) return "approval";
    return states.length && states.every((state) => state === "succeeded") ? "executed" : "alert";
  }

  private defer(task: TaskRecord, run: TaskRun, reason: string): Outcome | "deferred" {
    if (run.attempt >= maxAttempts) return { kind: "failed", summary: `${reason}; gave up after ${maxAttempts} tries` };
    this.deps.tasks.deferRun(run.id, this.clock() + retryDelayMs);
    log("info", "task_run_deferred", { code: task.code, runId: run.id, attempt: run.attempt, reason });
    return "deferred";
  }

  private async deliver(task: TaskRecord, run: TaskRun, eventId: string, origin: MessageOrigin, text: string): Promise<void> {
    if (isWebConversation(task.conversationId)) {
      await this.deps.web?.recordTask(task.conversationId, eventId, origin, text);
    } else if (task.encodedEvent) {
      this.deps.chat.enqueueReply(`task:${run.id}`, task.conversationId, task.encodedEvent, `${task.title}\n\n${text}`);
    }
  }

  private async notify(task: TaskRecord, run: TaskRun, kind: NotificationKind, title: string, body: string): Promise<void> {
    const { tasks, push } = this.deps;
    tasks.addNotification({ senderId: task.senderId, taskCode: task.code, conversationId: task.conversationId, kind, title, body }, this.clock());
    const tokens = tasks.devices(task.senderId);
    if (!push || !tokens.length) return;
    try {
      const gone = await push.send(tokens, {
        title, body, kind, code: task.code, tag: `task:${task.code}:${run.scheduledFor}`,
        threadId: threadOf(task.conversationId), channel: isWebConversation(task.conversationId) ? "web" : "x",
      });
      for (const token of gone) tasks.forgetToken(token);
    } catch (error) {
      log("warn", "task_push_failed", { code: task.code, error: error instanceof Error ? error.message : String(error) });
    }
  }
}
