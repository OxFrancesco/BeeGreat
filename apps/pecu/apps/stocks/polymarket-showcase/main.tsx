import { useState } from "react";
import { createRoot } from "react-dom/client";
import { Copy, Check, ArrowRight } from "lucide-react";
import { Button } from "../src/components/ui/button";
import { AnalyticsCard } from "../src/components/analytics-card";
import { polymarketSections, polymarketShowcaseSchema } from "./schema";
import source from "./data.json";
import "../src/styles.css";
import "../showcase/style.css";
import "./style.css";

const collection = polymarketShowcaseSchema.parse(source);
const savedOn = new Date(collection.collectedAt).toLocaleDateString("en-US", { day: "numeric", month: "long", year: "numeric" });

function Showcase() {
  const [section, setSection] = useState<(typeof polymarketSections)[number]["id"]>("odds");
  const [chosen, setChosen] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const examples = collection.examples.filter((example) => example.section === section);
  const active = examples.find((example) => example.id === chosen) ?? examples[0];
  const choose = (id: string) => { setChosen(id); setCopied(false); setCopyError(false); };
  async function copy() {
    if (!active) return;
    try { await navigator.clipboard.writeText(active.question); setCopied(true); setCopyError(false); }
    catch { setCopyError(true); }
  }
  return <div className="pecu showcase">
    <a className="showcase-skip" href="#examples">Skip to examples</a>
    <header className="showcase-header"><a className="showcase-wordmark" href="/" aria-label="Pecu home">pecu</a><Button asChild className="pecu-button pecu-button-primary showcase-open"><a href="/agent">Open Pecu <ArrowRight aria-hidden="true" /></a></Button></header>
    <main>
      <h1>Polymarket showcase</h1>
      <p className="showcase-intro">Explore market odds, order books and the traders behind them. Examples use public Polymarket data saved on {savedOn}. Copy a prompt to get the live version from Pecu.</p>
      <div className="showcase-tabs pm-showcase-tabs" role="group" aria-label="Choose analysis">{polymarketSections.map((view) => <Button variant="ghost" key={view.id} type="button" aria-pressed={section === view.id} onClick={() => { setSection(view.id); choose(""); }}>{view.label}</Button>)}</div>
      <div className="showcase-workspace" id="examples">
        <nav className="showcase-picker" aria-label="Data examples">
          <label htmlFor="example-select">Example</label>
          <select id="example-select" value={active?.id ?? ""} onChange={(event) => choose(event.target.value)}>{examples.map((example) => <option key={example.id} value={example.id}>{example.name}</option>)}</select>
          <div className="showcase-example-list">{examples.map((example) => <button type="button" key={example.id} aria-pressed={active?.id === example.id} onClick={() => choose(example.id)}>{example.name}<span className="pm-showcase-detail">{example.detail}</span></button>)}</div>
        </nav>
        {active ? <article className="showcase-example" aria-label={active.name}>
          <div className="pm-showcase-cards">{active.snapshots.map((snapshot) => <AnalyticsCard key={`${active.id}:${snapshot.key}`} snapshot={snapshot} />)}</div>
          <div className="showcase-context">
            <div className="showcase-question"><p>{active.question}</p><button type="button" onClick={copy} aria-label={copied ? "Prompt copied" : "Copy prompt"}>{copied ? <Check size={18} /> : <Copy size={18} />}</button></div>
            {active.note ? <p className="showcase-note">{active.note}</p> : null}
            {copyError ? <p role="status">Could not copy. Select the question above to copy it.</p> : null}
          </div>
        </article> : <p role="status">Examples are being prepared.</p>}
      </div>
    </main>
  </div>;
}
const root = document.getElementById("root");
if (root) createRoot(root).render(<Showcase />);
