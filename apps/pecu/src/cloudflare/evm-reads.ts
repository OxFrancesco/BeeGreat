import { createPublicClient, erc20Abi, http } from "viem";
import { base } from "viem/chains";
import { z } from "zod";
import { knownTokenMetadata } from "../token-metadata";
import type { EvmRequest, EvmResponse } from "./evm-protocol";

const address = z.templateLiteral(["0x", z.string()]).refine((value) => /^0x[\da-f]{40}$/i.test(value), "Invalid address");
const chain = z.object({ chainId: z.literal(8453) });
const balanceInput = chain.extend({ address });
const tokenInput = balanceInput.extend({ token: address });
const allowanceInput = chain.extend({ account: address, token: address, spender: address });

export function evmReadClient(rpcUrl: string) {
  return createPublicClient({ chain: base, transport: http(rpcUrl, { timeout: 10_000, retryCount: 1, fetchOptions: { redirect: "manual" } }) });
}

/** Small, pinned-block reads avoid booting a CLI process and its journal. */
export async function runEvmRead(client: Pick<ReturnType<typeof evmReadClient>, "getChainId" | "getBlockNumber" | "getBalance" | "readContract">, request: EvmRequest): Promise<EvmResponse | undefined> {
  if (!["balance", "token", "allowance"].includes(request.command)) return undefined;
  if (request.input.chainId !== 8453) return { ok: false, error: { code: "ChainMismatch", message: "Only Base mainnet (chainId 8453) is supported", retryable: false } };
  try {
    const input = (request.command === "allowance" ? allowanceInput : request.command === "token" ? tokenInput : balanceInput).parse(request.input);
    const [chainId, blockNumber] = await Promise.all([client.getChainId(), client.getBlockNumber({ cacheTime: 0 })]);
    if (chainId !== 8453) return { ok: false, error: { code: "ChainMismatch", message: "The RPC endpoint is not connected to Base mainnet", retryable: false } };
    const block = blockNumber.toString();
    if (request.command === "balance" && "address" in input) {
      const balanceWei = await client.getBalance({ address: input.address, blockNumber });
      return { ok: true, result: { chainId: 8453, address: input.address, balanceWei: balanceWei.toString(), block } };
    }
    if (request.command === "allowance" && "account" in input) {
      const amount = await client.readContract({ address: input.token, abi: erc20Abi, functionName: "allowance", args: [input.account, input.spender], blockNumber });
      return { ok: true, result: { chainId: 8453, account: input.account, token: input.token, spender: input.spender, amount: amount.toString(), block } };
    }
    if ("token" in input && "address" in input) {
      const token = tokenInput.parse(input);
      const metadata = knownTokenMetadata(token.token);
      const [amount, symbol, decimals] = await Promise.all([
        client.readContract({ address: token.token, abi: erc20Abi, functionName: "balanceOf", args: [token.address], blockNumber }),
        metadata?.symbol ?? client.readContract({ address: token.token, abi: erc20Abi, functionName: "symbol", blockNumber }),
        metadata?.decimals ?? client.readContract({ address: token.token, abi: erc20Abi, functionName: "decimals", blockNumber }),
      ]);
      return { ok: true, result: { chainId: 8453, address: input.address, token: input.token, amount: amount.toString(), symbol, decimals, block } };
    }
    throw new Error("Invalid read");
  } catch (error) {
    if (error instanceof z.ZodError) return { ok: false, error: { code: "InvalidInput", message: "Invalid Base read parameters", retryable: false } };
    // viem errors contain the RPC URL, request body and sometimes provider credentials.
    return { ok: false, error: { code: "RpcReadFailed", message: "Could not read Base. Please try again shortly.", retryable: true } };
  }
}
