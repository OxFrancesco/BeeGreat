export const posthogProjectToken = "phc_CuWKFGhXJpminSdtxBCPSvLoGmt2tyBSZAi6JL37gNkt";
export const posthogHost = "https://eu.i.posthog.com";

export async function analyticsIdentity(senderId: string): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`pecu:analytics:${senderId}`));
  return `pecu_${Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

export function analyticsPath(path: string): string {
  if (path === "/") return "/";
  if (path === "/agent" || path.startsWith("/agent/")) return "/agent";
  if (path === "/profile" || path.startsWith("/profile/")) return "/profile";
  if (path === "/aero/stocks" || path.startsWith("/aero/stocks/")) return "/aero/stocks";
  if (path === "/aero/cli/docs" || path.startsWith("/aero/cli/docs/")) return "/aero/cli/docs";
  if (path === "/aero/cli" || path.startsWith("/aero/cli/")) return "/aero/cli";
  for (const prefix of ["/stocks", "/un-aerosdk/docs", "/un-aerosdk", "/evmsdk", "/docs/pecu", "/docs/aero", "/docs/evm", "/docs"]) {
    if (path === prefix || path.startsWith(`${prefix}/`)) return prefix;
  }
  return "/other";
}
