import { useState } from "react";
import { createRoot } from "react-dom/client";
import { Copy, Check, ArrowUpRight } from "lucide-react";
import { NansenChart } from "../src/components/nansen-charts";
import { showcaseSchema } from "./schema";
import source from "./data.json";
import "../src/styles.css";
import "./style.css";

const collection = showcaseSchema.parse(source);
const views = [{ kind: "flows", label: "Token flows" }, { kind: "pnl", label: "Trading P&L" }, { kind: "portfolio", label: "Portfolio exposure" }] as const;
function Showcase() {
  const [kind, setKind] = useState<(typeof views)[number]["kind"]>("flows");
  const [chosen, setChosen] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const examples = collection.examples.filter((example) => example.snapshot.kind === kind);
  const active = examples.find((example) => example.id === chosen) ?? examples[0];
  const choose = (id: string) => { setChosen(id); setCopied(false); setCopyError(false); };
  async function copy() {
    if (!active) return;
    try { await navigator.clipboard.writeText(active.question); setCopied(true); setCopyError(false); }
    catch { setCopyError(true); }
  }
  return <div className="pecu showcase">
    <a className="showcase-skip" href="#examples">Skip to examples</a>
    <header className="showcase-header"><a className="showcase-wordmark" href="/" aria-label="Pecu home">pecu</a><a className="pecu-button pecu-button-primary" href="/agent">Open Pecu <ArrowUpRight size={16} aria-hidden="true" /></a></header>
    <main>
      <h1>Nansen showcase</h1>
      <p className="showcase-intro">Explore token flows, trading results and portfolio exposure. {collection.source === "nansen" ? "Examples use saved Nansen data." : "These examples use fictional data. Ask Pecu to run the same analysis with Nansen data."}</p>
      <div className="showcase-tabs" role="group" aria-label="Choose analysis">{views.map((view) => <button key={view.kind} type="button" aria-pressed={kind === view.kind} onClick={() => { setKind(view.kind); choose(""); }}>{view.label}</button>)}</div>
      <div className={`showcase-workspace${examples.length > 1 ? "" : " showcase-single"}`} id="examples">
        {examples.length > 1 ? <nav className="showcase-picker" aria-label="Data examples">
          <label htmlFor="example-select">Example</label>
          <select id="example-select" value={active?.id ?? ""} onChange={(event) => choose(event.target.value)}>{examples.map((example) => <option key={example.id} value={example.id}>{example.name}</option>)}</select>
          <div className="showcase-example-list">{examples.map((example) => <button type="button" key={example.id} aria-pressed={active?.id === example.id} onClick={() => choose(example.id)}>{example.name}<span>{example.snapshot.chain === "all" ? "Across chains" : example.snapshot.chain}</span></button>)}</div>
        </nav> : null}
        {active ? <article className="showcase-example" aria-label={active.name}>
          <div className="showcase-context">
          <div className="showcase-question"><p>{active.question}</p><button type="button" onClick={copy} aria-label={copied ? "Prompt copied" : "Copy prompt"}>{copied ? <Check size={18} /> : <Copy size={18} />}</button></div>
          {active.note ? <p className="showcase-note">{active.note}</p> : null}
          {copyError ? <p role="status">Could not copy. Select the question above to copy it.</p> : null}
          </div>
          <NansenChart key={active.id} snapshot={active.snapshot} illustrative={collection.source === "illustrative"} />
        </article> : <p role="status">Examples are being prepared.</p>}
      </div>
    </main>
  </div>;
}
const root = document.getElementById("root");
if (root) createRoot(root).render(<Showcase />);
