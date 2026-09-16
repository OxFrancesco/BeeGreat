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
  if (init?.method === "POST") {
    if (!url.pathname.endsWith("/turn")) throw new Error("This fixture only simulates messages.");
    await new Promise(resolve => setTimeout(resolve, 15000));
    return Response.json({ ok: true });
  }
  const id = url.searchParams.get("t");
  const before = url.searchParams.get("before"),
    after = url.searchParams.get("after");
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, 600);
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
          reply: {
            text: `Response ${start + i}. **Wallet analysis**\n\n${"The balances and activity are available for review. ".repeat(1 + (i % 5))}\n\n- USDC balance reviewed\n- No transaction submitted`,
            preview: null,
          },
        }))
      : [],
    stocks: null,
    stocksAt: null,
    basket: null,
  });
};
const rootRoute = createRootRoute({ component: Outlet });
const agentRoute = Route.update({
  id: "/agent",
  path: "/agent",
  getParentRoute: () => rootRoute,
} as never);
const router = createRouter({ routeTree: rootRoute.addChildren([agentRoute]) });
createRoot(document.getElementById("root")!).render(
  <RouterProvider router={router} />,
);
