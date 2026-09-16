import { createCrossmint, CrossmintWallets, EVMWallet, WalletNotAvailableError, type Wallet } from "@crossmint/wallets-sdk";
import { z } from "zod";
import type { Config } from "./config";
import type { PlannedCall } from "./domain";
import type { WalletStateStore } from "./state";
import { senderKind } from "./web-identity";

type BaseWallet = Wallet<"base">;

const hash32 = z.string().regex(/^0x[0-9a-fA-F]{64}$/);
const crossmintTransactionSchema = z.object({
  id: z.string(),
  status: z.enum(["awaiting-approval", "pending", "failed", "success"]),
  onChain: z.object({
    txId: hash32.nullish(),
    userOperationHash: hash32,
    userOperation: z.object({ sender: z.string().regex(/^0x[0-9a-fA-F]{40}$/) }),
  }),
});

export type WalletTransaction = Readonly<{
  id: string;
  status: "awaiting-approval" | "pending" | "failed" | "success";
  hash?: string;
  userOperationHash: string;
  sender: string;
}>;

export const treasurySenderId = "treasury";

export class WalletService {
  private readonly wallets: CrossmintWallets;

  constructor(private readonly config: Pick<Config, "crossmintApiKey" | "crossmintWalletSecret">, private readonly store: WalletStateStore) {
    this.wallets = CrossmintWallets.from(createCrossmint({ apiKey: config.crossmintApiKey }));
  }

  async getOrCreate(senderId: string): Promise<BaseWallet> {
    const cached = this.store.wallet(senderId);
    let wallet: BaseWallet;
    if (cached) {
      wallet = await this.wallets.getWallet(cached.locator, { chain: "base" });
    } else {
      const owner = senderId === treasurySenderId ? "userId:pecu-treasury" : senderKind(senderId) === "web" ? `userId:basedbot-${senderId}` : `userId:basedbot-x-${senderId}`;
      try {
        wallet = await this.wallets.getWallet(`${owner}:evm:smart`, { chain: "base" });
      } catch (error) {
        if (!(error instanceof WalletNotAvailableError)) throw error;
        wallet = await this.wallets.createWallet({ chain: "base", owner, recovery: { type: "server", secret: this.config.crossmintWalletSecret } });
      }
      this.store.saveWallet(senderId, wallet.address, wallet.address);
    }
    await wallet.useSigner({ type: "server", secret: this.config.crossmintWalletSecret });
    if (wallet.chain !== "base" || !/^0x[0-9a-fA-F]{40}$/.test(wallet.address)) throw new Error("Crossmint returned a wallet outside Base mainnet");
    return wallet;
  }

  async balances(senderId: string): Promise<string> {
    const wallet = await this.getOrCreate(senderId);
    const balances = await wallet.balances(["base:0x940181a94A35A4569E4529A3CDfB74e38FD98631"]);
    return [`Address: ${wallet.address}`, `ETH: ${balances.nativeToken.amount}`, `USDC: ${balances.usdc.amount}`, `AERO: ${balances.tokens[0]?.amount ?? "0"}`].join("\n");
  }

  async usdcBalanceUnits(senderId: string): Promise<bigint> {
    const wallet = await this.getOrCreate(senderId);
    const balances = await wallet.balances();
    const [whole = "0", fraction = ""] = balances.usdc.amount.split(".");
    return BigInt(whole || "0") * 1_000_000n + BigInt((fraction + "000000").slice(0, 6));
  }

  async prepare(senderId: string, call: PlannedCall): Promise<{ transactionId: string }> {
    const wallet = await this.getOrCreate(senderId);
    const result = await EVMWallet.from(wallet).sendTransaction({ to: call.to, data: call.data, value: BigInt(call.value), options: { prepareOnly: true } });
    return { transactionId: result.transactionId };
  }

  /** Read Crossmint's record of a prepared or submitted transaction, including its UserOperation hash. */
  async transaction(senderId: string, transactionId: string): Promise<WalletTransaction> {
    const wallet = await this.getOrCreate(senderId);
    const parsed = crossmintTransactionSchema.safeParse(await wallet.transaction(transactionId));
    if (!parsed.success) throw new Error("Crossmint returned an unexpected transaction record");
    const { id, status, onChain } = parsed.data;
    return { id, status, ...(onChain.txId ? { hash: onChain.txId } : {}), userOperationHash: onChain.userOperationHash, sender: onChain.userOperation.sender };
  }

  async approve(senderId: string, transactionId: string): Promise<{ hash?: string; explorerLink?: string }> {
    const wallet = await this.getOrCreate(senderId);
    const result = await wallet.approve({ transactionId });
    const value = result as unknown as Record<string, unknown>;
    return {
      ...(typeof value.hash === "string" ? { hash: value.hash } : {}),
      ...(typeof value.explorerLink === "string" ? { explorerLink: value.explorerLink } : {}),
    };
  }
}
