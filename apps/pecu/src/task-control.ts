import { z } from "zod";
import type { VerifiedMessage } from "./domain";
import {
  grantActive, grantFromInput, grantInputSchema, maxActiveTasks, taskCodeSchema, taskModeSchema, triggerFromInput, triggerInputSchema,
  type GrantScope, type TaskAction, type TaskView,
} from "./task-contract";
import { describeTime, describeTrigger, nextOccurrence } from "./task-schedule";
import { threadOf, type TaskRecord, type TaskStore } from "./tasks";
import { isWebConversation } from "./web-identity";

export const taskCreateInputSchema = z.strictObject({
  title: z.string().trim().min(1).max(80).describe("Short name the user will recognise, for example Weekly index rebalance."),
  mode: taskModeSchema.describe("remind: send the instruction as a reminder, no tools. run: run the instruction as an agent turn, which may read data and prepare transactions. heartbeat: run a periodic checklist and stay silent unless something needs the user's attention."),
  instruction: z.string().trim().min(1).max(1000).describe("The user's request in their own words, complete enough to run later without this conversation."),
  trigger: triggerInputSchema,
  grant: grantInputSchema.optional().describe("Only when the user asked Pecu to execute transactions unattended. It starts as a request the user must approve; you cannot approve it."),
});
export type TaskCreateInput = z.infer<typeof taskCreateInputSchema>;

export const taskUpdateInputSchema = z.strictObject({
  code: taskCodeSchema.describe("The six-character code from task_list or task_create."),
  action: z.enum(["edit", "pause", "resume", "delete", "run_now"]).describe("delete removes the automation and revokes its allowance. run_now runs it within a minute."),
  title: z.string().trim().min(1).max(80).optional(),
  mode: taskModeSchema.optional().describe("Change what happens at each run. Only run keeps an allowance."),
  instruction: z.string().trim().min(1).max(1000).optional().describe("The full new instruction, not a diff."),
  trigger: triggerInputSchema.optional().describe("The full new schedule."),
  grant: grantInputSchema.optional().describe("Replaces the allowance request. The user must approve it again."),
  remove_grant: z.boolean().optional().describe("Drop the allowance so every transaction waits for the user."),
});
export type TaskUpdateInput = z.infer<typeof taskUpdateInputSchema>;

/** Who asked for a change. Only the user, through a verified command or a signed-in app, can approve an allowance. */
export type Actor = "user" | "model";

export type TaskCommand = Readonly<{ type: "tasks"; action: "list" } | { type: "tasks"; action: TaskAction["kind"]; code: string; maxUsd?: number }>;

const scopeText = (scopes: readonly GrantScope[]) => scopes.map((scope) => scope === "trade" ? "trades" : "liquidity").join(" and ");

export class TaskError extends Error {}

export type TaskChange = Readonly<{ task: TaskView; message: string }>;

export class TaskControl {
  constructor(
    private readonly store: TaskStore,
    private readonly chat: Readonly<{ yoloEnabled(senderId: string, conversationId: string): boolean }>,
    private readonly clock: () => number = Date.now,
  ) {}

  view(task: TaskRecord): TaskView {
    const now = this.clock();
    return {
      code: task.code, title: task.title, mode: task.mode, instruction: task.instruction, trigger: task.trigger,
      schedule: describeTrigger(task.trigger), state: task.state, nextRunAt: task.nextRunAt, lastRunAt: task.lastRunAt,
      lastOutcome: task.lastOutcome, runCount: task.runCount, channel: isWebConversation(task.conversationId) ? "web" : "x",
      threadId: threadOf(task.conversationId), grant: task.grant ? { ...task.grant, active: grantActive(task.grant, now) } : null,
      yolo: this.chat.yoloEnabled(task.senderId, task.conversationId), createdAt: task.createdAt,
    };
  }

  list(senderId: string): TaskView[] {
    return this.store.list(senderId).map((task) => this.view(task));
  }

  create(message: VerifiedMessage, raw: TaskCreateInput): TaskView {
    const input = taskCreateInputSchema.parse(raw);
    if (this.store.activeCount(message.senderId) >= maxActiveTasks) throw new TaskError(`You already have ${maxActiveTasks} automations. Cancel one first.`);
    if (input.mode !== "run" && input.grant) throw new TaskError("Only run automations can carry a spending allowance.");
    if (input.mode === "heartbeat" && input.trigger.kind !== "interval" && input.trigger.kind !== "calendar") throw new TaskError("A heartbeat needs a repeating schedule.");
    const now = this.clock();
    const trigger = triggerFromInput(input.trigger, now);
    const nextRunAt = trigger.kind === "price" ? now : nextOccurrence(trigger, now);
    if (nextRunAt === null) throw new TaskError("That schedule never runs.");
    return this.view(this.store.create({
      senderId: message.senderId, conversationId: message.conversationId, encodedEvent: message.encodedEvent,
      title: input.title, mode: input.mode, instruction: input.instruction, trigger, nextRunAt,
      grant: input.grant ? grantFromInput(input.grant) : null, createdAt: now,
    }));
  }

  /** Apply a change. Returns the updated view and a one-line confirmation. */
  act(senderId: string, action: TaskAction, actor: Actor): TaskChange {
    const task = this.store.get(senderId, action.code);
    if (!task || task.state === "cancelled") throw new TaskError(`No automation ${action.code.toUpperCase()} found.`);
    const now = this.clock();
    const done = (next: TaskRecord, message: string): TaskChange => ({ task: this.view(next), message });
    switch (action.kind) {
      case "pause":
        if (task.state !== "active") throw new TaskError(`${task.title} is not running.`);
        return done(this.store.update(task.id, { state: "paused" }, now), `Paused ${task.title}.`);
      case "resume": {
        if (task.state !== "paused") throw new TaskError(`${task.title} is not paused.`);
        const nextRunAt = task.trigger.kind === "price" ? now : nextOccurrence(task.trigger, now);
        if (nextRunAt === null) throw new TaskError(`${task.title} has no future run. Create a new automation.`);
        return done(this.store.update(task.id, { state: "active", nextRunAt }, now), `Resumed ${task.title}. Next: ${describeTime(nextRunAt)}.`);
      }
      case "cancel":
        return done(this.store.update(task.id, { state: "cancelled", nextRunAt: null, grant: task.grant ? { ...task.grant, state: "revoked" } : null }, now), `Deleted ${task.title}.`);
      case "run":
        if (task.state !== "active" && task.state !== "paused") throw new TaskError(`${task.title} has finished.`);
        return done(this.store.update(task.id, { state: "active", nextRunAt: now }, now), `${task.title} runs within a minute.`);
      case "allow": {
        if (actor !== "user") throw new TaskError("Only you can approve a spending allowance.");
        if (!task.grant) throw new TaskError(`${task.title} has no spending allowance to approve. Ask Pecu to add one.`);
        if (task.state === "completed") throw new TaskError(`${task.title} has finished.`);
        const scopes = action.scopes ?? task.grant.scopes;
        const maxUsdPerRun = action.maxUsd ?? task.grant.maxUsdPerRun;
        const grant = { ...task.grant, scopes, maxUsdPerRun, state: "approved" as const, approvedAt: now, expiresAt: now + task.grant.days * 86_400_000 };
        const yolo = this.chat.yoloEnabled(task.senderId, task.conversationId);
        return done(this.store.update(task.id, { grant }, now),
          `Approved: ${task.title} may execute ${scopeText(scopes)} up to $${maxUsdPerRun} per run until ${describeTime(grant.expiresAt)}.${yolo ? "" : " YOLO is off in its chat, so each transaction still waits for your confirmation."}`);
      }
      case "revoke":
        if (!task.grant || task.grant.state === "revoked") throw new TaskError(`${task.title} has no allowance to revoke.`);
        return done(this.store.update(task.id, { grant: { ...task.grant, state: "revoked" } }, now), `Revoked the spending allowance of ${task.title}. Its transactions now wait for your confirmation.`);
      default: {
        const _exhaustive: never = action.kind;
        throw new TaskError(`Unsupported action ${String(_exhaustive)}`);
      }
    }
  }

  /** Model-facing edit. Any change to what runs or what it may spend sends the allowance back for approval. */
  update(senderId: string, raw: TaskUpdateInput): TaskChange {
    const input = taskUpdateInputSchema.parse(raw);
    if (input.action !== "edit") {
      const kind = input.action === "run_now" ? "run" : input.action === "delete" ? "cancel" : input.action;
      return this.act(senderId, { code: input.code, kind }, "model");
    }
    const task = this.store.get(senderId, input.code);
    if (!task || task.state === "cancelled") throw new TaskError(`No automation ${input.code} found.`);
    if (task.state === "completed") throw new TaskError(`${task.title} has finished. Create a new automation.`);
    const mode = input.mode ?? task.mode;
    if (input.grant && input.remove_grant) throw new TaskError("Either replace the allowance or remove it, not both.");
    if (input.grant && mode !== "run") throw new TaskError("Only run automations can carry a spending allowance.");
    const now = this.clock();
    const trigger = input.trigger ? triggerFromInput(input.trigger, now) : task.trigger;
    if (mode === "heartbeat" && trigger.kind !== "interval" && trigger.kind !== "calendar") throw new TaskError("A heartbeat needs a repeating schedule.");
    const nextRunAt = input.trigger ? (trigger.kind === "price" ? now : nextOccurrence(trigger, now)) : task.nextRunAt;
    if (input.trigger && nextRunAt === null) throw new TaskError("That schedule never runs.");
    const changesWork = input.instruction !== undefined || input.mode !== undefined;
    const grant = input.remove_grant || mode !== "run" ? null
      : input.grant ? grantFromInput(input.grant)
      : task.grant && changesWork && task.grant.state === "approved" ? { ...task.grant, state: "requested" as const, approvedAt: null, expiresAt: null }
      : task.grant;
    const next = this.store.update(task.id, {
      title: input.title ?? task.title, mode, instruction: input.instruction ?? task.instruction, trigger,
      nextRunAt: task.state === "active" ? nextRunAt : task.nextRunAt, grant,
    }, now);
    const view = this.view(next);
    const when = view.state === "active" && view.nextRunAt && view.trigger.kind !== "price" ? ` Next: ${describeTime(view.nextRunAt)}.` : "";
    const allowance = grant?.state === "requested" ? " Its spending allowance needs your approval again." : task.grant && !grant ? " Its allowance was removed." : "";
    return { task: view, message: `Updated ${next.code} · ${next.title} · ${view.schedule}.${when}${allowance}` };
  }

  /** The automations as the model sees them: every field it needs to edit one precisely. */
  modelList(senderId: string, conversationId: string): string {
    const tasks = this.store.list(senderId).filter((task) => task.state !== "completed");
    if (!tasks.length) return "The user has no automations.";
    return JSON.stringify(tasks.map((task) => {
      const view = this.view(task);
      return {
        code: task.code, title: task.title, mode: task.mode, state: task.state, schedule: view.schedule,
        next_run: task.state === "active" && task.nextRunAt && task.trigger.kind !== "price" ? new Date(task.nextRunAt).toISOString() : null,
        instruction: task.instruction, allowance: view.grant ? this.grantLine(view) : null,
        chat: task.conversationId === conversationId ? "this chat" : "another chat", last_outcome: task.lastOutcome,
      };
    }));
  }

  /** Text for the /tasks commands, shared by X Chat and web. */
  command(senderId: string, command: TaskCommand): string {
    if (command.action === "list") return this.listText(senderId);
    const action: TaskAction = { code: command.code, kind: command.action };
    if (command.maxUsd !== undefined) action.maxUsd = command.maxUsd;
    try {
      return this.act(senderId, action, "user").message;
    } catch (error) {
      if (error instanceof TaskError) return error.message;
      throw error;
    }
  }

  listText(senderId: string): string {
    const tasks = this.list(senderId).filter((task) => task.state !== "completed");
    if (!tasks.length) return "No automations yet. Ask Pecu, for example: remind me to check AERO every Monday at 9:00.";
    return tasks.map((task) => [
      `${task.code} · ${task.title} · ${task.state === "paused" ? "paused" : task.schedule}`,
      ...(task.state === "active" && task.nextRunAt && task.trigger.kind !== "price" ? [`Next: ${describeTime(task.nextRunAt)}`] : []),
      ...(task.grant ? [this.grantLine(task)] : []),
    ].join("\n")).join("\n\n") + "\n\nManage: /tasks pause CODE, /tasks resume CODE, /tasks cancel CODE, /tasks run CODE, /tasks allow CODE [USD], /tasks revoke CODE";
  }

  grantLine(task: TaskView): string {
    const grant = task.grant!;
    const scope = scopeText(grant.scopes);
    if (grant.state === "requested") return `Allowance requested: ${scope} up to $${grant.maxUsdPerRun} per run. Approve with /tasks allow ${task.code}`;
    if (grant.state === "revoked") return "Allowance revoked";
    if (!grant.active) return "Allowance expired";
    return `Allowed: ${scope} up to $${grant.maxUsdPerRun} per run until ${describeTime(grant.expiresAt!)}${task.yolo ? "" : " (YOLO off: each transaction still asks)"}`;
  }

  /** Reply for a created task, used by the task tool. */
  createdText(task: TaskView): string {
    return [
      `Created ${task.code} · ${task.title} · ${task.schedule}.`,
      ...(task.nextRunAt && task.trigger.kind !== "price" ? [`First run: ${describeTime(task.nextRunAt)}.`] : []),
      ...(task.grant ? [`${this.grantLine(task)}, or approve it in the Pecu app.`] : []),
    ].join(" ");
  }
}
