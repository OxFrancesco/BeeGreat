import { v } from "convex/values";

export const agentJobGrantActionValidator = v.union(
  v.literal("claim_emissions"),
  v.literal("claim_fees"),
  v.literal("deposit"),
);

export const agentJobGrantRequestValidator = v.object({
  kind: v.literal("aerodrome_pool"),
  poolAddress: v.string(),
  allowedActions: v.array(agentJobGrantActionValidator),
});

export const agentJobGrantStatusValidator = v.union(
  v.literal("pending"),
  v.literal("active"),
  v.literal("revoked"),
  v.literal("expired"),
);
