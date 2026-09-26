import { z } from "zod";
import { threadIdSchema, webIdentitySchema } from "./web-contract";

const address = z.templateLiteral(["0x", z.string().regex(/^[0-9a-fA-F]{40}$/)]);
const hash = z.templateLiteral(["0x", z.string().regex(/^[0-9a-fA-F]{64}$/)]);
const code = z.string().regex(/^[A-Z0-9]{6}$/);
/** Wallets that sign with their own key return a 65-byte signature. */
export const eoaSignatureSchema = z.templateLiteral(["0x", z.string().regex(/^[0-9a-fA-F]{130}$/)]);
export const linkChallengeIdSchema = z.string().regex(/^[a-f0-9]{32}$/);
export const linkedWalletNameSchema = z.string().trim().min(1, "Enter a name").max(40, "Use 40 characters or fewer");
export const linkedWalletLimit = 10;

export const linkedWalletSchema = z.object({
  address,
  name: z.string().nullable(),
  linkedAt: z.number(),
});
export type LinkedWallet = z.infer<typeof linkedWalletSchema>;
export const linkedWalletsSchema = z.object({ wallets: z.array(linkedWalletSchema) });

/**
 * Everything a signed-in web client can ask about its own wallets. The web
 * server adds the verified identity and the page origin used in the sign-in
 * message. `step`, `submitted` and `declined` drive a chat preview that one of
 * these wallets signs.
 */
export const linkedWalletActionSchema = z.discriminatedUnion("op", [
  z.strictObject({ op: z.literal("challenge"), address }),
  z.strictObject({ op: z.literal("link"), challenge: linkChallengeIdSchema, signature: eoaSignatureSchema }),
  z.strictObject({ op: z.literal("rename"), address, name: linkedWalletNameSchema }),
  z.strictObject({ op: z.literal("unlink"), address }),
  z.strictObject({ op: z.literal("use"), threadId: threadIdSchema.nullable(), address: address.nullable() }),
  z.strictObject({ op: z.literal("step"), threadId: threadIdSchema.nullable(), code, resend: z.boolean().optional() }),
  z.strictObject({ op: z.literal("submitted"), threadId: threadIdSchema.nullable(), code, position: z.number().int().min(0).max(15), hash }),
  z.strictObject({ op: z.literal("declined"), threadId: threadIdSchema.nullable(), code, position: z.number().int().min(0).max(15) }),
]);
export type LinkedWalletAction = z.output<typeof linkedWalletActionSchema>;

export const linkedWalletRequestSchema = z.strictObject({
  identity: webIdentitySchema,
  origin: z.url({ protocol: /^https?$/ }),
  action: linkedWalletActionSchema,
});
export type LinkedWalletRequest = z.output<typeof linkedWalletRequestSchema>;

export const walletTransactionSchema = z.object({ from: address, to: address, data: z.templateLiteral(["0x", z.string().regex(/^(?:[0-9a-fA-F]{2})*$/)]), value: z.string().regex(/^\d+$/) });
export type WalletTransaction = z.infer<typeof walletTransactionSchema>;

export const linkedStepSchema = z.discriminatedUnion("kind", [
  /** Send this exact transaction from the linked wallet, then report its hash. */
  z.object({ kind: z.literal("send"), position: z.number().int(), total: z.number().int(), chainId: z.literal(8453), transaction: walletTransactionSchema }),
  /** A reported transaction is not confirmed on Base yet. */
  z.object({ kind: z.literal("waiting"), position: z.number().int(), hash }),
  /** The wallet was asked to send this step but Pecu never received a hash. */
  z.object({ kind: z.literal("unreported"), position: z.number().int() }),
  /** Nothing to send right now; the preview is in this state. */
  z.object({ kind: z.literal("status"), state: z.enum(["pending", "executing", "succeeded", "failed", "cancelled", "expired"]), message: z.string() }),
]);
export type LinkedStep = z.infer<typeof linkedStepSchema>;

export const linkedWalletResultSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("wallets"), wallets: z.array(linkedWalletSchema) }),
  z.object({ kind: z.literal("challenge"), challenge: linkChallengeIdSchema, message: z.string(), expiresAt: z.number() }),
  z.object({ kind: z.literal("step"), step: linkedStepSchema }),
]);
export type LinkedWalletResult = z.infer<typeof linkedWalletResultSchema>;
