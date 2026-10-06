import docsPages from "./analytics-pages.generated.json";

export const posthogProjectToken = "phc_CuWKFGhXJpminSdtxBCPSvLoGmt2tyBSZAi6JL37gNkt";
export const posthogHost = "https://eu.i.posthog.com";

export async function analyticsIdentity(senderId: string): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`pecu:analytics:${senderId}`));
  return `pecu_${Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

const docsPaths = new Set(docsPages);
const sitePaths = new Set(["/", "/about", "/design", "/nansen-showcase", "/polymarket-showcase", "/un-aerosdk", "/evmsdk"]);
type AnalyticsPage = { path: string; surface: "site" | "docs" | "app" | "other" };

export function analyticsPage(path: string): AnalyticsPage {
  const clean = path.split(/[?#]/, 1)[0]!.replace(/\/index\.html$/, "").replace(/\/+$/, "") || "/";
  if (docsPaths.has(clean)) return { path: clean, surface: "docs" };
  if (sitePaths.has(clean)) return { path: clean, surface: "site" };
  for (const prefix of ["/agent", "/profile", "/stocks", "/researches", "/aero/stocks"]) {
    if (clean === prefix || clean.startsWith(`${prefix}/`)) return { path: prefix, surface: "app" };
  }
  for (const prefix of ["/aero/cli/docs", "/un-aerosdk/docs", "/docs/pecu", "/docs/aero", "/docs/evm", "/docs"]) {
    if (clean === prefix || clean.startsWith(`${prefix}/`)) return { path: prefix, surface: "docs" };
  }
  for (const prefix of ["/aero/cli", "/un-aerosdk", "/evmsdk"]) {
    if (clean === prefix || clean.startsWith(`${prefix}/`)) return { path: prefix, surface: "site" };
  }
  return { path: "/other", surface: "other" };
}

export function analyticsPath(path: string): string {
  return analyticsPage(path).path;
}
