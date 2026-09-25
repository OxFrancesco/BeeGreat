import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { benchmark } from './worker.mjs';

const [providerFile, outputDirectory, remoteUrl, authFile] = process.argv.slice(2);
if (!providerFile || !outputDirectory) throw new Error('Usage: bun run.mjs PROVIDERS_JSON OUTPUT_DIRECTORY [WORKER_URL TOKEN_FILE]');
const providers = JSON.parse(await readFile(providerFile, 'utf8'));
const auth = authFile ? (await readFile(authFile, 'utf8')).trim() : undefined;
await mkdir(outputDirectory, { recursive: true });
const runs = [];
for (let round = 0; round < 3; round++) {
  for (const operation of ['block', 'balance', 'contract', 'logs', 'simulation', 'concurrent', 'aero-pools']) {
    let run;
    if (remoteUrl) {
      const response = await fetch(remoteUrl, {
        method: 'POST', headers: { authorization: `Bearer ${auth}`, 'content-type': 'application/json' },
        body: JSON.stringify({ providers, operation }), signal: AbortSignal.timeout(240_000),
      });
      if (!response.ok) throw new Error(`Benchmark worker returned ${response.status}`);
      run = await response.json();
    } else run = { runtime: 'local-bun', ...await benchmark(providers, operation) };
    if (!Array.isArray(run.rows) || run.rows.length !== 20) throw new Error('Benchmark did not return all samples');
    runs.push({ round, ...run });
    await writeFile(`${outputDirectory}/samples.json`, JSON.stringify(runs, null, 2));
    console.log(JSON.stringify({ round, operation, colo: run.colo, errors: run.rows.filter(row => !row.ok).length, consistent: run.consistent }));
  }
}
const rows = runs.flatMap(run => run.rows);
const summary = [];
for (const operation of new Set(rows.map(row => row.operation))) {
  for (const provider of ['alchemy', 'chainstack']) {
    const group = rows.filter(row => row.operation === operation && row.provider === provider);
    const times = group.filter(row => row.ok).map(row => row.ms).sort((a, b) => a - b);
    const percentile = (p) => times.length ? Math.round(times[Math.ceil(p * times.length) - 1] * 10) / 10 : null;
    summary.push({ operation, provider, count: group.length, errors: group.filter(row => !row.ok).length, p50: percentile(.5), p95: percentile(.95) });
  }
}
await writeFile(`${outputDirectory}/summary.json`, JSON.stringify(summary, null, 2));
console.table(summary);
if (summary.some(row => row.errors > 0) || runs.some(run => run.consistent === false)) process.exitCode = 1;
