import { portfolioFixture } from "./portfolio";
import { analyticsFixtures } from "../fixtures/nansen-analytics";
import { polymarketFixtures } from "../fixtures/polymarket-analytics";
import { analyticsText } from "../../../../src/analytics-contract";
import { connectionFixture } from "./connection";
import { pnlFixture } from "./pnl";
import { TransactionFixture } from "./transactions";
import { linkedWalletFixture } from "./linked";
import { createRoot } from "react-dom/client";
import {
  createRootRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { Route } from "../../src/routes/agent";
import "./fixture.css";
const totalMessages = 10000;
const readDelay = new URLSearchParams(location.search).has("slow") ? 15_000 : 600;
const threads = Array.from({ length: 1000 }, (_, i) => ({
  id:
    i === 0
      ? null
      : i === 1
        ? "aaaaaaaa"
        : i === 2
          ? "bbbbbbbb"
          : `thread-${i.toString().padStart(4, "0")}`,
  title:
    i === 0
      ? "First conversation"
      : i === 1
        ? "Wallet research"
        : i === 2
          ? "Pool research"
          : `Research conversation ${i}`,
  count: totalMessages,
  createdAt: 1,
  updatedAt: Date.now() - i * 60000,
}));
window.fetch = async (input, init) => {
  const url = new URL(String(input), location.origin);
  if (url.pathname.endsWith("/portfolio")) return Response.json(portfolioFixture(url));
  if (init?.method === "POST") {
    if (!url.pathname.endsWith("/turn")) throw new Error("This fixture only simulates messages.");
    await new Promise(resolve => setTimeout(resolve, 15000));
    return Response.json({ ok: true });
  }
  if (url.pathname.endsWith("/pnl")) {
    await new Promise((resolve) => setTimeout(resolve, readDelay));
    return Response.json(pnlFixture("0x1234567890123456789012345678901234567890", Number(url.searchParams.get("days"))));
  }
  const id = url.searchParams.get("t");
  const before = url.searchParams.get("before"),
    after = url.searchParams.get("after");
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, readDelay);
    init?.signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(new DOMException("Aborted", "AbortError"));
      },
      { once: true },
    );
  });
  if (url.pathname.endsWith("/threads")) {
    const start = before
      ? threads.findIndex((t) => t.id === JSON.parse(before).id) + 1
      : after
        ? Math.max(
            0,
            threads.findIndex((t) => t.id === JSON.parse(after).id) - 40,
          )
        : 0;
    const page = threads.slice(start, start + 40);
    return Response.json({
      threads: page,
      olderCursor:
        start + 40 < threads.length
          ? { at: page.at(-1)!.updatedAt, id: page.at(-1)!.id }
          : null,
      newerCursor: start ? { at: page[0]!.updatedAt, id: page[0]!.id } : null,
    });
  }
  if (!url.pathname.endsWith("/state") && !url.pathname.endsWith("/messages"))
    throw new Error(`Unexpected request ${url.pathname}`);
  const end = before
    ? JSON.parse(before).row - 1
    : after
      ? Math.min(totalMessages, JSON.parse(after).row + 40)
      : totalMessages;
  const start = Math.max(1, end - 39);
  const thread = threads.find((thread) => thread.id === id);
  return Response.json({
    threadId: id,
    thread: thread ?? null,
    wallet: "0x1234567890123456789012345678901234567890",
    yolo: false,
    olderCursor: thread && start > 1 ? { at: start, row: start } : null,
    newerCursor: thread && end < totalMessages ? { at: end, row: end } : null,
    messages: thread
      ? Array.from({ length: end - start + 1 }, (_, i) => ({
          id: `${id ?? "first"}:${start + i}`,
          text: `${thread.title}, message ${start + i}`,
          createdAt: start + i,
          reply: (() => {
            const reply: NonNullable<import("../../../../src/web-contract").WebState["messages"][number]["reply"]> = {
            text: `Response ${start + i}. **Wallet analysis**\n\n${"The balances and activity are available for review. ".repeat(1 + (i % 5))}\n\n- USDC balance reviewed\n- No transaction submitted`,
            preview: null,
            };
            if (new URLSearchParams(location.search).has("analytics") && start + i === totalMessages) {
              reply.text = "These charts use fictional data for UI verification.";
              reply.analytics = analyticsFixtures.slice(0, 3).map((snapshot) => ({ snapshot, text: analyticsText(snapshot) }));
            }
            if (new URLSearchParams(location.search).has("polymarket") && start + i === totalMessages) {
              reply.text = "These cards use saved public Polymarket data for UI verification.";
              reply.analytics = polymarketFixtures.filter((snapshot) => ["pm_history", "pm_book", "pm_leaderboard"].includes(snapshot.kind) || snapshot.key.includes("fed-decision")).map((snapshot) => ({ snapshot, text: analyticsText(snapshot) }));
            }
            return reply;
          })(),
        }))
      : [],
    stocks: null,
    stocksAt: null,
    basket: null,
  });
};
function previewFixture() {
  if (!new URLSearchParams(location.search).has("preview")) return;
  const wallet = "0x1234567890123456789012345678901234567890";
  const swapResult =
    "Aerodrome swap confirmed on Base mainnet.\nhttps://basescan.org/tx/0x933d8f8cb5584d9667fd2c845e7977bf67ece4f430dbb5389e63427cb999a716\nhttps://basescan.org/tx/0x486874bfa131f165c002c30fb2ea0ef24cc8036764c869a5ad3756957f3a33d3";
  const basketText =
    "1 USDC → about 0.00452492 NVDAc\nMinimum received: 0.00447967 NVDAc\n\n1 USDC → about 0.00297571 AAPLc\nMinimum received: 0.00294595 AAPLc\nNetwork fee: not estimated yet.";
  const basketPreview = {
    code: "39D685",
    title: "Buy NVDAc · Buy AAPLc",
    state: "pending",
    expiresAt: Date.now() + 600000,
    text: basketText,
  };
  const failedResult =
    "Crossmint reports that the transaction failed before inclusion";
  const messages: object[] = [
    {
      id: "pv:1",
      text: "What's my balance?",
      createdAt: 1,
      reply: { text: "ETH: 0.5\nUSDC: 12.4\nAERO: 0", preview: null },
    },
    {
      id: "pv:2",
      text: "Buy $1 of NVDAc and $1 of AAPLc",
      createdAt: 2,
      reply: { text: basketText, preview: basketPreview },
    },
    {
      id: "pv:3",
      text: "Swap 0.001 ETH to USDC",
      createdAt: 3,
      reply: {
        text: swapResult,
        preview: {
          code: "A1B2C3",
          title: "Swap",
          state: "succeeded",
          expiresAt: Date.now() + 600000,
          text: "Swap 0.001 ETH for about 3.9 USDC on Base.\nMinimum received: 3.8 USDC\nNetwork fee: not estimated yet.",
          result: swapResult,
        },
      },
    },
    {
      id: "pv:4",
      text: "/confirm A1B2C3",
      createdAt: 4,
      reply: { text: swapResult, preview: null },
    },
    {
      id: "pv:5",
      text: "/cancel D4E5F6",
      createdAt: 5,
      reply: {
        text: "Confirmation code not found for this X account and conversation.",
        preview: null,
      },
    },
    {
      id: "pv:6",
      text: "Send 1 USDC to 0x1111111111111111111111111111111111111111",
      createdAt: 6,
      reply: {
        text: failedResult,
        preview: {
          code: "F00BA5",
          title: "Send 1 USDC",
          state: "failed",
          expiresAt: Date.now() + 600000,
          text: "Send 1 USDC to 0x1111…1111.\nNetwork fee: not estimated yet.",
          result: failedResult,
        },
      },
    },
  ];
  const thread = {
    id: null,
    title: "",
    createdAt: 1,
    updatedAt: Date.now(),
    count: messages.length,
  };
  window.fetch = async (input, init) => {
    const url = new URL(String(input), location.origin);
  if (url.pathname.endsWith("/portfolio")) return Response.json(portfolioFixture(url));
    if (init?.method === "POST") {
      if (!url.pathname.endsWith("/turn"))
        throw new Error("This fixture only simulates messages.");
      const body = JSON.parse(String(init.body));
      if (body.text === "/confirm 39D685") {
        await new Promise((resolve) => setTimeout(resolve, 1500));
        const result =
          "Stock trades confirmed on Base mainnet.\nhttps://basescan.org/tx/0x933d8f8cb5584d9667fd2c845e7977bf67ece4f430dbb5389e63427cb999a716";
        basketPreview.state = "succeeded";
        Object.assign(basketPreview, { result });
        messages.push({
          id: `pv:${messages.length + 1}`,
          text: body.text,
          createdAt: Date.now(),
          reply: { text: result, preview: null },
        });
      } else {
        messages.push({
          id: `pv:${messages.length + 1}`,
          text: body.text,
          createdAt: Date.now(),
          reply: { text: `Echo: ${body.text}`, preview: null },
        });
      }
      return Response.json({ status: "complete" });
    }
    if (url.pathname.endsWith("/threads"))
      return Response.json({
        threads: [thread],
        olderCursor: null,
        newerCursor: null,
      });
    if (url.pathname.endsWith("/state") || url.pathname.endsWith("/messages"))
      return Response.json({
        threadId: null,
        thread,
        wallet,
        yolo: false,
        olderCursor: null,
        newerCursor: null,
        messages,
        stocks: null,
        stocksAt: null,
        basket: null,
      });
    throw new Error(`Unexpected request ${url.pathname}`);
  };
}
connectionFixture();
previewFixture();
linkedWalletFixture({ chat: true });
const rootRoute = createRootRoute({ component: Outlet });
// SAFETY: this isolated fixture mounts the generated /agent route under its own local root with the same id and path.
const agentRoute = Route.update({
  id: "/agent",
  path: "/agent",
  getParentRoute: () => rootRoute,
} as never);
const router = createRouter({ routeTree: rootRoute.addChildren([agentRoute]) });
createRoot(document.getElementById("root")!).render(
  new URLSearchParams(location.search).has("transactions") ? <TransactionFixture /> : <RouterProvider router={router} />,
);
