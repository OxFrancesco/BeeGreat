import { z } from "zod";
import { decodeFunctionData, erc20Abi, formatEther, parseAbi } from "viem";

const address = z.string().regex(/^0x[0-9a-fA-F]{40}$/).transform((value) => value as `0x${string}`);
const uint = z.string().regex(/^(0|[1-9]\d*)$/).max(78).refine((value) => BigInt(value) < 2n ** 256n, "Value exceeds uint256");
const hex = z.string().regex(/^0x(?:[0-9a-fA-F]{2})*$/);
const hash = z.string().regex(/^0x[0-9a-fA-F]{64}$/);
export const safeTransactionSchema = z.strictObject({ chainId: z.literal(8453), safe: address, to: address, value: uint, data: hex, nonce: uint, hash });
export const safeOwnerChangeSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("add"), owner: address, threshold: z.number().int().min(1).max(32) }),
  z.strictObject({ kind: z.literal("remove"), owner: address, threshold: z.number().int().min(1).max(32) }),
  z.strictObject({ kind: z.literal("threshold"), threshold: z.number().int().min(1).max(32) }),
]);
export const safeParameterSchemas = {
  safe_create: z.strictObject({ owners: z.array(address).min(1).max(32), threshold: z.number().int().min(1).max(32), saltNonce: uint }),
  safe_approve: z.strictObject({ transaction: safeTransactionSchema }),
  safe_execute: z.strictObject({ transaction: safeTransactionSchema }),
};
export const safeReadSchemas = {
  "safe-info": z.strictObject({ safe: address }),
  "safe-propose": z.strictObject({ safe: address, to: address, value: uint, data: hex }),
  "safe-approvals": z.strictObject({ transaction: safeTransactionSchema }),
  "safe-cancel-propose": z.strictObject({ safe: address }),
  "safe-owner-propose": z.strictObject({ safe: address, change: safeOwnerChangeSchema }),
};
export type SafeReadCommand = keyof typeof safeReadSchemas;

const ownerAbi = parseAbi([
  "function addOwnerWithThreshold(address owner,uint256 threshold)",
  "function removeOwner(address previousOwner,address owner,uint256 threshold)",
  "function changeThreshold(uint256 threshold)",
]);

export function safeCallDescription(transaction: z.infer<typeof safeTransactionSchema>) {
  if (transaction.data === "0x") return { kind: "plain", text: transaction.to.toLowerCase() === transaction.safe.toLowerCase() && transaction.value === "0"
    ? "cancel other transactions at the current wallet nonce"
    : `send ${formatEther(BigInt(transaction.value))} ETH to ${transaction.to}` } as const;
  const data = hex.transform((value) => value as `0x${string}`).parse(transaction.data);
  if (transaction.to.toLowerCase() === transaction.safe.toLowerCase()) {
    if (transaction.value !== "0") throw new Error("Owner changes must not send ETH");
    const call = decodeFunctionData({ abi: ownerAbi, data });
    switch (call.functionName) {
      case "addOwnerWithThreshold": return { kind: "plain", text: `add owner ${call.args[0]} and require ${call.args[1]} approvals` } as const;
      case "removeOwner": return { kind: "plain", text: `remove owner ${call.args[1]} and require ${call.args[2]} approvals` } as const;
      case "changeThreshold": return { kind: "plain", text: `change the required approvals to ${call.args[0]}` } as const;
    }
  }
  const call = decodeFunctionData({ abi: erc20Abi, data });
  if (call.functionName === "transfer" || call.functionName === "approve") {
    if (transaction.value !== "0") throw new Error("Token calls must not send ETH");
    return { kind: "token", action: call.functionName, recipient: call.args[0], amount: call.args[1] } as const;
  }
  throw new Error("Pecu currently reviews Safe native transfers, token transfers, token allowances, cancellation and owner changes. Use evmSDK for other Safe contract calls.");
}

export function safeTransactionSummary(verb: string, transaction: z.infer<typeof safeTransactionSchema>, action: string): string {
  return `${verb} organization wallet ${transaction.safe} to ${action}.`;
}
