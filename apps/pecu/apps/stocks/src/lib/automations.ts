import { useCallback, useEffect, useRef, useState } from "react";
import { taskActionResultSchema, taskActionSchema, taskListSchema, type TaskAction, type TaskView } from "../../../../src/task-contract";
import { errorText } from "./profile";
import { request } from "./use-account";

const modeLabel = { remind: "Reminder", run: "Runs Pecu", heartbeat: "Heartbeat" } as const;

export function automationMeta(task: TaskView, now = Date.now()): string {
  if (task.state === "paused") return `${modeLabel[task.mode]} · Paused`;
  if (task.state === "completed") return `${modeLabel[task.mode]} · Finished`;
  const next = task.nextRunAt && task.trigger.kind !== "price" ? ` · Next ${whenText(task.nextRunAt, now)}` : "";
  return `${modeLabel[task.mode]} · ${task.schedule}${next}`;
}

function whenText(at: number, now: number): string {
  const date = new Date(at);
  const sameDay = new Date(now).toDateString() === date.toDateString();
  return date.toLocaleString(undefined, sameDay ? { hour: "2-digit", minute: "2-digit" } : { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

const scopeText = (scopes: readonly string[]) => scopes.map((scope) => scope === "trade" ? "trades" : "liquidity changes").join(" and ");

/** One plain sentence about what the automation may execute without asking. */
export function allowanceText(task: TaskView): string | null {
  const grant = task.grant;
  if (!grant) return null;
  const limit = `${scopeText(grant.scopes)} up to $${grant.maxUsdPerRun} per run`;
  if (grant.state === "requested") return `Asks to execute ${limit}.`;
  if (grant.state === "revoked") return "Allowance revoked. Transactions wait for your confirmation.";
  if (!grant.active) return "Allowance expired. Transactions wait for your confirmation.";
  const until = grant.expiresAt ? new Date(grant.expiresAt).toLocaleDateString(undefined, { day: "numeric", month: "short" }) : "";
  return `Executes ${limit} until ${until}.${task.yolo ? "" : " YOLO is off in its chat, so each transaction still asks."}`;
}

export function useAutomations(open: boolean) {
  const [tasks, setTasks] = useState<TaskView[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const loading = useRef(false);
  const load = useCallback(async () => {
    if (loading.current) return;
    loading.current = true;
    try {
      setTasks(taskListSchema.parse(await request("tasks")).tasks);
      setError(null);
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      loading.current = false;
    }
  }, []);
  useEffect(() => { if (open) void load(); }, [open, load]);
  const act = useCallback(async (action: TaskAction) => {
    setBusy(`${action.code}:${action.kind}`);
    setError(null);
    try {
      const result = taskActionResultSchema.parse(await request("task-action", taskActionSchema.parse(action)));
      setTasks((current) => action.kind === "cancel"
        ? (current ?? []).filter((task) => task.code !== action.code)
        : (current ?? []).map((task) => task.code === action.code ? result.task : task));
      return result.message;
    } catch (cause) {
      setError(errorText(cause));
      return null;
    } finally {
      setBusy(null);
    }
  }, []);
  return { tasks, error, busy, load, act };
}
