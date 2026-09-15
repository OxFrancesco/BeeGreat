import { z } from "zod";

export interface ResearchStore {
  get<T>(key: string): Promise<T | undefined>;
  put<T>(key: string, value: T): Promise<void>;
}
const runSchema = z.object({
  id: z.string().regex(/^[A-Za-z0-9_.:-]{1,200}$/),
  status: z.enum(["queued", "running", "completed", "failed", "cancelled"]),
  output: z.object({ text: z.string().optional(), structured: z.unknown().optional(), grounding: z.array(z.unknown()).optional() }).nullish(),
  costDollars: z.object({ total: z.number().optional() }).optional(),
});
export type PolymarketResult = { text: string; details: unknown };
export class PolymarketService {
  constructor(private readonly apiKey: string | undefined, private readonly store: ResearchStore, private readonly request: typeof fetch = fetch, private readonly sleep: (ms: number) => Promise<void> = (ms) => new Promise((resolve) => setTimeout(resolve, ms))) {}
  private async requestRun(path: string, body?: unknown) {
    if (!this.apiKey) throw new Error("Polymarket research is not configured yet.");
    const response = await this.request.call(globalThis, `https://api.exa.ai/agent/runs${path}`, {
      method: body ? "POST" : "GET", headers: { "content-type": "application/json", "x-api-key": this.apiKey },
      ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(25_000),
    });
    if (!response.ok) throw new Error(`Polymarket research is unavailable (${response.status}). No bets were placed.`);
    return runSchema.parse(await response.json());
  }
  async research(scope: string, eventId: string, query?: string): Promise<PolymarketResult> {
    const latestKey = `polymarket:latest:${scope}`;
    let id: string | undefined;
    if (query) {
      z.string().trim().min(1).max(2000).parse(query);
      const eventKey = `polymarket:event:${scope}:${eventId}`;
      id = await this.store.get<string>(eventKey);
      if (!id) {
        const run = await this.requestRun("", {
          query, effort: "minimal", dataSources: [{ provider: "polymarket" }],
          systemPrompt: "Use Polymarket public data only. Answer concisely in plain text with market URLs and observation time. Explain probabilities as market-implied odds, not forecasts or certainty. State unavailable data. Do not trade or offer to place bets.",
        });
        id = run.id;
        await this.store.put(eventKey, id);
      }
      await this.store.put(latestKey, id);
    } else id = await this.store.get<string>(latestKey);
    if (!id) return { text: "No Polymarket research yet. Try /polymarket What are the odds of a Fed rate cut?", details: {} };
    for (let attempt = 0; attempt < 10; attempt++) {
      const run = await this.requestRun(`/${encodeURIComponent(id)}`);
      if (run.status === "completed") return { text: run.output?.text || "The research completed without an answer. Try a more specific market question.", details: run };
      if (run.status === "failed" || run.status === "cancelled") return { text: "The Polymarket research did not finish. No bets were placed.", details: run };
      if (attempt < 9) await this.sleep(1500);
    }
    return { text: "I'm still checking Polymarket. Send /polymarket status to get the result without starting another search.", details: { id, status: "running" } };
  }
}
