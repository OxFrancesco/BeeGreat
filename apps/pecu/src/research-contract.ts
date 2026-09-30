import { z } from "zod";
import { researchWindows } from "./integrations/chain-data";

export { researchWindows, type ResearchWindow } from "./integrations/chain-data";

/** Six symbols without I, O, 0 or 1, like task and confirmation codes. */
export const researchCodeSchema = z.string().regex(/^[A-HJ-NP-Z2-9]{6}$/);
export const researchWindowSchema = z.enum(researchWindows);
export const specialistRoles = ["capital", "activity", "flows", "social"] as const;
export const researchRoles = [...specialistRoles, "synthesis"] as const;
export const researchRoleSchema = z.enum(researchRoles);
export type ResearchRole = z.infer<typeof researchRoleSchema>;
export type SpecialistRole = (typeof specialistRoles)[number];
export const researchStates = ["queued", "collecting", "researching", "synthesizing", "completed", "failed", "cancelled"] as const;
export const researchStateSchema = z.enum(researchStates);
export type ResearchState = z.infer<typeof researchStateSchema>;
export const stageStates = ["pending", "running", "done", "failed", "skipped"] as const;
export const stageStateSchema = z.enum(stageStates);
export type StageState = z.infer<typeof stageStateSchema>;
export const activeResearchStates: ReadonlySet<ResearchState> = new Set(["queued", "collecting", "researching", "synthesizing"]);

const isoDate = z.iso.date();
const confidence = z.enum(["high", "medium", "low"]).describe("high: first-party or on-chain evidence plus a timing match. medium: clear timing and a plausible mechanism from one source. low: plausible, unverified.");

export const evidenceSchema = z.strictObject({
  kind: z.enum(["metric", "protocol", "flow", "post", "event", "price"]),
  label: z.string().trim().min(3).max(240).describe("What the source shows, with its number and date, for example \"Morpho Blue Base TVL +$242M, 2026-09-20 to 2026-09-27\"."),
  url: z.url().max(600).optional().describe("Source URL from a tool result: post link, API URL or explorer link. Omit rather than invent."),
  date: isoDate.optional(),
});
export type Evidence = z.infer<typeof evidenceSchema>;

export const findingSchema = z.strictObject({
  title: z.string().trim().min(3).max(160).describe("The finding in one line, with its number."),
  detail: z.string().trim().min(3).max(1400).describe("What happened, the mechanism and the timing."),
  date: isoDate.optional().describe("Day of the event, UTC."),
  magnitude: z.string().trim().max(80).optional().describe("Size with sign and period, for example +$242M over 7d."),
  actors: z.array(z.string().trim().min(1).max(120)).max(8).optional().describe("Protocols, teams, cohorts, wallets or X handles involved."),
  evidence: z.array(evidenceSchema).min(1).max(8),
  confidence,
});
export type Finding = z.infer<typeof findingSchema>;

export const findingsSchema = z.strictObject({
  summary: z.string().trim().min(3).max(1500).describe("Three to five sentences on what this specialist found."),
  findings: z.array(findingSchema).max(12),
  gaps: z.array(z.string().trim().min(3).max(300)).max(8).describe("Moves or questions the data could not explain."),
});
export type Findings = z.infer<typeof findingsSchema>;

export const causeSchema = z.strictObject({
  movement: z.string().trim().min(3).max(200).describe("The movement with its number and period, for example \"DeFi TVL +$358M (+6.1%) over 7d\"."),
  mechanism: z.string().trim().min(3).max(700).describe("How the drivers produced the movement."),
  drivers: z.array(z.string().trim().min(3).max(300)).min(1).max(6).describe("Steps in order, from catalyst to effect."),
  catalyst: z.string().trim().max(300).optional().describe("The dated trigger, if one is known."),
  explains: z.string().trim().max(160).optional().describe("How much of the movement this explains, and how much is price, for example \"$242M of $358M; price about $40M\"."),
  evidence: z.array(evidenceSchema).min(1).max(10),
  confidence,
});
export type Cause = z.infer<typeof causeSchema>;

export const reportSchema = z.strictObject({
  headline: z.string().trim().min(3).max(160),
  summary: z.string().trim().min(3).max(1400),
  causes: z.array(causeSchema).min(1).max(10),
  timeline: z.array(z.strictObject({ date: isoDate, title: z.string().trim().min(3).max(200), detail: z.string().trim().max(400).optional(), url: z.url().max(600).optional() })).max(24),
  actors: z.array(z.strictObject({ name: z.string().trim().min(1).max(120), role: z.string().trim().min(3).max(300) })).max(12),
  unexplained: z.array(z.string().trim().min(3).max(300)).max(8),
  watch: z.array(z.string().trim().min(3).max(300)).max(6),
});
export type ResearchReport = z.infer<typeof reportSchema>;

export const researchStageSchema = z.object({
  role: researchRoleSchema,
  label: z.string(),
  state: stageStateSchema,
  startedAt: z.number().nullable(),
  endedAt: z.number().nullable(),
  calls: z.number().int().nonnegative(),
  summary: z.string().nullable(),
  error: z.string().nullable(),
});
export type ResearchStageView = z.infer<typeof researchStageSchema>;

export const researchSummarySchema = z.object({
  code: researchCodeSchema,
  chain: z.object({ id: z.string(), name: z.string() }),
  window: researchWindowSchema,
  period: z.object({ start: isoDate, end: isoDate }).nullable(),
  state: researchStateSchema,
  headline: z.string().nullable(),
  error: z.string().nullable(),
  stages: z.array(researchStageSchema),
  channel: z.enum(["x", "web"]),
  threadId: z.string().nullable(),
  createdAt: z.number(),
  completedAt: z.number().nullable(),
});
export type ResearchSummary = z.infer<typeof researchSummarySchema>;

export const researchDetailSchema = researchSummarySchema.extend({
  report: reportSchema.nullable(),
  markdown: z.string().nullable(),
  findings: z.record(z.string(), findingsSchema),
});
export type ResearchDetail = z.infer<typeof researchDetailSchema>;

export const researchListSchema = z.object({
  researches: z.array(researchSummarySchema),
  chains: z.array(z.object({ id: z.string(), name: z.string() })),
  limit: z.object({ used: z.number().int().nonnegative(), daily: z.number().int().positive() }),
});
export type ResearchList = z.infer<typeof researchListSchema>;

export const researchActionSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("start"), chain: z.string().trim().min(2).max(60), window: researchWindowSchema.default("7d") }),
  z.strictObject({ kind: z.literal("cancel"), code: researchCodeSchema }),
  z.strictObject({ kind: z.literal("delete"), code: researchCodeSchema }),
  z.strictObject({ kind: z.literal("rerun"), code: researchCodeSchema }),
]);
export type ResearchAction = z.infer<typeof researchActionSchema>;
export const researchActionResultSchema = z.object({ research: researchSummarySchema.nullable(), message: z.string() });
export const researchQuerySchema = z.strictObject({ code: researchCodeSchema });
