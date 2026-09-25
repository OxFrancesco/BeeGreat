import { z } from "zod";

const address = z.string().regex(/^0x[0-9a-fA-F]{40}$/);
const nodeId = z.string().regex(/^n\d{1,2}$/);

export const planStepKinds = ["approval", "swap", "deposit", "withdraw", "transfer", "stake", "unstake", "claim", "lock", "lend", "call"] as const;

/** A token, pool, recipient or protocol that value moves between. */
export const planNodeSchema = z.object({
  id: nodeId,
  kind: z.enum(["token", "pool", "account", "protocol"]),
  label: z.string().min(1).max(48),
  detail: z.string().min(1).max(64).optional(),
  /** The deposit creates this pool. */
  created: z.boolean().optional(),
});

/** Value moving from one node to another in the transaction at `step`. */
export const planEdgeSchema = z.object({
  from: nodeId,
  to: nodeId,
  step: z.number().int().min(0).max(15),
  label: z.string().min(1).max(32).optional(),
});

/** One wallet transaction, decoded from the exact persisted call. */
export const planStepSchema = z.object({
  kind: z.enum(planStepKinds),
  title: z.string().min(1).max(1_000),
  contract: address,
  contractName: z.string().min(1).max(48).optional(),
  /** Native ETH sent with the call, as a human amount. */
  value: z.string().min(1).max(80).optional(),
  /** Execution progress. Absent until the plan is confirmed; `skipped` steps were never sent because an earlier one failed. */
  status: z.enum(["waiting", "submitted", "confirmed", "failed", "skipped"]).optional(),
  hash: z.string().regex(/^0x[0-9a-fA-F]{64}$/).optional(),
});

/**
 * The web preview's view of every transaction in a plan. Object schemas stay
 * non-strict so an older client can read a plan with fields it does not know.
 */
export const transactionPlanSchema = z.object({
  steps: z.array(planStepSchema).min(1).max(16),
  route: z.object({
    nodes: z.array(planNodeSchema).min(2).max(24),
    edges: z.array(planEdgeSchema).min(1).max(32),
  }).optional(),
});

export type PlanNode = z.infer<typeof planNodeSchema>;
export type PlanEdge = z.infer<typeof planEdgeSchema>;
export type PlanStep = z.infer<typeof planStepSchema>;
export type PlanStepKind = PlanStep["kind"];
export type TransactionPlan = z.infer<typeof transactionPlanSchema>;
