import { z } from "zod";

const sampleSchema = z.object({ label: z.string(), completedMs: z.number(), headersMs: z.number(), outcome: z.string(), frames: z.array(z.object({ at: z.number(), type: z.string(), traceId: z.string().optional(), stage: z.object({ id: z.string(), label: z.string(), startedAt: z.number(), endedAt: z.number().optional(), status: z.string() }).optional() })) });
const files = Bun.argv.slice(2);
if (!files.length) throw new Error("Usage: bun scripts/summarize-benchmark.ts samples.json [...]");
const samples = (await Promise.all(files.map(async file => z.array(sampleSchema).parse(await Bun.file(file).json())))).flat();
const distribution = (values: number[]) => {
  const sorted = values.toSorted((a, b) => a - b);
  const percentile = (p: number) => sorted[Math.max(0, Math.ceil(sorted.length * p) - 1)] ?? null;
  return { n: sorted.length, medianMs: percentile(0.5), p95Ms: percentile(0.95), minMs: sorted[0] ?? null, maxMs: sorted.at(-1) ?? null };
};
const reports = [...new Set(samples.map(sample => sample.label))].map(label => {
  const group = samples.filter(sample => sample.label === label);
  const previews = group.filter(sample => sample.outcome === "pending");
  return { label, requests: group.length, previews: previews.length,
    outcomes: group.map(sample => sample.outcome),
    browserStreamComplete: distribution(previews.map(sample => sample.completedMs)),
    firstFrame: distribution(previews.flatMap(sample => { const frame = sample.frames.find(frame => frame.type === "trace"); return frame ? [frame.at] : []; })),
    modelMs: distribution(previews.map(sample => sample.frames.filter(frame => frame.stage?.status === "complete" && ["Waiting for model", "Generating a response"].includes(frame.stage.label)).reduce((sum, frame) => sum + ((frame.stage?.endedAt ?? 0) - (frame.stage?.startedAt ?? 0)), 0))),
    traces: previews.flatMap(sample => sample.frames.filter(frame => frame.type === "trace").map(frame => frame.traceId)),
  };
});
console.log(JSON.stringify({ measurement: "Authenticated browser API stream completion, not UI paint. Stage intervals may overlap. Small sample p95 is descriptive only.", reports }, null, 2));
