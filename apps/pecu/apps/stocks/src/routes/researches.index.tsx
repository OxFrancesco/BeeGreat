import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useId, useState } from "react";
import { researchWindows, type ResearchWindow } from "../../../../src/research-contract";
import { useResearchList } from "@/components/researches/research-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { errorText } from "@/lib/profile";
import { researchAction, researchPeriod, researchStateText } from "@/lib/researches";

export const Route = createFileRoute("/researches/")({
  component: ResearchHome,
});

function ResearchHome() {
  const { list, error, refresh } = useResearchList();
  const navigate = useNavigate();
  const chainsId = useId();
  const [chain, setChain] = useState("base");
  const [window, setWindow] = useState<ResearchWindow>("7d");
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const left = list ? Math.max(0, list.limit.daily - list.limit.used) : null;
  const start = async () => {
    setPending(true);
    setNotice(null);
    try {
      const result = await researchAction({ kind: "start", chain: chain.trim(), window });
      await refresh();
      if (result.research) void navigate({ to: "/researches/$code", params: { code: result.research.code } });
    } catch (cause) {
      setNotice(errorText(cause));
    } finally {
      setPending(false);
    }
  };
  return (
    <div className="pecu-profile-body">
      <div className="pecu-safe-title">
        <h1>Research</h1>
      </div>
      <form className="pecu-research-start" onSubmit={(event) => { event.preventDefault(); void start(); }}>
        <label className="pecu-research-field">
          <span>Chain</span>
          <Input list={chainsId} value={chain} onChange={(event) => setChain(event.currentTarget.value)} autoComplete="off" spellCheck={false} maxLength={60} required />
          <datalist id={chainsId}>
            {list?.chains.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
          </datalist>
        </label>
        <fieldset className="pecu-research-field">
          <legend>Window</legend>
          <div className="pecu-segmented">
            {researchWindows.map((option) => (
              <button key={option} type="button" aria-pressed={window === option} onClick={() => setWindow(option)}>{option}</button>
            ))}
          </div>
        </fieldset>
        <div className="pecu-research-submit">
          <Button className="pecu-button pecu-button-primary" type="submit" disabled={pending || !chain.trim() || left === 0}>{pending ? "Starting…" : "Start research"}</Button>
          {left !== null ? <p className="pecu-profile-note">{left === 0 ? "No runs left today. The limit resets at 00:00 UTC." : `${left} of ${list!.limit.daily} runs left today`}</p> : null}
        </div>
      </form>
      {notice ? <p className="pecu-automation-error" role="alert">{notice}</p> : null}
      {error && !list ? <p className="pecu-automation-error" role="alert">{error}</p> : null}
      {list === null && !error ? <p className="pecu-profile-note" role="status">Loading…</p> : null}
      {list?.researches.length === 0 ? <p className="pecu-profile-empty">No research yet. You can also send @research base in any chat.</p> : null}
      {list?.researches.length ? (
        <ul className="pecu-research-list">
          {list.researches.map((research) => (
            <li key={research.code}>
              <Link className="pecu-research-row" to="/researches/$code" params={{ code: research.code }}>
                <span className="pecu-research-row-head">
                  <span className="pecu-research-row-title">{research.chain.name} · {researchPeriod(research)}</span>
                  <span className="pecu-profile-link-meta">{research.window} · {researchStateText(research)}</span>
                </span>
                {research.headline ? <span className="pecu-research-row-headline">{research.headline}</span> : research.error ? <span className="pecu-research-row-headline">{research.error}</span> : null}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
