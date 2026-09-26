import { portfolioFixture } from "./portfolio";
import { createRootRoute, createRouter, Outlet, RouterProvider } from "@tanstack/react-router";
import { createRoot } from "react-dom/client";
import { profileActionSchema, type ProfileProposal, type ProfileSafeDetail } from "../../../../src/safe-profile-contract";
import { Route as ProfileRoute } from "../../src/routes/profile";
import { Route as ProfileIndexRoute } from "../../src/routes/profile.index";
import { Route as SafeRoute } from "../../src/routes/profile.safe.$address";
import { bob, fixtureIntent, opsDetail, profileOverview, treasury, treasuryDetail } from "../fixtures/safe-profile";
import { linkedMode, linkedWalletFixture } from "./linked";
import "./fixture.css";

const params = new URLSearchParams(location.search);
const overview = structuredClone(profileOverview);
if (params.has("empty")) overview.orgs = [];
const safes = new Map<string, ProfileSafeDetail>([[treasury.toLowerCase(), structuredClone(treasuryDetail)], [opsDetail.address.toLowerCase(), structuredClone(opsDetail)]]);
const wait = (ms = 350) => new Promise((resolve) => setTimeout(resolve, ms));

window.fetch = async (input, init) => {
  const url = new URL(String(input), location.origin);
  if (url.pathname.endsWith("/portfolio")) return Response.json(portfolioFixture(url));
  await wait();
  if (url.pathname.endsWith("/profile") && init?.method !== "POST") return Response.json(overview);
  if (url.pathname.endsWith("/profile-safe")) {
    const detail = safes.get((url.searchParams.get("safe") ?? "").toLowerCase());
    return detail ? Response.json({ ...detail, observedAt: Date.now() }) : Response.json({ error: "Add this Safe to one of your organizations first." }, { status: 400 });
  }
  if (url.pathname.endsWith("/profile") && init?.method === "POST") {
    const action = profileActionSchema.parse(JSON.parse(String(init.body)));
    const safe = safes.get(treasury.toLowerCase())!;
    switch (action.op) {
      case "org-create":
        overview.orgs.push({ id: "b1b2c3d4e5f60718", name: action.name, createdAt: Date.now(), safes: [], contacts: [] });
        return Response.json({ ok: true, orgId: "b1b2c3d4e5f60718" });
      case "proposal-create": {
        const proposal: ProfileProposal = {
          ...safe.queue[0]!,
          hash: `0x${crypto.randomUUID().replaceAll("-", "").padEnd(64, "0")}`,
          title: action.action.kind === "send" ? `Send ${action.action.amount} ${action.action.token.startsWith("0x") ? "USDC" : action.action.token}` : "Safe transaction",
          summary: action.action.kind === "send" ? `Send ${action.action.amount} to ${action.action.to}` : "Owners approve this change.",
          kind: action.action.kind,
          proposer: "you",
          approvals: [],
          signatures: [],
          createdAt: Date.now(),
        };
        safe.queue.push(proposal);
        return Response.json({ ok: true, safe: treasury, proposal: proposal.hash });
      }
      case "proposal-sign": {
        const proposal = safe.queue.find((item) => item.hash === action.hash)!;
        proposal.approvals.push({ owner: action.owner, via: "signature" });
        proposal.signatures.push({ owner: action.owner, data: action.signature });
        return Response.json({ ok: true, proposal: action.hash });
      }
      case "proposal-execute":
      case "proposal-approve": {
        const proposal = safe.queue.find((item) => item.hash === action.hash)!;
        const intent = action.op === "proposal-execute"
          ? fixtureIntent("execute", "Execute Safe transaction", `Execute with the collected owner signatures from organization wallet ${treasury} to ${proposal.summary.charAt(0).toLowerCase()}${proposal.summary.slice(1)}.\nNetwork fee: not estimated yet.`)
          : fixtureIntent("approve", "Approve Safe transaction", `Approve organization wallet ${treasury} to ${proposal.summary.charAt(0).toLowerCase()}${proposal.summary.slice(1)}.\nThis records your approval on-chain. It does not execute the organization transaction. Approval cannot be individually revoked.\nNetwork fee: not estimated yet.`);
        proposal.intents = [intent];
        return Response.json({ ok: true, proposal: action.hash, intent });
      }
      case "intent-confirm":
      case "intent-cancel": {
        const proposal = safe.queue.find((item) => item.intents.some((intent) => intent.preview.code === action.code));
        const intent = proposal?.intents[0] ?? opsDetail.creation!;
        const next = { ...intent, preview: { ...intent.preview, state: action.op === "intent-confirm" ? "succeeded" as const : "cancelled" as const, result: action.op === "intent-confirm" ? `Organization wallet transaction confirmed on Base mainnet.\nhttps://basescan.org/tx/0x${"ab".repeat(32)}` : undefined } };
        if (proposal) proposal.intents = [next];
        return Response.json({ ok: true, intent: next, message: action.op === "intent-confirm" ? "Organization wallet transaction confirmed on Base mainnet." : "Proposal cancelled. Nothing was sent." });
      }
      default:
        return Response.json({ ok: true });
    }
  }
  throw new Error(`Unexpected request ${url.pathname}`);
};

linkedWalletFixture({ primary: bob });
const icon = `data:image/svg+xml;base64,${btoa('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="#7084ff"/><circle cx="16" cy="16" r="7" fill="#fff"/></svg>')}`;
let accounts: string[] = params.has("connected") ? [bob] : [];
if (params.has("connected")) localStorage.setItem("pecu-browser-wallet", JSON.stringify({ rdns: "io.rabby", address: bob }));
else if (!linkedMode) localStorage.removeItem("pecu-browser-wallet");
const provider = {
  request: async ({ method }: { method: string }) => {
    await wait(200);
    if (method === "eth_accounts") return accounts;
    if (method === "eth_requestAccounts") return (accounts = [bob]);
    if (method === "eth_chainId") return "0x2105";
    if (method === "eth_signTypedData_v4") return `0x${"22".repeat(64)}1c`;
    if (method === "eth_sendTransaction") return `0x${"cd".repeat(32)}`;
    throw Object.assign(new Error(`Unsupported ${method}`), { code: 4200 });
  },
  on: () => {},
  removeListener: () => {},
};
const announce = () => window.dispatchEvent(new CustomEvent("eip6963:announceProvider", { detail: Object.freeze({ info: { uuid: "rabby-fixture", name: "Rabby", icon, rdns: "io.rabby" }, provider }) }));
if (!linkedMode) window.addEventListener("eip6963:requestProvider", announce);

const rootRoute = createRootRoute({ component: Outlet });
// SAFETY: the isolated fixture replaces generated file-route parents with this local root; route ids and paths stay unchanged.
const profileRoute = ProfileRoute.update({ id: "/profile", path: "/profile", getParentRoute: () => rootRoute } as never);
// SAFETY: this index route is mounted under the fixture’s /profile parent, matching the generated route.
const indexRoute = ProfileIndexRoute.update({ id: "/profile/", path: "/", getParentRoute: () => profileRoute } as never);
// SAFETY: this fixture uses the same Safe route path and address parameter under its local /profile parent.
const safeRoute = SafeRoute.update({ id: "/profile/safe/$address", path: "/safe/$address", getParentRoute: () => profileRoute } as never);
const router = createRouter({ routeTree: rootRoute.addChildren([profileRoute.addChildren([indexRoute, safeRoute])]) });
if (location.pathname === "/" || location.pathname.endsWith(".html")) history.replaceState(null, "", `${params.get("path") ?? "/profile"}${params.get("tab") ? `?tab=${params.get("tab")}` : ""}`);
createRoot(document.getElementById("root")!).render(<RouterProvider router={router} />);
