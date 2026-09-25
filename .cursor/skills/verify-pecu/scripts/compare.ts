type Row = { id: string; status: "pass" | "fail" | "blocked" | "skipped"; evidence: string[] };
type Run = { scope: "full" | "partial"; rows: Row[] };

export function compare(baseline: Run, current: Run) {
  if (baseline.scope !== "full") throw new Error("Baseline must be the last full run; a partial run cannot establish complete regression coverage.");
  for (const run of [baseline, current]) {
    const ids = new Set<string>();
    for (const row of run.rows) {
      if (!row.id || ids.has(row.id) || !["pass", "fail", "blocked", "skipped"].includes(row.status) || !Array.isArray(row.evidence)) throw new Error("Invalid or duplicate result row");
      if (row.status === "pass" && row.evidence.length === 0) throw new Error(`Passing row lacks evidence: ${row.id}`);
      ids.add(row.id);
    }
  }
  const next = new Map(current.rows.map((row) => [row.id, row]));
  return baseline.rows.filter((row) => row.status === "pass" && next.get(row.id)?.status !== "pass")
    .map((row) => ({ id: row.id, before: "pass", after: next.get(row.id)?.status ?? "missing", evidence: next.get(row.id)?.evidence ?? [] }));
}

if (import.meta.main) {
  try {
    const [baselinePath, currentPath] = Bun.argv.slice(2);
    if (!baselinePath || !currentPath) throw new Error("Usage: bun compare.ts BASELINE_JSON CURRENT_JSON");
    const regressions = compare(await Bun.file(baselinePath).json(), await Bun.file(currentPath).json());
    console.log(JSON.stringify({ regressions }, null, 2));
    process.exitCode = regressions.length ? 1 : 0;
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Invalid results");
    process.exitCode = 2;
  }
}
