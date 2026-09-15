import { createFileRoute } from "@tanstack/react-router";
import { redirectLegacyStocks } from "../lib/legacy-redirect";

export const Route = createFileRoute("/stocks")({
  server: { handlers: { GET: redirectLegacyStocks, POST: redirectLegacyStocks } },
});
