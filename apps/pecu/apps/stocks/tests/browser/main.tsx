import { createRoot } from "react-dom/client";
import {
  createRootRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { Route } from "../../src/routes/agent";
import "./fixture.css";
const threads = [
  {
    id: null,
    title: "First conversation",
    count: 1,
    createdAt: 1,
    updatedAt: Date.now(),
  },
  {
    id: "aaaaaaaa",
    title: "Wallet research",
    count: 1,
    createdAt: 1,
    updatedAt: Date.now(),
  },
  {
    id: "bbbbbbbb",
    title: "Pool research",
    count: 1,
    createdAt: 1,
    updatedAt: Date.now(),
  },
];
window.fetch = async (input, init) => {
  const url = new URL(String(input), location.origin);
  if (init?.method === "POST")
    throw new Error("This fixture only supports reading threads.");
  if (!url.pathname.endsWith("/state"))
    throw new Error(`Unexpected request ${url.pathname}`);
  const id = url.searchParams.get("t");
  await new Promise((resolve) => setTimeout(resolve, 1500));
  return Response.json({
    threadId: id,
    threads,
    wallet: "0x1234567890123456789012345678901234567890",
    yolo: false,
    messages: threads.some((thread) => thread.id === id)
      ? [
          {
            id: id ?? "first",
            text: threads.find((thread) => thread.id === id)?.title,
            createdAt: 1,
            reply: {
              text:
                id === "aaaaaaaa"
                  ? "Wallet research is ready. This is a local test conversation."
                  : id === "bbbbbbbb"
                    ? "Pool research is ready. This is a local test conversation."
                    : "Your conversation stays here while other threads load in the background.",
              preview: null,
            },
          },
        ]
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
