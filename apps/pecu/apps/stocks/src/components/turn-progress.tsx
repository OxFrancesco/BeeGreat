import { useEffect, useState } from "react";
import type { TurnStage } from "../../../../src/progress";

export function TurnProgress({ stages, pending }: { stages: readonly TurnStage[]; pending: boolean }) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (!pending) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [pending]);
  if (!stages.length) return pending ? <span role="status">Connecting…</span> : null;
  const running = stages.filter(stage => stage.status === "running");
  const seconds = (stage: TurnStage) => `${(Math.max(0, (stage.endedAt ?? now) - stage.startedAt) / 1000).toFixed(1)}s`;
  return <div className="text-sm text-muted-foreground">
    {pending && <p role="status">{running.length ? running.map(stage => `${stage.label} · ${seconds(stage)}`).join(" / ") : "Finishing response…"}</p>}
    <details><summary className="cursor-pointer">Timing</summary>
      <ul>{stages.map(stage => <li key={stage.id}>{stage.label} · {seconds(stage)}{stage.status === "error" ? " · failed" : ""}</li>)}</ul>
    </details>
  </div>;
}
