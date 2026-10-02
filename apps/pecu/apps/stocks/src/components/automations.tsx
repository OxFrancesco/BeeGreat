import { CalendarClockIcon } from "lucide-react";
import { useState } from "react";
import type { GrantScope, TaskAction, TaskView } from "../../../../src/task-contract";
import { allowanceText, automationMeta, useAutomations } from "../lib/automations";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";

export function Automations({ onOpenThread }: { onOpenThread: (threadId: string | null) => void }) {
  const [open, setOpen] = useState(false);
  const { tasks, error, busy, act } = useAutomations(open);
  const [notice, setNotice] = useState<string | null>(null);
  const run = async (action: Parameters<typeof act>[0]) => {
    const message = await act(action);
    if (message) setNotice(message);
  };
  return (
    <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (!next) setNotice(null); }}>
      <DialogTrigger asChild>
        <button aria-label="Automations" className="pecu-chip pecu-automations-toggle" type="button">
          <CalendarClockIcon className="size-4" />
          <span>Automations</span>
        </button>
      </DialogTrigger>
      <DialogContent animate={false} className="pecu pecu-threads-dialog pecu-automations-dialog">
        <DialogHeader>
          <DialogTitle>Automations</DialogTitle>
          <DialogDescription>Reminders, schedules, heartbeats and price alerts you set up in chat.</DialogDescription>
        </DialogHeader>
        {error ? <p className="pecu-automation-error" role="alert">{error}</p> : null}
        <p className="sr-only" role="status">{notice ?? ""}</p>
        {tasks === null && !error ? <p className="pecu-thread-meta" role="status">Loading…</p> : null}
        {tasks?.length === 0 ? (
          <p className="pecu-thread-meta">None yet. Ask Pecu, for example: remind me every Monday at 9:00 to check AERO.</p>
        ) : null}
        {tasks?.length ? (
          <ul className="pecu-automation-list">
            {tasks.map((task) => (
              <AutomationRow key={task.code} task={task} busy={busy} onAct={run} onOpen={() => { setOpen(false); onOpenThread(task.threadId); }} />
            ))}
          </ul>
        ) : null}
        {notice ? <p className="pecu-automation-notice">{notice}</p> : null}
      </DialogContent>
    </Dialog>
  );
}

export function AutomationRow({ task, busy, onAct, onOpen }: {
  task: TaskView;
  busy: string | null;
  onAct: (action: TaskAction) => Promise<void>;
  onOpen: () => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const [limit, setLimit] = useState(String(task.grant?.maxUsdPerRun ?? ""));
  const [scopes, setScopes] = useState<GrantScope[]>(task.grant?.scopes ?? []);
  const [days, setDays] = useState(String(task.grant?.days ?? 30));
  const validDays = Number.isInteger(Number(days)) && Number(days) >= 1 && Number(days) <= 90;
  const pending = busy?.startsWith(`${task.code}:`) ?? false;
  const allowance = allowanceText(task);
  const grant = task.grant;
  const needsApproval = task.mode === "run" && (!grant || grant.state !== "approved" || !grant.active) && task.state !== "completed";
  const unfinished = task.run && ["running", "retrying", "awaiting_approval", "confirming"].includes(task.run.state);
  const cap = Number(limit);
  const validCap = Number.isFinite(cap) && cap > 0 && cap <= 10_000;
  return (
    <li className="pecu-automation" aria-busy={pending}>
      <div className="pecu-automation-head">
        {task.channel === "web" ? (
          <button className="pecu-automation-title" onClick={onOpen} type="button">{task.title}</button>
        ) : (
          <span className="pecu-automation-title">{task.title}</span>
        )}
        <span className="pecu-thread-meta">{automationMeta(task)}{task.channel === "x" ? " · X Chat" : ""}</span>
      </div>
      <p className="pecu-automation-instruction">{task.instruction}</p>
      {task.run ? <div role="status"><p className="pecu-thread-meta">{{ running: "Running", retrying: "Recovering", awaiting_approval: "Waiting for approval", confirming: "Confirming transaction", done: "Finished", failed: "Stopped" }[task.run.state]}</p>{task.run.steps.map((step, index) => <p className="pecu-thread-meta" key={index}>{step.title} · {step.state}</p>)}{task.run.summary ? <p className="pecu-automation-instruction">{task.run.summary}</p> : null}</div> : task.lastOutcome ? <p className="pecu-automation-instruction">{task.lastOutcome}</p> : null}
      {allowance ? <p className={needsApproval ? "pecu-automation-allowance is-pending" : "pecu-automation-allowance"}>{allowance}</p> : null}
      {needsApproval ? (
        <div className="pecu-automation-approve">
          <fieldset disabled={pending}><legend>Allow unattended actions</legend>{(["liquidity", "trade"] as const).map(scope => <label key={scope}><input type="checkbox" checked={scopes.includes(scope)} onChange={event => setScopes(current => event.target.checked ? [...current, scope] : current.filter(value => value !== scope))} />{scope === "trade" ? "Swap rewards and other trades" : "Claim rewards and change liquidity"}</label>)}</fieldset>
          <label><span>Valid for days</span><input type="number" min="1" max="90" value={days} onChange={event => setDays(event.target.value)} /></label>
          <label>
            <span>Limit per run, USD</span>
            <input inputMode="decimal" value={limit} onChange={(event) => setLimit(event.currentTarget.value)} aria-invalid={!validCap} />
          </label>
          <Button className="pecu-button pecu-button-primary" disabled={pending || !validCap || !validDays || !scopes.length} onClick={() => void onAct({ code: task.code, kind: "allow", maxUsd: cap, scopes, days: Number(days) })}>Approve</Button>
        </div>
      ) : null}
      <div className="pecu-automation-actions">
        {task.state === "active" ? <Button variant="ghost" size="sm" disabled={pending} onClick={() => void onAct({ code: task.code, kind: "pause" })}>Pause</Button> : null}
        {task.state === "paused" ? <Button variant="ghost" size="sm" disabled={pending} onClick={() => void onAct({ code: task.code, kind: "resume" })}>Resume</Button> : null}
        {task.state !== "completed" && task.trigger.kind !== "price" ? <Button variant="ghost" size="sm" disabled={pending || Boolean(unfinished)} onClick={() => void onAct({ code: task.code, kind: "run" })}>Run now</Button> : null}
        {grant?.state === "approved" && grant.active ? <Button variant="ghost" size="sm" disabled={pending} onClick={() => void onAct({ code: task.code, kind: "revoke" })}>Revoke allowance</Button> : null}
        {deleting ? (
          <span className="pecu-thread-confirm">
            <button className="pecu-thread-danger" disabled={pending} onClick={() => { setDeleting(false); void onAct({ code: task.code, kind: "cancel" }); }} type="button">Delete</button>
            <button onClick={() => setDeleting(false)} type="button">Keep</button>
          </span>
        ) : (
          <Button variant="ghost" size="sm" disabled={pending} onClick={() => setDeleting(true)}>Delete</Button>
        )}
      </div>
    </li>
  );
}
