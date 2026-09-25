import { z } from "zod";
import { previewSchema, webIdentitySchema } from "./web-contract";

const address = z.templateLiteral(["0x", z.string().regex(/^[0-9a-fA-F]{40}$/)]);
const hash = z.templateLiteral(["0x", z.string().regex(/^[0-9a-fA-F]{64}$/)]);
const hashText = z.string().regex(/^0x[0-9a-fA-F]{64}$/);
const uint = z.string().regex(/^(0|[1-9]\d*)$/).max(78);
const decimalAmount = z.string().trim().regex(/^(?:0|[1-9]\d*)(?:\.\d+)?$/, "Enter an amount such as 12.5");
const threshold = z.number().int().min(1).max(32);
const requestId = z.string().uuid();
export const profileNameSchema = z.string().trim().min(1, "Enter a name").max(40, "Use 40 characters or fewer");
export const orgIdSchema = z.string().regex(/^[a-f0-9]{16}$/);
/** ETH, USDC, AERO, or an ERC-20 contract address on Base. */
export const profileTokenSchema = z.union([z.enum(["ETH", "USDC", "AERO"]), address]);

export const safeProposalActionSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("send"), token: profileTokenSchema, to: address, amount: decimalAmount }),
  z.strictObject({ kind: z.literal("owner-add"), owner: address, threshold }),
  z.strictObject({ kind: z.literal("owner-remove"), owner: address, threshold }),
  z.strictObject({ kind: z.literal("owner-replace"), owner: address, replacement: address }),
  z.strictObject({ kind: z.literal("threshold"), threshold }),
  z.strictObject({ kind: z.literal("reject") }),
  z.strictObject({ kind: z.literal("budget-set"), delegate: address, token: profileTokenSchema, amount: decimalAmount, resetMinutes: z.number().int().min(0).max(65535) }),
  z.strictObject({ kind: z.literal("budget-revoke"), delegate: address, token: address }),
]);
export type SafeProposalAction = z.output<typeof safeProposalActionSchema>;

/** Everything the profile page can change. The web server adds the verified identity. */
export const profileActionSchema = z.discriminatedUnion("op", [
  z.strictObject({ op: z.literal("org-create"), name: profileNameSchema }),
  z.strictObject({ op: z.literal("org-rename"), orgId: orgIdSchema, name: profileNameSchema }),
  z.strictObject({ op: z.literal("org-delete"), orgId: orgIdSchema }),
  z.strictObject({ op: z.literal("contact-save"), orgId: orgIdSchema, address, name: profileNameSchema }),
  z.strictObject({ op: z.literal("contact-delete"), orgId: orgIdSchema, address }),
  z.strictObject({ op: z.literal("safe-add"), orgId: orgIdSchema, safe: address, name: profileNameSchema }),
  z.strictObject({ op: z.literal("safe-create"), requestId, orgId: orgIdSchema, name: profileNameSchema, owners: z.array(address).min(1).max(32), threshold }),
  z.strictObject({ op: z.literal("safe-rename"), safe: address, name: profileNameSchema }),
  z.strictObject({ op: z.literal("safe-remove"), safe: address }),
  z.strictObject({ op: z.literal("proposal-create"), safe: address, action: safeProposalActionSchema }),
  z.strictObject({ op: z.literal("proposal-delete"), hash }),
  z.strictObject({ op: z.literal("proposal-sign"), hash, owner: address, signature: z.string().regex(/^0x[0-9a-fA-F]{130}$/) }),
  z.strictObject({ op: z.literal("proposal-approve"), requestId, hash }),
  z.strictObject({ op: z.literal("proposal-execute"), requestId, hash }),
  z.strictObject({ op: z.literal("proposal-submitted"), hash, transaction: hash }),
  z.strictObject({ op: z.literal("budget-spend"), requestId, safe: address, token: profileTokenSchema, to: address, amount: decimalAmount }),
  z.strictObject({ op: z.literal("intent-confirm"), requestId, code: z.string().regex(/^[A-Z0-9]{6}$/) }),
  z.strictObject({ op: z.literal("intent-cancel"), requestId, code: z.string().regex(/^[A-Z0-9]{6}$/) }),
]);
export type ProfileAction = z.output<typeof profileActionSchema>;
export const profileActionRequestSchema = z.strictObject({ identity: webIdentitySchema, action: profileActionSchema });
export const profileSafeRequestSchema = webIdentitySchema.extend({ safe: address }).strict();

const contactSchema = z.object({ address, name: z.string() });
export const profileSafeSummarySchema = z.object({
  address,
  name: z.string(),
  status: z.enum(["ready", "creating", "not-created"]),
});
export const profileOrgSchema = z.object({
  id: orgIdSchema,
  name: z.string(),
  createdAt: z.number(),
  safes: z.array(profileSafeSummarySchema),
  contacts: z.array(contactSchema),
});
export const profileBalanceSchema = z.object({
  symbol: z.string(),
  token: address.nullable(),
  decimals: z.number().int(),
  amount: z.string(),
});
export const profileOverviewSchema = z.object({
  wallet: address.nullable(),
  senderKind: z.enum(["x", "web"]),
  balances: z.array(profileBalanceSchema).nullable(),
  orgs: z.array(profileOrgSchema),
});
export type ProfileOverview = z.infer<typeof profileOverviewSchema>;
export type ProfileOrg = z.infer<typeof profileOrgSchema>;
export type ProfileBalance = z.infer<typeof profileBalanceSchema>;

export const profileSafeTransactionSchema = z.object({
  chainId: z.literal(8453),
  safe: address,
  to: address,
  value: uint,
  data: z.string().regex(/^0x(?:[0-9a-fA-F]{2})*$/),
  nonce: uint,
  hash: hashText,
  operation: z.union([z.literal(0), z.literal(1)]).optional(),
});
/** A Pecu confirmation the viewer started from the profile, with the code needed to confirm it. */
export const profileIntentSchema = z.object({
  requestId,
  kind: z.enum(["create", "approve", "execute", "spend"]),
  preview: previewSchema,
});
export type ProfileIntent = z.infer<typeof profileIntentSchema>;
export const profileProposalSchema = z.object({
  hash: hashText,
  nonce: uint,
  title: z.string(),
  summary: z.string(),
  /** `other` covers proposals created in chat, such as batches or role grants. */
  kind: z.enum(["send", "owner-add", "owner-remove", "owner-replace", "threshold", "reject", "budget-set", "budget-revoke", "other"]),
  createdAt: z.number(),
  proposer: z.enum(["you", "owner", "other"]),
  transaction: profileSafeTransactionSchema,
  approvals: z.array(z.object({ owner: address, via: z.enum(["chain", "signature"]) })),
  signatures: z.array(z.object({ owner: address, data: z.string() })),
  state: z.enum(["queued", "submitted", "executed", "replaced", "closed"]),
  executedTransaction: hashText.nullable(),
  intents: z.array(profileIntentSchema),
});
export type ProfileProposal = z.infer<typeof profileProposalSchema>;
export const profileBudgetSchema = z.object({
  delegate: address,
  token: address,
  symbol: z.string(),
  decimals: z.number().int(),
  amount: z.string(),
  spent: z.string(),
  remaining: z.string(),
  resetMinutes: z.number().int(),
});
export type ProfileBudget = z.infer<typeof profileBudgetSchema>;
export const profileSafeDetailSchema = z.object({
  address,
  name: z.string(),
  org: z.object({ id: orgIdSchema, name: z.string() }),
  status: z.enum(["ready", "creating", "not-created"]),
  creation: profileIntentSchema.nullable(),
  wallet: address.nullable(),
  owners: z.array(address),
  threshold: z.number().int(),
  nonce: uint,
  modules: z.array(z.object({ address, name: z.string() })),
  balances: z.array(profileBalanceSchema),
  queue: z.array(profileProposalSchema),
  history: z.array(profileProposalSchema),
  budgets: z.array(profileBudgetSchema),
  intents: z.array(profileIntentSchema),
  contacts: z.array(contactSchema),
  observedAt: z.number(),
});
export type ProfileSafeDetail = z.infer<typeof profileSafeDetailSchema>;

export const profileActionResultSchema = z.object({
  ok: z.literal(true),
  orgId: orgIdSchema.optional(),
  safe: address.optional(),
  proposal: hashText.optional(),
  intent: profileIntentSchema.optional(),
  /** Plain reply text from Pecu when an action ran through the confirmation flow. */
  message: z.string().optional(),
});
export type ProfileActionResult = z.infer<typeof profileActionResultSchema>;
