import { z } from "zod";
import { stockSnapshotSchema } from "./stock-contract";
import { webIdentitySchema } from "./web-contract";

export const portfolioTokenSchema = z.string().trim().min(1).max(64).regex(/^(?:0x[0-9a-fA-F]{40}|[A-Za-z][A-Za-z0-9.\-]{0,19})$/, "Enter a token ticker or Base contract address.");
/** A wallet the account owns: its Pecu wallet or one of its linked wallets. Omitted means the Pecu wallet. */
export const ownedWalletSchema = z.templateLiteral(["0x", z.string().regex(/^[0-9a-fA-F]{40}$/)]);
export const portfolioQuerySchema = z.object({
  tokens: z.array(portfolioTokenSchema).max(20).default(["ETH", "USDC"]),
  stocks: z.boolean().default(false),
  wallet: ownedWalletSchema.optional(),
}).strict();
export const portfolioRequestSchema = webIdentitySchema.extend(portfolioQuerySchema.shape).strict();
export const portfolioBalanceSchema = z.object({
  reference: z.string(),
  symbol: z.string(),
  address: z.string().nullable(),
  amount: z.string().nullable(),
  error: z.string().nullable(),
});
export const portfolioSchema = z.object({
  wallet: z.string().nullable(),
  balances: z.array(portfolioBalanceSchema),
  holdings: stockSnapshotSchema.nullable(),
  stocksError: z.string().nullable(),
});
export type Portfolio = z.infer<typeof portfolioSchema>;
