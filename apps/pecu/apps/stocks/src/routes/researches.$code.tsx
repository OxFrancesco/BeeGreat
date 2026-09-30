import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeftIcon } from "lucide-react";
import { useState } from "react";
import type { ResearchAction, ResearchStageView } from "../../../../src/research-contract";
import { MessageResponse } from "@/components/ai-elements/message";
import { useResearchList } from "@/components/researches/research-shell";
import { Button } from "@/components/ui/button";
import { errorText } from "@/lib/profile";
import { researchAction, researchActive, researchPeriod, researchStateText, useResearch } from "@/lib/researches";

export const Route = createFileRoute("/researches/$code")({
  component: ResearchPage,
});

const stageText: Readonly<Record<ResearchStageView["state"], string>> = { pending: "Waiting", running: "Working", done: "Done", failed: "Did not finish", skipped: "Skipped" };

function ResearchPage() {
  const { code } = Route.useParams();
  const { refresh } = useResearchList();
  const navigate = useNavigate();
  const { detail, error, load } = useResearch(code.toUpperCase(), true);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const act = async (action: ResearchAction) => {
    setPending(true);
    setNotice(null);
    try {
      const result = await researchAction(action);
      await refresh();
      if (action.kind === "delete") void navigate({ to: "/researches" });
      else if (action.kind === "rerun" && result.research) void navigate({ to: "/researches/$code", params: { code: result.research.code } });
      else await load();
    } catch (cause) {
      setNotice(errorText(cause));
    } finally {
      setPending(false);
    }
  };
  if (error && !detail) {
    return (
      <div className="pecu-profile-body">
        <Link className="pecu-safe-org" to="/researches"><ArrowLeftIcon className="inline size-4" aria-hidden="true" /> Research</Link>
        <p className="pecu-automation-error" role="alert">{error}</p>
      </div>
    );
  }
  if (!detail) return <div className="pecu-profile-body"><p className="pecu-profile-note" role="status">Loading…</p></div>;
  const active = researchActive(detail);
  return (
    <div className="pecu-profile-body pecu-research">
      <div className="pecu-safe-head">
        <div className="pecu-safe-title">
          <Link className="pecu-safe-org" to="/researches">Research</Link>
          <h1>{detail.chain.name}, {researchPeriod(detail)}</h1>
          <p className="pecu-profile-note">{detail.window} · {researchStateText(detail)} · {detail.code}</p>
        </div>
        <div className="pecu-safe-actions">
          {active ? <Button className="pecu-button" variant="outline" disabled={pending} onClick={() => void act({ kind: "cancel", code: detail.code })}>Cancel</Button> : null}
          {!active ? <Button className="pecu-button" variant="outline" disabled={pending} onClick={() => void act({ kind: "rerun", code: detail.code })}>Run again</Button> : null}
          {!active ? (
            deleting ? (
              <span className="pecu-thread-confirm">
                <button className="pecu-thread-danger" disabled={pending} onClick={() => { setDeleting(false); void act({ kind: "delete", code: detail.code }); }} type="button">Delete</button>
                <button onClick={() => setDeleting(false)} type="button">Keep</button>
              </span>
            ) : <Button className="pecu-button" variant="ghost" disabled={pending} onClick={() => setDeleting(true)}>Delete</Button>
          ) : null}
        </div>
      </div>
      {notice ? <p className="pecu-automation-error" role="alert">{notice}</p> : null}
      {detail.error ? <p className="pecu-profile-notice">{detail.error}</p> : null}
      {detail.state !== "completed" ? (
        <ol className="pecu-research-stages" aria-live="polite">
          {detail.stages.map((stage) => (
            <li key={stage.role} data-state={stage.state}>
              <span className="pecu-research-stage-name">{stage.label}</span>
              <span className="pecu-research-stage-state">{stageText[stage.state]}{stage.calls ? ` · ${stage.calls} reads` : ""}</span>
              {stage.state === "failed" && stage.error ? <span className="pecu-research-stage-note">{stage.error}</span> : null}
            </li>
          ))}
        </ol>
      ) : null}
      {detail.markdown ? <MessageResponse className="pecu-research-report">{detail.markdown}</MessageResponse> : null}
    </div>
  );
}
