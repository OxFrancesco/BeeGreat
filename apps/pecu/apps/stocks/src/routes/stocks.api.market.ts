import { createFileRoute } from "@tanstack/react-router";
import { env } from "cloudflare:workers";
import { stocksSchema } from "../lib/market";
let cached:
  | { stocks: ReturnType<typeof stocksSchema.parse>; observedAt: number }
  | undefined;
let pending: Promise<NonNullable<typeof cached>> | undefined;
async function readMarket() {
  const binding = env.AERO;
  if (!binding) throw new Error("Market connection unavailable");
  const response: Response = await binding.fetch("https://aero.internal/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "stocks", parameters: { chain: 8453 } }),
  });
  if (!response.ok)
    throw new Error("Market prices are temporarily unavailable");
  return {
    stocks: stocksSchema.parse(await response.json()),
    observedAt: Date.now(),
  };
}
export const Route = createFileRoute("/stocks/api/market")({
  server: {
    handlers: {
      GET: async () => {
        try {
          if (!cached || Date.now() - cached.observedAt > 60000) {
            pending ??= readMarket().finally(() => {
              pending = undefined;
            });
            cached = await pending;
          }
          return Response.json(cached, {
            headers: { "Cache-Control": "public, max-age=30" },
          });
        } catch {
          return Response.json(
            {
              error:
                "Market prices are temporarily unavailable. Try refreshing.",
            },
            { status: 503 },
          );
        }
      },
    },
  },
});
