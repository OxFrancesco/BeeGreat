import { createFileRoute } from "@tanstack/react-router";
import { redirectLegacyStocks } from "../lib/legacy-redirect";

export const Route = createFileRoute("/aero/stocks/$")({
  server: { handlers: { GET: redirectLegacyStocks, POST: redirectLegacyStocks } },
});
