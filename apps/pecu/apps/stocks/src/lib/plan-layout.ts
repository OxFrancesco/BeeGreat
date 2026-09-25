import type {
  PlanEdge,
  PlanNode,
  TransactionPlan,
} from "../../../../src/transaction-plan-contract";

export type PlanRoute = NonNullable<TransactionPlan["route"]>;
/** `across` flows left to right; `down` flows top to bottom for narrow cards. */
export type Orientation = "across" | "down";
export type Point = Readonly<{ x: number; y: number }>;
export type PlacedNode = PlanNode & Point & { layer: number };
export type PlacedEdge = PlanEdge & {
  key: string;
  path: string;
  mid: Point;
  layer: number;
};
export type PlanLayout = Readonly<{
  width: number;
  height: number;
  layers: number;
  nodes: PlacedNode[];
  edges: PlacedEdge[];
}>;

/** Spacing in layout units. HTML nodes sit on these points; SVG edges share the viewBox. */
const spacing = {
  across: { layer: 220, row: 84, padLayer: 78, padRow: 40 },
  down: { layer: 116, row: 156, padLayer: 36, padRow: 80 },
} as const;
/** How far an edge that skips a layer arcs away from the nodes it passes. */
const BOW = 54;

/**
 * Longest-path layering: every node sits one layer past its furthest
 * predecessor. Plans can contain a cycle (a basket that buys and sells the
 * same pair), so relaxation stops after one pass per node.
 */
function layering(nodes: readonly PlanNode[], edges: readonly PlanEdge[]) {
  const layer = new Map(nodes.map((node) => [node.id, 0]));
  for (let pass = 0; pass < nodes.length; pass++) {
    let changed = false;
    for (const edge of edges) {
      const next = layer.get(edge.from)! + 1;
      if (next > layer.get(edge.to)! && next < nodes.length) {
        layer.set(edge.to, next);
        changed = true;
      }
    }
    if (!changed) break;
  }
  const used = [...new Set(layer.values())].sort((a, b) => a - b);
  return new Map([...layer].map(([id, value]) => [id, used.indexOf(value)]));
}

/** Order each layer by the average row of its predecessors to reduce crossings. */
function ordering(
  nodes: readonly PlanNode[],
  edges: readonly PlanEdge[],
  layer: ReadonlyMap<string, number>,
) {
  const layers: PlanNode[][] = [];
  for (const node of nodes) (layers[layer.get(node.id)!] ??= []).push(node);
  const row = new Map<string, number>();
  layers.forEach((members, index) => {
    const weight = (node: PlanNode) => {
      const rows = edges
        .filter((edge) => edge.to === node.id && row.has(edge.from))
        .map((edge) => row.get(edge.from)!);
      return rows.length ? rows.reduce((a, b) => a + b, 0) / rows.length : Number.POSITIVE_INFINITY;
    };
    const sorted = index === 0 ? members : [...members].sort((a, b) => weight(a) - weight(b));
    sorted.forEach((node, position) => row.set(node.id, position));
    layers[index] = sorted;
  });
  return layers;
}

function curve(from: Point, to: Point, orientation: Orientation, bow: number) {
  const across = orientation === "across";
  const along = across ? to.x - from.x : to.y - from.y;
  const lift = bow / 0.75;
  const c1 = across
    ? { x: from.x + along * (bow ? 0.25 : 0.5), y: from.y - lift }
    : { x: from.x - lift, y: from.y + along * (bow ? 0.25 : 0.5) };
  const c2 = across
    ? { x: to.x - along * (bow ? 0.25 : 0.5), y: to.y - lift }
    : { x: to.x - lift, y: to.y - along * (bow ? 0.25 : 0.5) };
  const round = (value: number) => Math.round(value * 10) / 10;
  return {
    path: `M${round(from.x)} ${round(from.y)}C${round(c1.x)} ${round(c1.y)} ${round(c2.x)} ${round(c2.y)} ${round(to.x)} ${round(to.y)}`,
    mid: {
      x: round((from.x + 3 * c1.x + 3 * c2.x + to.x) / 8),
      y: round((from.y + 3 * c1.y + 3 * c2.y + to.y) / 8),
    },
  };
}

/** Place a plan's route for one orientation. Edges that name a missing node are dropped. */
export function planLayout(route: PlanRoute, orientation: Orientation): PlanLayout {
  const ids = new Set(route.nodes.map((node) => node.id));
  const edges = route.edges.filter(
    (edge) => edge.from !== edge.to && ids.has(edge.from) && ids.has(edge.to),
  );
  const layer = layering(route.nodes, edges);
  const layers = ordering(route.nodes, edges, layer);
  const rows = Math.max(...layers.map((members) => members.length));
  const long = edges.some((edge) => layer.get(edge.to)! - layer.get(edge.from)! !== 1);
  const space = spacing[orientation];
  const offset = long ? BOW : 0;
  const nodes = layers.flatMap((members, index) =>
    members.map((node, position): PlacedNode => {
      const along = space.padLayer + index * space.layer;
      const across = offset + space.padRow + (position + (rows - members.length) / 2) * space.row;
      return orientation === "across"
        ? { ...node, layer: index, x: along, y: across }
        : { ...node, layer: index, x: across, y: along };
    }),
  );
  const placed = new Map(nodes.map((node) => [node.id, node]));
  const alongSize = 2 * space.padLayer + (layers.length - 1) * space.layer;
  const acrossSize = offset + 2 * space.padRow + (rows - 1) * space.row;
  return {
    width: orientation === "across" ? alongSize : acrossSize,
    height: orientation === "across" ? acrossSize : alongSize,
    layers: layers.length,
    nodes,
    edges: edges.map((edge, index) => {
      const from = placed.get(edge.from)!;
      const to = placed.get(edge.to)!;
      return {
        ...edge,
        key: `${edge.from}-${edge.to}-${edge.step}-${index}`,
        layer: from.layer,
        ...curve(from, to, orientation, to.layer - from.layer === 1 ? 0 : BOW),
      };
    }),
  };
}

/** Screen-reader description of the route, since the drawing itself is decorative. */
export function routeDescription(route: PlanRoute): string {
  const label = new Map(route.nodes.map((node) => [node.id, node.detail && node.kind === "pool" ? `${node.label} (${node.detail})` : node.label]));
  const pool = (name: string) => (/^(Stable|Volatile)$/.test(name) ? name.toLowerCase() : name);
  return `Route: ${route.edges
    .filter((edge) => label.has(edge.from) && label.has(edge.to))
    .map((edge) => `${label.get(edge.from)} to ${label.get(edge.to)}${edge.label ? ` through a ${pool(edge.label)} pool` : ""}, transaction ${edge.step + 1}`)
    .join("; ")}.`;
}
