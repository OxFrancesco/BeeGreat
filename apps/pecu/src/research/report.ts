import { metricDefinitions, type MetricKey, type MetricSummary, type Mover, type ResearchPack } from "../integrations/chain-data";
import type { Evidence, Findings, ResearchReport, ResearchRole } from "../research-contract";
import { roleLabel } from "./agents";

const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** 21 Sep 2026, from an ISO date. */
export function prettyDate(iso: string, year = true): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${monthNames[(m ?? 1) - 1]}${year ? ` ${y}` : ""}`;
}

/** 21–27 Sep 2026, or 31 Aug–29 Sep 2026. */
export function prettyRange(start: string, end: string): string {
  if (start === end) return prettyDate(end);
  const sameYear = start.slice(0, 4) === end.slice(0, 4);
  const sameMonth = sameYear && start.slice(5, 7) === end.slice(5, 7);
  return `${sameMonth ? String(Number(start.slice(8))) : prettyDate(start, !sameYear)}–${prettyDate(end)}`;
}

function scaled(value: number, unit: "usd" | "count"): string {
  const abs = Math.abs(value);
  const prefix = unit === "usd" ? "$" : "";
  if (abs >= 1e9) return `${prefix}${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${prefix}${(abs / 1e6).toFixed(abs >= 1e8 ? 0 : abs >= 1e7 ? 1 : 2)}M`;
  if (abs >= 1e4) return `${prefix}${(abs / 1e3).toFixed(1)}K`;
  if (unit === "usd" && abs < 1) return `${prefix}${abs.toPrecision(3)}`;
  return `${prefix}${abs.toLocaleString("en-US", { maximumFractionDigits: unit === "usd" ? 2 : 0 })}`;
}

export function amount(value: number | null, unit: "usd" | "count" = "usd"): string {
  return value === null ? "unavailable" : `${value < 0 ? "-" : ""}${scaled(value, unit)}`;
}

export function signed(value: number | null, unit: "usd" | "count" = "usd"): string {
  return value === null ? "unavailable" : `${value < 0 ? "-" : "+"}${scaled(value, unit)}`;
}

export function percent(value: number | null): string {
  return value === null ? "n/a" : `${value < 0 ? "-" : "+"}${Math.abs(value).toFixed(Math.abs(value) >= 100 ? 0 : 1)}%`;
}

function measure(metric: MetricSummary): string {
  return metric.kind === "level" ? "on the last day" : metric.kind === "flow" ? "over the window" : "daily average";
}

function moverLine(row: Mover, unit: "usd" | "count" = "usd"): string {
  return `${row.name}${row.category ? ` [${row.category}]` : ""}${row.doublecounted ? " [double counted]" : ""} ${amount(row.current, unit)} (${signed(row.change, unit)}, ${percent(row.changePct)}${row.share != null ? `, ${row.share.toFixed(1)}% share` : ""})`;
}

/** The pack as compact text for research prompts: every number the agents may reuse, and nothing decorative. */
export function packBrief(pack: ResearchPack): string {
  const { period } = pack;
  const lines: string[] = [
    `Evidence pack for ${pack.chain.name}, ${period.start} to ${period.end} (${pack.window}, UTC), against ${period.priorStart} to ${period.priorEnd}. Generated ${pack.generatedAt}.`,
    "",
    "Headline metrics:",
    ...pack.metrics.map((metric) => `- ${metric.label}: ${amount(metric.current, metric.unit)} ${measure(metric)}, ${signed(metric.change, metric.unit)} (${percent(metric.changePct)}) against ${metric.kind === "level" ? period.priorEnd : "the prior window"}; the prior window's own change was ${signed(metric.priorChange, metric.unit)} (${percent(metric.priorChangePct)}).${metric.missing.length ? ` Missing days: ${metric.missing.join(", ")}.` : ""}`),
    "",
    "Daily values (prior window then window):",
    ...pack.metrics.map((metric) => `- ${metric.label}: ${metric.daily.map(([date, value]) => `${date.slice(5)} ${value === null ? "n/a" : amount(value, metric.unit)}`).join(", ")}`),
  ];
  if (pack.eventDays.length) lines.push("", "Event days (largest single-day moves):", ...pack.eventDays.map((event) => `- ${event.date} ${event.label} ${amount(event.value, pack.metrics.find((metric) => metric.key === event.metric)?.unit ?? "usd")}, ${signed(event.change, pack.metrics.find((metric) => metric.key === event.metric)?.unit ?? "usd")} (${percent(event.changePct)}) ${event.basis}`));
  if (pack.prices.length) lines.push("", `Prices, ${period.priorEnd} to ${period.end}:`, ...pack.prices.map((price) => `- ${price.symbol} (${price.coin}): ${price.start === null ? "n/a" : `$${price.start.toPrecision(5)}`} to ${price.end === null ? "n/a" : `$${price.end.toPrecision(5)}`} (${percent(price.changePct)})`));
  if (pack.tvlMovers.up.length || pack.tvlMovers.down.length) lines.push("", `Protocol TVL movers. ${pack.tvlMovers.basis} ${pack.tvlMovers.ranked} protocols ranked.`, "Up:", ...pack.tvlMovers.up.map((row) => `- ${moverLine(row)}`), "Down:", ...pack.tvlMovers.down.map((row) => `- ${moverLine(row)}`));
  for (const [label, movers] of [["DEX volume by protocol", pack.dexMovers], ["App fees by protocol", pack.feeMovers], ["App revenue by protocol", pack.revenueMovers]] as const) {
    if (movers.rows.length) lines.push("", `${label}. ${movers.basis} Chain total ${amount(movers.total)}.`, ...movers.rows.map((row) => `- ${moverLine(row)}`));
  }
  if (pack.stablecoins.rows.length) lines.push("", `Stablecoins by issuer. ${pack.stablecoins.basis}`, ...pack.stablecoins.rows.map((row) => `- ${moverLine(row)}`));
  if (pack.leads.length) lines.push("", "Leads (DefiLlama profiles of the biggest movers):", ...pack.leads.map((lead) => `- ${lead.name}: slug ${lead.slug}${lead.twitter ? `, X @${lead.twitter}` : ""}${lead.url ? `, ${lead.url}` : ""}${lead.events.length ? `, events: ${lead.events.map((event) => `${event.date} ${event.note}`).join("; ")}` : ""}`));
  if (pack.notes.length) lines.push("", "Coverage notes:", ...pack.notes.map((note) => `- ${note}`));
  lines.push("", "Sources:", ...pack.sources.map((source) => `- ${source.label}: ${source.url}`));
  return lines.join("\n");
}

function evidenceLine(evidence: readonly Evidence[]): string {
  return evidence.map((item) => item.url ? `[${item.label}](${item.url})` : item.label).join(" · ");
}

const table = (header: readonly string[], rows: readonly (readonly string[])[]) =>
  [`| ${header.join(" | ")} |`, `| ${header.map((_, index) => index === 0 ? "---" : "---:").join(" | ")} |`, ...rows.map((row) => `| ${row.join(" | ")} |`)].join("\n");

function moverTable(rows: readonly Mover[]): string {
  return table(["Protocol", "Now", "Change", "Change %"], rows.map((row) => [`${row.name}${row.category ? ` (${row.category})` : ""}${row.doublecounted ? ", double counted" : ""}`, amount(row.current), signed(row.change), percent(row.changePct)]));
}

export type ReportInput = Readonly<{
  code: string;
  pack: ResearchPack;
  report: ResearchReport | null;
  findings: Readonly<Partial<Record<ResearchRole, Findings>>>;
  missing: readonly ResearchRole[];
}>;

/** The full report as Markdown. Numbers in tables come from the pack; causes, timeline and actors from the editor. */
export function renderMarkdown({ code, pack, report, findings, missing }: ReportInput): string {
  const { period } = pack;
  const out: string[] = [`# ${pack.chain.name}, ${prettyRange(period.start, period.end)}`];
  if (report) out.push("", `**${report.headline}**`, "", report.summary);
  out.push("", "## What moved", "", table(["Metric", "Now", "Change", "Change %", "Prior window change"], pack.metrics.map((metric) => [
    `${metric.label} (${measure(metric)})`, amount(metric.current, metric.unit), signed(metric.change, metric.unit), percent(metric.changePct), `${signed(metric.priorChange, metric.unit)} (${percent(metric.priorChangePct)})`,
  ])));
  if (pack.prices.length) out.push("", `Prices ${prettyRange(period.priorEnd, period.end)}: ${pack.prices.map((price) => `${price.symbol} ${percent(price.changePct)}`).join(", ")}.`);
  if (report) {
    out.push("", "## Why it moved");
    report.causes.forEach((cause, index) => {
      out.push("", `### ${index + 1}. ${cause.movement}`, "", `Confidence: ${cause.confidence}${cause.explains ? ` · Explains: ${cause.explains}` : ""}`, "", cause.mechanism);
      if (cause.catalyst) out.push("", `Catalyst: ${cause.catalyst}`);
      out.push("", ...cause.drivers.map((driver) => `- ${driver}`), "", `Evidence: ${evidenceLine(cause.evidence)}`);
    });
    if (report.timeline.length) out.push("", "## Timeline", "", ...report.timeline.map((entry) => `- ${entry.date} · ${entry.url ? `[${entry.title}](${entry.url})` : entry.title}${entry.detail ? `. ${entry.detail}` : ""}`));
    if (report.actors.length) out.push("", "## Who moved it", "", ...report.actors.map((actor) => `- ${actor.name}: ${actor.role}`));
  }
  if (pack.eventDays.length) out.push("", "## Event days", "", table(["Day", "Metric", "Value", "Move", "Basis"], pack.eventDays.map((event) => {
    const unit = pack.metrics.find((metric) => metric.key === event.metric)?.unit ?? "usd";
    return [event.date, event.label, amount(event.value, unit), `${signed(event.change, unit)} (${percent(event.changePct)})`, event.basis];
  })));
  if (pack.tvlMovers.up.length || pack.tvlMovers.down.length) out.push("", "## Protocol TVL", "", pack.tvlMovers.basis, "", "Largest increases", "", moverTable(pack.tvlMovers.up), "", "Largest decreases", "", moverTable(pack.tvlMovers.down));
  for (const [label, movers] of [["DEX volume by protocol", pack.dexMovers], ["App fees by protocol", pack.feeMovers], ["App revenue by protocol", pack.revenueMovers]] as const) {
    if (movers.rows.length) out.push("", `## ${label}`, "", `${movers.basis} Chain total ${amount(movers.total)}.`, "", table(["Protocol", "Window", "Change", "Change %", "Share"], movers.rows.map((row) => [row.name, amount(row.current), signed(row.change), percent(row.changePct), row.share == null ? "n/a" : `${row.share.toFixed(1)}%`])));
  }
  if (pack.stablecoins.rows.length) out.push("", "## Stablecoins by issuer", "", pack.stablecoins.basis, "", table(["Stablecoin", "Supply", "Change", "Change %"], pack.stablecoins.rows.map((row) => [row.name, amount(row.current), signed(row.change), percent(row.changePct)])));
  if (report?.unexplained.length) out.push("", "## Unexplained", "", ...report.unexplained.map((item) => `- ${item}`));
  if (report?.watch.length) out.push("", "## Watch next", "", ...report.watch.map((item) => `- ${item}`));
  const specialists = Object.entries(findings).filter((entry): entry is [ResearchRole, Findings] => entry[1] !== undefined);
  if (specialists.length) {
    out.push("", "## Specialist notes");
    for (const [role, result] of specialists) {
      out.push("", `### ${roleLabel(role)}`, "", result.summary);
      for (const finding of result.findings) out.push("", `- **${finding.title}** (${finding.confidence}${finding.date ? `, ${finding.date}` : ""}). ${finding.detail} Evidence: ${evidenceLine(finding.evidence)}`);
      if (result.gaps.length) out.push("", `Gaps: ${result.gaps.join(" ")}`);
    }
  }
  const notes = [...pack.notes, ...missing.map((role) => `The ${roleLabel(role).toLowerCase()} specialist did not finish, so its sources are missing from this report.`)];
  out.push("", "## Method and sources", "", `Window ${period.start} to ${period.end} (complete UTC days) against ${period.priorStart} to ${period.priorEnd}. Levels compare the last day with ${period.priorEnd}; flows compare window sums; averages compare daily means. Protocol tables use DefiLlama's rolling readings at ${pack.generatedAt.slice(0, 16).replace("T", " ")} UTC. Research ${code}.`);
  if (notes.length) out.push("", ...notes.map((note) => `- ${note}`));
  out.push("", ...pack.sources.map((source) => `- [${source.label}](${source.url})`));
  if (usesNansen(findings)) out.push("", nansenAttribution);
  return out.join("\n");
}

/** Nansen's terms require this line under anything built from its data; the flows specialist is the only Nansen reader. */
export const nansenAttribution = "Data: Nansen (nansen.ai)";
export const usesNansen = (findings: Partial<Record<ResearchRole, Findings>>) => Boolean(findings.flows?.findings.length);

/** What Pecu posts in chat when a run finishes. X Chat shows it as plain text. */
export function completionText(input: Readonly<{ code: string; pack: ResearchPack; report: ResearchReport | null; link: string; nansen?: boolean }>): string {
  const { pack, report } = input;
  const title = `${pack.chain.name} research, ${prettyRange(pack.period.start, pack.period.end)}`;
  if (!report) return `${title} is ready, without the editor's summary.\n\n${input.link}`;
  const causes = report.causes.slice(0, 3).map((cause, index) => `${index + 1}. ${cause.movement}: ${cause.mechanism.split(/(?<=\.)\s/)[0]} (${cause.confidence})`);
  return [title, "", report.headline, "", report.summary, "", ...causes, "", `Full report: ${input.link}`, ...(input.nansen ? ["", nansenAttribution] : [])].join("\n");
}

const sourceLabels = {
  tvl: "DeFi TVL (USD)", stablecoins: "USD-pegged stablecoin supply (USD)", dex_volume: "DEX volume (USD)",
  app_fees: "App fees (USD)", app_revenue: "App revenue (USD)", transactions: "Transactions (count)",
  active_addresses: "Active addresses (count)", onchain_fees: "Onchain fees paid (USD)", median_tx_cost: "Median tx fee (USD)",
} satisfies Record<MetricKey, string>;

const fixed = (value: number, key: string) => key === "median_tx_cost" ? value.toFixed(12) : key === "transactions" || key === "active_addresses" ? String(Math.round(value)) : value.toFixed(2);
const signedFixed = (value: number, key: string) => `${value >= 0 ? "+" : ""}${fixed(value, key)}`;
const signedPct = (value: number | null) => value === null ? "" : `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;

/**
 * The pack in OnChain-Reports' source format, so dither-reports can build a
 * deck from it: preamble, Summary, one daily table per metric, then movers.
 * Flow metrics sum daily values; levels compare the last day with the day
 * before the window.
 */
export function renderSourceMarkdown(code: string, pack: ResearchPack): string {
  const { period, chain } = pack;
  const days = period.days;
  const flowKeys = pack.metrics.filter((metric) => metric.kind !== "level" && metric.key !== "median_tx_cost");
  const out: string[] = [
    `# ${chain.name} ecosystem, ${days} ${days === 1 ? "day" : "days"} to ${prettyDate(period.end)}`,
    "",
    `Window: ${prettyDate(period.start)} through ${prettyDate(period.end)} inclusive (UTC dates).`,
    `Prior ${days} ${days === 1 ? "day" : "days"}: ${prettyDate(period.priorStart)} through ${prettyDate(period.priorEnd)} inclusive (UTC dates).`,
    `Generated: ${prettyDate(pack.generatedAt.slice(0, 10))} (UTC) by Pecu research ${code}.`,
    `Sources: DefiLlama (api.llama.fi, stablecoins.llama.fi)${chain.growthepie ? " and growthepie (api.growthepie.com)" : ""}. Public read-only endpoints; no login.`,
    "",
    "USD amounts below are the API values rounded to 2 decimal places. Median tx fee is rounded to 12 decimal places. Counts are integers when the API value is a whole number. Percent changes use the unrounded values and are shown to 2 decimal places. A blank cell means that day was not in the source.",
    "",
    "## Summary",
    "",
    `Latest value is the daily reading on ${period.end}.`,
    `For DeFi TVL, USD-pegged stablecoin supply, and median tx fee, ${days}-day change is ${period.end} versus ${period.priorEnd}.`,
    `For the other metrics, ${days}-day change is the sum of daily values on ${prettyRange(period.start, period.end)} versus the sum on ${prettyRange(period.priorStart, period.priorEnd)}. Active-address sums add daily active addresses; they are not unique addresses.`,
    "",
    `| Metric | Latest (${period.end}) | ${days}-day change | Prior ${days}-day change |`,
    "| --- | ---: | ---: | ---: |",
  ];
  const sums = new Map<string, { current: number; prior: number }>();
  for (const metric of pack.metrics) {
    const label = sourceLabels[metric.key]!;
    const values = new Map(metric.daily);
    const latest = values.get(period.end) ?? null;
    let change: string;
    let prior: string;
    if (metric.kind === "level" || metric.key === "median_tx_cost") {
      // From the printed readings, so the parser's check holds at the printed precision.
      const base = values.get(period.priorEnd) ?? null;
      const [end, start] = [latest, base].map((value) => value === null ? null : Number(fixed(value, metric.key)));
      change = end != null && start != null ? `${signedFixed(Number(fixed(end - start, metric.key)), metric.key)} (${signedPct(start ? (end / start - 1) * 100 : null)})` : "";
      prior = metric.priorChange !== null ? `${signedFixed(metric.priorChange, metric.key)} (${signedPct(metric.priorChangePct)})` : "";
    } else {
      const total = (from: string, to: string) => metric.daily.filter(([date]) => date >= from && date <= to).reduce((sum, [, value]) => sum + (value ?? 0), 0);
      const current = total(period.start, period.end);
      const before = total(period.priorStart, period.priorEnd);
      sums.set(metric.key, { current, prior: before });
      change = `${signedFixed(current - before, metric.key)} (${signedPct(before ? (current / before - 1) * 100 : null)})`;
      const older = metric.kind === "flow" ? metric.priorChange : metric.priorChange === null ? null : metric.priorChange * days;
      prior = older !== null ? `${signedFixed(older, metric.key)} (${signedPct(metric.priorChangePct)})` : "";
    }
    out.push(`| ${label} | ${latest === null ? "" : fixed(latest, metric.key)} | ${change} | ${prior} |`);
  }
  if (flowKeys.length) out.push("", `Versus ${prettyRange(period.priorStart, period.priorEnd)}: ${flowKeys.map((metric) => {
    const sum = sums.get(metric.key)!;
    return `${sourceLabels[metric.key]} ${fixed(sum.current, metric.key)} vs ${fixed(sum.prior, metric.key)} (${signedPct(sum.prior ? (sum.current / sum.prior - 1) * 100 : null)})`;
  }).join("; ")}.`);
  for (const metric of pack.metrics) {
    const unit = metric.unit === "usd" ? "USD" : "count";
    out.push("", `## ${sourceLabels[metric.key]}`, "", `| Date (UTC) | Value (${unit}) |`, "| --- | ---: |", ...metric.daily.filter(([date]) => date >= period.priorEnd).map(([date, value]) => `| ${date} | ${value === null ? "" : fixed(value, metric.key)} |`));
    out.push("", metric.missing.length ? `Missing days: ${metric.missing.join(", ")}.` : `No missing days in ${prettyRange(period.start, period.end)}.`, "", `Source: ${metricDefinitions[metric.key].provider}, ${metric.source}.`);
  }
  // Change comes from the rounded readings, so the parser's end-minus-start check holds to the cent.
  const moverRows = (rows: readonly Mover[]) => rows.filter((row) => !row.doublecounted).map((row) => {
    const [start, end] = [Math.round(row.prior * 100) / 100, Math.round(row.current * 100) / 100];
    return `| ${row.name} | ${start.toFixed(2)} | ${end.toFixed(2)} | ${signedFixed(Math.round((end - start) * 100) / 100, "tvl")} | ${signedPct(start ? (end / start - 1) * 100 : null)} |`;
  });
  out.push(
    "", "## Top TVL movers", "",
    `${pack.tvlMovers.basis} Start is the previous reading, end is the current reading at ${pack.generatedAt.slice(0, 16).replace("T", " ")} UTC.`,
    "", `Ranked by USD change among ${pack.tvlMovers.ranked} protocols.`,
    "", "### Largest increases", "", "| Protocol | Start TVL (USD) | End TVL (USD) | Change (USD) | Change (%) |", "| --- | ---: | ---: | ---: | ---: |", ...moverRows(pack.tvlMovers.up),
    "", "### Largest decreases", "", "| Protocol | Start TVL (USD) | End TVL (USD) | Change (USD) | Change (%) |", "| --- | ---: | ---: | ---: | ---: |", ...moverRows(pack.tvlMovers.down),
    "", "### Not ranked (missing day)", "", "| Protocol | Start TVL (USD) | End TVL (USD) | Change (USD) |", "| --- | ---: | ---: | ---: |",
    "", `Source: DefiLlama https://api.llama.fi/lite/protocols2?b=2 (chainTvls.${chain.defillama}).`,
  );
  return out.join("\n");
}
