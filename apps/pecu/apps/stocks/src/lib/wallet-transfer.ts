import { z } from "zod";
import { ownedWalletSchema, portfolioTokenSchema } from "../../../../src/portfolio-contract";
import { chooseThreadWallet } from "./linked-wallets";
import { request } from "./use-account";

export const transferDraftSchema = z.object({
  from: ownedWalletSchema,
  to: ownedWalletSchema,
  token: portfolioTokenSchema,
  amount: z.string().trim().max(100).regex(/^\d+(?:\.\d+)?$/, "Enter a positive token amount.").refine((value) => /[1-9]/.test(value), "Enter a positive token amount."),
}).refine((value) => value.from.toLowerCase() !== value.to.toLowerCase(), "Choose a different destination wallet.");
export type TransferDraft = z.infer<typeof transferDraftSchema>;
export type TransferAttempt = Readonly<{ threadId: string; requestId: string; draft: TransferDraft }>;

export function transferAttempt(draft: TransferDraft): TransferAttempt {
  return { threadId: crypto.randomUUID(), requestId: crypto.randomUUID(), draft: transferDraftSchema.parse(draft) };
}

/** Each form review gets a new conversation with YOLO off. Retries reuse both IDs. */
export async function reviewTransfer(attempt: TransferAttempt, pecuWallet: string): Promise<string> {
  const draft = transferDraftSchema.parse(attempt.draft);
  await chooseThreadWallet(attempt.threadId, draft.from.toLowerCase() === pecuWallet.toLowerCase() ? null : draft.from);
  const result = z.object({ status: z.enum(["complete", "busy"]) }).parse(await request("turn", {
    threadId: attempt.threadId,
    requestId: attempt.requestId,
    reviewWallet: draft.from,
    text: `/send ${draft.amount} ${draft.token} to ${draft.to}`,
  }));
  if (result.status === "busy") throw new Error("Pecu is preparing this review. Try again shortly.");
  return attempt.threadId;
}

export function exceedsBalance(amount: string, balance: string): boolean {
  if (!/^\d+(?:\.\d+)?$/.test(amount) || !/^\d+(?:\.\d+)?$/.test(balance)) return false;
  const [wholeA = "0", fractionA = ""] = amount.split(".");
  const [wholeB = "0", fractionB = ""] = balance.split(".");
  const precision = Math.max(fractionA.length, fractionB.length);
  return BigInt(wholeA + fractionA.padEnd(precision, "0")) > BigInt(wholeB + fractionB.padEnd(precision, "0"));
}
