import { z } from "zod";
import { analyticsSnapshotSchema } from "../../../src/analytics-contract";

export const polymarketSections = [
  { id: "odds", label: "Market odds" },
  { id: "books", label: "Order books" },
  { id: "traders", label: "Top traders" },
  { id: "profiles", label: "Trader profiles" },
] as const;

export const polymarketShowcaseSchema = z.object({
  source: z.literal("polymarket"),
  collectedAt: z.string(),
  requests: z.number().int().nonnegative(),
  examples: z.array(z.object({
    id: z.string(),
    section: z.enum(["odds", "books", "traders", "profiles"]),
    name: z.string(),
    detail: z.string(),
    question: z.string(),
    note: z.string(),
    snapshots: z.array(analyticsSnapshotSchema).min(1).max(3),
  })),
});
export type PolymarketShowcase = z.infer<typeof polymarketShowcaseSchema>;
