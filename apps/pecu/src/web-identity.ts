import { z } from "zod";
const linkedAccountSchema = z.object({
  provider: z.string(),
  providerUserId: z.string(),
  verification: z.object({ status: z.string().nullable() }).nullable(),
});
type LinkedAccount = z.infer<typeof linkedAccountSchema>;
const xProviders = ["oauth_x", "oauth_twitter", "twitter", "x"];
export const clerkUserIdSchema = z.string().regex(/^user_[A-Za-z0-9]+$/);
/** Numeric X user ID; the sender identity shared with X DMs. */
export const xSenderIdSchema = z.string().regex(/^\d{1,30}$/);
/** Web-only sender derived from the Clerk user, for accounts with no linked X account (e.g. Google). */
export const webSenderIdSchema = z.string().regex(/^web-user_[A-Za-z0-9]+$/);
export const senderIdSchema = z.union([xSenderIdSchema, webSenderIdSchema]);
export type SenderKind = "x" | "web";
export function senderKind(senderId: string): SenderKind {
  return senderId.startsWith("web-") ? "web" : "x";
}
/**
 * The agent conversation for a web thread. The original web conversation keeps
 * its `stocks:` owner so existing history, YOLO settings and pending previews
 * stay attached. Extra threads append `#threadId`.
 */
export function webConversation({ userId, senderId, threadId }: Readonly<{ userId: string; senderId: string; threadId?: string | null }>): string {
  const base = `stocks:${userId}:${senderId}`;
  return threadId ? `${base}#${threadId}` : base;
}
export function isWebConversation(conversationId: string): boolean {
  return conversationId.startsWith("stocks:");
}
export function verifiedXAccount(accounts: readonly LinkedAccount[]): string {
  const verified = verifiedXAccounts(accounts);
  if (verified.length !== 1)
    throw new Error("Sign in with the X account you use with Pecu.");
  return verified[0];
}
function verifiedXAccounts(accounts: readonly LinkedAccount[]): string[] {
  return z
    .array(linkedAccountSchema)
    .parse(accounts)
    .filter(
      (account) =>
        xProviders.includes(account.provider) &&
        account.verification?.status === "verified" &&
        xSenderIdSchema.safeParse(account.providerUserId).success,
    )
    .map((account) => account.providerUserId);
}
/**
 * Resolve the Pecu sender for a signed-in Clerk user. A single verified X
 * account maps to the wallet that account already uses over X DMs. A user with
 * no verified X account (Google or any other Clerk method) gets a web-only
 * sender keyed by the server-verified Clerk user ID. Two verified X accounts
 * are ambiguous and rejected.
 */
export function webSenderId(userId: string, accounts: readonly LinkedAccount[]): string {
  const verified = verifiedXAccounts(accounts);
  if (verified.length > 1)
    throw new Error("Sign in with the X account you use with Pecu.");
  if (verified.length === 1) return verified[0];
  return `web-${clerkUserIdSchema.parse(userId)}`;
}
