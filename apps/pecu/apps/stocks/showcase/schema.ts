import { z } from "zod";
import { analyticsSnapshotSchema } from "../../../src/analytics-contract";
export const showcaseSchema = z.object({
  source: z.enum(["nansen", "illustrative"]),
  collectedAt: z.string().nullable(),
  requests: z.number().int().nonnegative(),
  examples: z.array(z.object({ id: z.string(), name: z.string(), question: z.string(), note: z.string(), snapshot: analyticsSnapshotSchema })),
});
export type Showcase = z.infer<typeof showcaseSchema>;
