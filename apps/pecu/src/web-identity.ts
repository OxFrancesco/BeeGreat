import { z } from "zod";
const linkedAccountSchema = z.object({
  provider: z.string(),
  providerUserId: z.string(),
  verification: z.object({ status: z.string() }).nullable(),
});
export function verifiedXAccount(accounts: unknown): string {
  const verified = z
    .array(linkedAccountSchema)
    .parse(accounts)
    .filter(
      (account) =>
        ["oauth_x", "oauth_twitter", "twitter", "x"].includes(
          account.provider,
        ) &&
        account.verification?.status === "verified" &&
        /^\d{1,30}$/.test(account.providerUserId),
    );
  if (verified.length !== 1)
    throw new Error("Sign in with the X account you use with Pecu.");
  return verified[0].providerUserId;
}
