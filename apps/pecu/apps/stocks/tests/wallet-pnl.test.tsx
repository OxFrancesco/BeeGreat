import { afterEach, beforeEach, expect, test } from "bun:test";
import { Window } from "happy-dom";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import type { PnlSnapshot } from "../../../src/analytics-contract";
import { PnlPreviewBody, PnlReport, WalletPnl } from "../src/components/wallet-pnl";
import { pnlSummary, signedUsd } from "../src/lib/wallet-pnl";
import { analyticsFixtures } from "./fixtures/nansen-analytics";

const wallet = "0x1111111111111111111111111111111111111111";
const snapshot = analyticsFixtures.find((fixture) => fixture.key === "pnl") as PnlSnapshot;
const missing: PnlSnapshot = {
  ...snapshot,
  partial: true,
  rows: [...snapshot.rows, { chain: "base", address: "0x6666666666666666666666666666666666666666", symbol: "SPAM", realizedUsd: 5, unrealizedUsd: null }],
};

test("totals keep realized and unrealized apart, rank movers by size and leave unpriced values out", () => {
  const summary = pnlSummary(snapshot);
  expect([summary.realized, summary.unrealized, summary.total]).toEqual([250, -90, 160]);
  expect(summary.rows.map((row) => row.symbol)).toEqual(["AERO", "VIRTUAL", "DEGEN", "ETH"]);
  const partial = pnlSummary(missing);
  expect(partial.missing).toBe(1);
  expect(partial.realized).toBe(255);
  expect(partial.rows.find((row) => row.symbol === "SPAM")?.total).toBeNull();
  expect([1234.5, -310, 0, -0.001].map(signedUsd)).toEqual(["+$1,234.50", "-$310.00", "$0.00", "$0.00"]);
  expect(signedUsd(null)).toBe("Unavailable");
});

test("the hover preview shows totals, the three largest movers and the Nansen source", () => {
  const html = renderToStaticMarkup(<PnlPreviewBody snapshot={snapshot} now={snapshot.observedAt + 3 * 60_000} />);
  expect(html).toContain("+$160.00");
  expect(html).toContain("+$250.00");
  expect(html).toContain("-$90.00");
  expect(html).toContain("AERO");
  expect(html).toContain("VIRTUAL");
  expect(html).not.toContain("ETH");
  expect(html).toContain('href="https://nansen.ai"');
  expect(html).toContain("3 min ago");
  expect(renderToStaticMarkup(<PnlPreviewBody snapshot={{ ...snapshot, rows: [] }} />)).toContain("No trades on Base in the last 30 days.");
});

test("the full page lists every token with exact values and discloses missing prices", () => {
  const html = renderToStaticMarkup(<PnlReport snapshot={missing} days={90} />);
  expect(html).toContain("Total on Base, last 90 days");
  expect(html).toContain("+$165.00");
  expect(html).toContain("SPAM");
  expect(html).toContain("Unavailable");
  expect(html).toContain("Nansen has no price for 1 token.");
  expect(html).toContain("Data: Nansen");
  expect(html).not.toContain("NaN");
  expect(renderToStaticMarkup(<PnlReport snapshot={{ ...snapshot, rows: [] }} days={7} />)).toContain("No trades on Base in the last 7 days.");
});

let root: Root;
let host: HTMLDivElement;
let requests: string[];
let restore: [string, PropertyDescriptor | undefined][] = [];
function setGlobal(key: string, value: unknown) {
  restore.push([key, Object.getOwnPropertyDescriptor(globalThis, key)]);
  Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
}
beforeEach(() => {
  const window = new Window({ url: "https://pecu.app/agent" });
  Object.assign(globalThis, { window, document: window.document, IS_REACT_ACT_ENVIRONMENT: true });
  for (const key of Object.getOwnPropertyNames(window)) {
    if (!/^[A-Z]/.test(key) || (key in globalThis && !/Event$|^HTML|^SVG|^Node|^Element$|^Document|^Mutation|^Resize/.test(key))) continue;
    setGlobal(key, Reflect.get(window, key));
  }
  setGlobal("getComputedStyle", window.getComputedStyle.bind(window));
  setGlobal("requestAnimationFrame", window.requestAnimationFrame.bind(window));
  setGlobal("cancelAnimationFrame", window.cancelAnimationFrame.bind(window));
  requests = [];
  setGlobal("fetch", async (input: string) => {
    requests.push(input);
    const days = Number(new URL(input, "https://pecu.app").searchParams.get("days"));
    return Response.json({ wallet, days, snapshot: { ...snapshot, period: `${days} days` } });
  });
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  for (const [key, descriptor] of restore.reverse()) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else Reflect.deleteProperty(globalThis, key);
  }
  restore = [];
});

test("#pnl opens the full page, periods load their own read, and closing drops the hash", async () => {
  await act(async () => root.render(<WalletPnl address={wallet} />));
  const link = host.querySelector<HTMLAnchorElement>("a.pecu-wallet-address")!;
  expect(link.getAttribute("href")).toBe("#pnl");
  expect(link.textContent).toBe("0x1111…1111 P&L");
  expect(document.querySelector(".pecu-pnl-page")).toBeNull();
  await act(async () => {
    window.location.hash = "#pnl";
    window.dispatchEvent(new window.HashChangeEvent("hashchange"));
  });
  const page = () => document.querySelector(".pecu-pnl-page");
  expect(page()?.querySelector("h2")?.textContent).toBe("P&L");
  expect(page()?.textContent).toContain("Total on Base, last 30 days");
  const ninety = Array.from(page()!.querySelectorAll("button")).find((button) => button.textContent?.includes("90 days"))!;
  await act(async () => ninety.click());
  expect(ninety.getAttribute("aria-pressed")).toBe("true");
  expect(page()?.textContent).toContain("Total on Base, last 90 days");
  expect(requests).toEqual(["/stocks/api/pnl?days=30", "/stocks/api/pnl?days=90"]);
  await act(async () => page()!.querySelector<HTMLButtonElement>('[aria-label="Back to chat"]')!.click());
  expect(window.location.hash).toBe("");
});
