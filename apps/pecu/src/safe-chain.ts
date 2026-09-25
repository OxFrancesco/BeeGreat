import { decodeFunctionResult, encodeFunctionData, erc20Abi, getAddress, keccak256, multicall3Abi, parseAbi, recoverAddress, toBytes, type Abi } from "viem";
import { z } from "zod";
import type { JsonRpc } from "./receipt";

type Address = `0x${string}`;

const multicall = "0xcA11bde05977b3631167028862bE2a173976CA11";
const sentinel = "0x0000000000000000000000000000000000000001";
export const allowanceModule: Address = "0xAA46724893dedD72658219405185Fb0Fc91e091C";
const knownModules = new Map<string, string>([
  [allowanceModule.toLowerCase(), "Spending limits"],
  ["0x75cf11467937ce3f2f357ce24ffc3dbf8fd5c226", "Sponsored transactions"],
]);
const executionSuccess = keccak256(toBytes("ExecutionSuccess(bytes32,uint256)"));
const executionFailure = keccak256(toBytes("ExecutionFailure(bytes32,uint256)"));

const safeAbi = parseAbi([
  "function getOwners() view returns (address[])",
  "function getThreshold() view returns (uint256)",
  "function nonce() view returns (uint256)",
  "function getModulesPaginated(address start,uint256 pageSize) view returns (address[] array,address next)",
  "function approvedHashes(address owner,bytes32 hash) view returns (uint256)",
]);
const ethBalanceAbi = parseAbi(["function getEthBalance(address addr) view returns (uint256 balance)"]);
const allowanceAbi = parseAbi([
  "function getDelegates(address safe,uint48 start,uint8 pageSize) view returns (address[] results,uint48 next)",
  "function getTokens(address safe,address delegate) view returns (address[])",
  "function getTokenAllowance(address safe,address delegate,address token) view returns (uint256[5])",
]);

type Call = Readonly<{ target: Address; abi: Abi; functionName: string; args?: readonly unknown[] }>;

export type SafeState =
  | Readonly<{ deployed: false }>
  | Readonly<{ deployed: true; owners: Address[]; threshold: number; nonce: string; modules: Address[] }>;

export type TokenInfo = Readonly<{ symbol: string; token: Address | null; decimals: number }>;
export type TokenBalance = TokenInfo & Readonly<{ amount: bigint }>;
export type Budget = Readonly<{ delegate: Address; token: Address; amount: bigint; spent: bigint; resetMinutes: number }>;
export type ExecutionCheck = "pending" | "executed" | "failed" | "unrelated";

const hexData = z.templateLiteral(["0x", z.string().regex(/^(?:[0-9a-fA-F]{2})*$/)]);
const receiptSchema = z.object({
  status: z.enum(["0x0", "0x1"]),
  logs: z.array(z.object({ address: z.string(), topics: z.array(z.string()) })),
}).nullable();
const transactionSchema = z.object({ to: z.string().nullable(), input: z.string() }).nullable();
const logsSchema = z.array(z.object({ transactionHash: z.templateLiteral(["0x", z.string().regex(/^[0-9a-fA-F]{64}$/)]) }));

export function moduleName(address: string): string {
  return knownModules.get(address.toLowerCase()) ?? "Module";
}

/**
 * Direct Base reads for the profile page. Everything goes through Multicall3 in
 * one eth_call, so a page load costs a few RPC requests. These reads only
 * display state; every transaction still passes through evmSDK and Pecu's plan
 * validation before anyone can confirm it.
 */
export class SafeChain {
  constructor(private readonly rpc: JsonRpc) {}

  private async read(calls: readonly Call[]): Promise<Array<{ ok: true; value: unknown } | { ok: false }>> {
    if (!calls.length) return [];
    const data = encodeFunctionData({
      abi: multicall3Abi,
      functionName: "aggregate3",
      args: [calls.map((call) => ({ target: call.target, allowFailure: true, callData: encodeFunctionData({ abi: call.abi, functionName: call.functionName, args: call.args ?? [] }) }))],
    });
    const raw = hexData.parse(await this.rpc("eth_call", [{ to: multicall, data }, "latest"]));
    const results = decodeFunctionResult({ abi: multicall3Abi, functionName: "aggregate3", data: raw });
    return results.map((result, index) => {
      const call = calls[index]!;
      if (!result.success || result.returnData === "0x") return { ok: false };
      try {
        return { ok: true, value: decodeFunctionResult({ abi: call.abi, functionName: call.functionName, data: result.returnData }) };
      } catch {
        return { ok: false };
      }
    });
  }

  async blockNumber(): Promise<string> {
    return BigInt(z.string().parse(await this.rpc("eth_blockNumber", []))).toString();
  }

  async safeState(safe: Address): Promise<SafeState> {
    const code = hexData.parse(await this.rpc("eth_getCode", [safe, "latest"]));
    if (code === "0x") return { deployed: false };
    const [owners, threshold, nonce, modules] = await this.read([
      { target: safe, abi: safeAbi, functionName: "getOwners" },
      { target: safe, abi: safeAbi, functionName: "getThreshold" },
      { target: safe, abi: safeAbi, functionName: "nonce" },
      { target: safe, abi: safeAbi, functionName: "getModulesPaginated", args: [sentinel, 32n] },
    ]);
    if (!owners?.ok || !threshold?.ok || !nonce?.ok || !modules?.ok) throw new Error("Couldn't read this Safe on Base. Try again.");
    const moduleList = z.tuple([z.array(z.string()), z.string()]).parse(modules.value)[0];
    return {
      deployed: true,
      owners: z.array(z.string()).parse(owners.value).map((owner) => getAddress(owner)),
      threshold: Number(z.bigint().parse(threshold.value)),
      nonce: z.bigint().parse(nonce.value).toString(),
      modules: moduleList.map((module) => getAddress(module)),
    };
  }

  /** Owners who called approveHash, per proposal hash. */
  async approvals(safe: Address, owners: readonly Address[], hashes: readonly Address[]): Promise<Map<string, Address[]>> {
    const pairs = hashes.flatMap((hash) => owners.map((owner) => ({ hash, owner })));
    const results = await this.read(pairs.map(({ owner, hash }) => ({ target: safe, abi: safeAbi, functionName: "approvedHashes", args: [owner, hash] })));
    const approved = new Map<string, Address[]>(hashes.map((hash) => [hash.toLowerCase(), []]));
    results.forEach((result, index) => {
      const pair = pairs[index]!;
      if (result.ok && z.bigint().parse(result.value) !== 0n) approved.get(pair.hash.toLowerCase())?.push(pair.owner);
    });
    return approved;
  }

  async tokens(addresses: readonly Address[]): Promise<Map<string, TokenInfo>> {
    const results = await this.read(addresses.flatMap((token) => [
      { target: token, abi: erc20Abi, functionName: "symbol" },
      { target: token, abi: erc20Abi, functionName: "decimals" },
    ]));
    const info = new Map<string, TokenInfo>();
    addresses.forEach((token, index) => {
      const symbol = results[index * 2];
      const decimals = results[index * 2 + 1];
      if (symbol?.ok && decimals?.ok) info.set(token.toLowerCase(), { token, symbol: z.string().max(32).parse(symbol.value), decimals: Number(decimals.value) });
    });
    return info;
  }

  async balances(holder: Address, tokens: readonly TokenInfo[]): Promise<TokenBalance[]> {
    const results = await this.read(tokens.map((token) => token.token === null
      ? { target: multicall, abi: ethBalanceAbi, functionName: "getEthBalance", args: [holder] }
      : { target: token.token, abi: erc20Abi, functionName: "balanceOf", args: [holder] }));
    return tokens.map((token, index) => {
      const result = results[index];
      if (!result?.ok) throw new Error(`Couldn't read the ${token.symbol} balance. Try again.`);
      return { ...token, amount: z.bigint().parse(result.value) };
    });
  }

  async budgets(safe: Address): Promise<Budget[]> {
    const [delegates] = await this.read([{ target: allowanceModule, abi: allowanceAbi, functionName: "getDelegates", args: [safe, 0, 50] }]);
    if (!delegates?.ok) return [];
    const delegateList = z.tuple([z.array(z.string()), z.number()]).parse(delegates.value)[0].map((delegate) => getAddress(delegate));
    const tokenLists = await this.read(delegateList.map((delegate) => ({ target: allowanceModule, abi: allowanceAbi, functionName: "getTokens", args: [safe, delegate] })));
    const pairs = delegateList.flatMap((delegate, index) => {
      const tokens = tokenLists[index];
      return tokens?.ok ? z.array(z.string()).parse(tokens.value).map((token) => ({ delegate, token: getAddress(token) })) : [];
    });
    const allowances = await this.read(pairs.map(({ delegate, token }) => ({ target: allowanceModule, abi: allowanceAbi, functionName: "getTokenAllowance", args: [safe, delegate, token] })));
    return pairs.flatMap((pair, index) => {
      const result = allowances[index];
      if (!result?.ok) return [];
      const [amount, spent, reset] = z.array(z.bigint()).length(5).parse(result.value);
      return amount === 0n && spent === 0n ? [] : [{ ...pair, amount: amount!, spent: spent!, resetMinutes: Number(reset) }];
    });
  }

  /** Whether a Base transaction executed this exact Safe transaction. */
  async execution(safe: Address, transaction: Address, safeTxHash: Address): Promise<ExecutionCheck> {
    const receipt = receiptSchema.parse(await this.rpc("eth_getTransactionReceipt", [transaction]));
    if (!receipt) return "pending";
    const events = receipt.logs.filter((log) => log.address.toLowerCase() === safe.toLowerCase() && log.topics[1]?.toLowerCase() === safeTxHash.toLowerCase());
    if (events.some((log) => log.topics[0]?.toLowerCase() === executionSuccess)) return "executed";
    if (receipt.status === "0x0" || events.some((log) => log.topics[0]?.toLowerCase() === executionFailure)) return "failed";
    return "unrelated";
  }

  async transaction(hash: Address): Promise<{ to: Address | null; input: string } | null> {
    const found = transactionSchema.parse(await this.rpc("eth_getTransactionByHash", [hash]));
    return found ? { to: found.to ? getAddress(found.to) : null, input: found.input } : null;
  }

  async findExecution(safe: Address, safeTxHash: Address, fromBlock: string): Promise<Address | null> {
    const logs = logsSchema.parse(await this.rpc("eth_getLogs", [{ address: safe, topics: [executionSuccess, safeTxHash], fromBlock: `0x${BigInt(fromBlock).toString(16)}`, toBlock: "latest" }]));
    const found = logs.at(-1)?.transactionHash;
    return found ?? null;
  }
}

/** Recover the signer of an EIP-712 SafeTx signature, normalizing v from 0/1 to 27/28. */
export async function safeSigner(hash: Address, signature: string): Promise<{ signer: Address; signature: Address }> {
  const v = Number.parseInt(signature.slice(-2), 16);
  const normalized = hexData.parse(v < 27 ? `${signature.slice(0, -2)}${(v + 27).toString(16)}` : signature);
  if (![27, 28].includes(Number.parseInt(normalized.slice(-2), 16))) throw new Error("This signature format isn't supported. Sign with an ordinary wallet account.");
  return { signer: getAddress(await recoverAddress({ hash, signature: normalized })), signature: normalized };
}

export const nativeToken: TokenInfo = { symbol: "ETH", token: null, decimals: 18 };
