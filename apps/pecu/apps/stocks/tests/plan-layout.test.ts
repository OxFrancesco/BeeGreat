import { expect, test } from "bun:test";
import { planLayout, routeDescription, type PlanRoute } from "../src/lib/plan-layout";
import { transactionPlans } from "./fixtures/transaction-plans";

const pool = transactionPlans.pool.route;

test("layers follow the longest path, so the funding swap sits between the budget token and the pool", () => {
  const layout = planLayout(pool, "across");
  expect(layout.layers).toBe(3);
  expect(layout.nodes.map((node) => [node.label, node.layer])).toEqual([["USDC", 0], ["WETH", 1], ["New CL100 pool", 2]]);
  expect(new Set(layout.nodes.map((node) => node.y)).size).toBe(1);
  expect(layout.nodes.map((node) => node.x)).toEqual([78, 298, 518]);
});

test("an edge that skips a layer arcs away from the node it passes, and the arc fits inside the map", () => {
  const across = planLayout(pool, "across");
  const skip = across.edges.find((edge) => edge.from === "n0" && edge.to === "n2")!;
  const direct = across.edges.find((edge) => edge.from === "n0" && edge.to === "n1")!;
  const row = across.nodes[0]!.y;
  expect(direct.mid.y).toBe(row);
  expect(skip.mid.y).toBeLessThan(row);
  expect(skip.mid.y).toBeGreaterThan(0);
  const down = planLayout(pool, "down");
  const column = down.nodes[0]!.x;
  expect(down.edges.find((edge) => edge.from === "n0" && edge.to === "n2")!.mid.x).toBeLessThan(column);
  expect(down.width).toBeLessThan(across.width);
  expect(down.height).toBeGreaterThan(across.height);
});

test("fan-outs spread rows around the source and keep the source centred", () => {
  const layout = planLayout(transactionPlans.basket.route, "across");
  const [source, first, second] = layout.nodes;
  expect(first!.y).toBeLessThan(second!.y);
  expect(source!.y).toBe((first!.y + second!.y) / 2);
});

test("cycles and dangling edges never hang or place a node twice", () => {
  const route: PlanRoute = {
    nodes: [{ id: "n0", kind: "token", label: "USDC" }, { id: "n1", kind: "token", label: "NVDAc" }],
    edges: [{ from: "n0", to: "n1", step: 0 }, { from: "n1", to: "n0", step: 0 }, { from: "n0", to: "n9", step: 1 }],
  };
  const layout = planLayout(route, "across");
  expect(layout.nodes).toHaveLength(2);
  expect(layout.edges).toHaveLength(2);
  expect(layout.edges.every((edge) => /^M[\d.]+ [\d.]+C/.test(edge.path))).toBe(true);
});

test("screen readers get the route in words", () => {
  expect(routeDescription(transactionPlans.multihop.route)).toBe(
    "Route: USDC to AERO through a volatile pool, transaction 3; AERO to cbBTC through a CL200 pool, transaction 3.",
  );
  expect(routeDescription(pool)).toContain("WETH to New CL100 pool (WETH / USDC), transaction 6");
});
