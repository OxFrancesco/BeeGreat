import { expect, test } from "bun:test";
import * as Schema from "effect/Schema";
import { createClerkClient } from "@clerk/backend";
import {
  CrossmintWallets,
  EVMWallet,
  createCrossmint,
} from "@crossmint/wallets-sdk";
import {
  BaseChain,
  createSugarFailoverTransport,
  withdrawalFromPosition,
  type LiquidityPool,
  type Position,
  type UnsignedTransaction,
} from "@beegreat/sugar";
import {
  createPublicClient,
  formatEther,
  formatUnits,
  parseUnits,
  type Address,
  type Hash,
} from "viem";
import { base } from "viem/chains";
import { dirname, resolve } from "node:path";
import { appendFile, mkdir } from "node:fs/promises";
import {
  prepareAndApproveCrossmintBatch,
  type SugarTransactionStep,
} from "../convex/web3Execution";

const LIVE = process.env.RUN_BASE_MAINNET_E2E === "1";
const liveTest = LIVE ? test : test.skip;

const BASE_CHAIN_ID = 8453;
const DEFAULT_BUDGET_USD = 5;
const ETH_TO_AERO_USD = 2.65;
const LIQUIDITY_AERO_USD = 1.55;
const VENFT_USD = 1;
const VENFT_LOCK_SECONDS = 4 * 7 * 24 * 60 * 60;
const TARGET_POOL: Address = "0x7f670f78B17dEC44d5Ef68a48740b6f8849cc2e6";
const BACKEND_ROOT = resolve(import.meta.dir, "..");
const REPO_ROOT = resolve(BACKEND_ROOT, "../..");
const CONVEX_CLI = resolve(BACKEND_ROOT, "node_modules/convex/bin/main.js");
const CLERK_ENV_FILE = resolve(REPO_ROOT, "apps/web/.env.local");
const DEFAULT_CLERK_QUERY = "Francesco Oddo";
const IRREVERSIBLE_ACK = "create-real-venft-on-base";
const UNESTIMATABLE_BATCH_CALL_GAS = 1_500_000n;

type TransactionRecord = {
  action: string;
  transactionId: string;
  hash: Hash;
  explorerLink: string;
  valueWei: string;
};

const cachedWalletsSchema = Schema.Array(
  Schema.Struct({
    address: Schema.TemplateLiteral([Schema.Literal("0x"), Schema.String]),
    chain: Schema.String,
    kind: Schema.String,
  }),
);
const decodeCachedWallets = Schema.decodeUnknownSync(cachedWalletsSchema);

type JournalEvent =
  | {
      event: "started";
      budgetUsd: number;
      recoverOnly: boolean;
      reusedVeNftId: string | null;
    }
  | {
      event: "prepared";
      action: string;
      callCount: number;
      roles: Array<"approval" | "action">;
      transactionId: string;
      valueWei: string;
      estimatedGas: string;
    }
  | {
      event: "confirmed";
      action: string;
      callCount: number;
      transactionId: string;
      hash: Hash;
      gasUsed: string;
      effectiveGasPrice: string;
    }
  | { event: "failed"; error: string }
  | {
      event: "completed";
      netEthSpentWei: string;
      submittedValueWei: string;
      paidGasWei: string;
      veNftId: string | null;
    };

function invariant<Condition>(
  condition: Condition,
  message: string,
): asserts condition {
  if (!condition) throw new Error(message);
}

function isHexAddress(value: string): value is Address {
  return /^0x[0-9a-fA-F]{40}$/.test(value);
}

function isTransactionHash(value: string): value is Hash {
  return /^0x[0-9a-fA-F]{64}$/.test(value);
}

function sameAddress(a: string, b: string) {
  return a.toLowerCase() === b.toLowerCase();
}

function unitsForUsd(usd: number, priceUsd: number, decimals: number) {
  invariant(
    Number.isFinite(priceUsd) && priceUsd > 0,
    "On-chain USD price must be positive",
  );
  return parseUnits((usd / priceUsd).toFixed(decimals), decimals);
}

function readEnvFileValue(text: string, name: string) {
  const line = text
    .split(/\r?\n/)
    .find((candidate) => candidate.startsWith(`${name}=`));
  if (!line) return undefined;
  const raw = line.slice(name.length + 1).trim();
  if (
    (raw.startsWith('"') && raw.endsWith('"')) ||
    (raw.startsWith("'") && raw.endsWith("'"))
  ) {
    return raw.slice(1, -1);
  }
  return raw;
}

async function runConvexCli(
  args: string[],
  options: { sensitiveOutput?: boolean } = {},
) {
  const process = Bun.spawn(["bun", CONVEX_CLI, ...args], {
    cwd: BACKEND_ROOT,
    stdout: "pipe",
    stderr: "pipe",
  });
  const timeout = setTimeout(() => process.kill(), 30_000);
  const [exitCode, stdout, stderr] = await Promise.all([
    process.exited,
    new Response(process.stdout).text(),
    new Response(process.stderr).text(),
  ]).finally(() => clearTimeout(timeout));
  if (exitCode !== 0) {
    const detail = options.sensitiveOutput ? "" : ` ${stderr.trim()}`;
    throw new Error(`Convex CLI failed (${args[0] ?? "unknown"}).${detail}`);
  }
  return stdout.trim();
}

async function convexEnv(name: string) {
  const value = await runConvexCli(["env", "get", name], {
    sensitiveOutput: true,
  });
  invariant(value.length > 0, `${name} is not configured in Convex`);
  return value;
}

async function clerkSecret() {
  try {
    return await convexEnv("CLERK_SECRET_KEY");
  } catch {
    const text = await Bun.file(CLERK_ENV_FILE).text();
    const value = readEnvFileValue(text, "CLERK_SECRET_KEY");
    invariant(
      value,
      "CLERK_SECRET_KEY is missing from Convex and apps/web/.env.local",
    );
    return value;
  }
}

async function resolveClerkUserId() {
  const override = process.env.BEE_MAINNET_USER_ID?.trim();
  if (override) return override;

  const query =
    process.env.BEE_MAINNET_CLERK_QUERY?.trim() || DEFAULT_CLERK_QUERY;
  const clerk = createClerkClient({ secretKey: await clerkSecret() });
  const result = await clerk.users.getUserList({ query, limit: 50 });
  const wanted = query.toLowerCase().split(/\s+/).sort().join(" ");
  const matches = result.data.filter(
    (user) =>
      [user.firstName, user.lastName]
        .filter((part): part is string => Boolean(part))
        .join(" ")
        .toLowerCase()
        .split(/\s+/)
        .sort()
        .join(" ") === wanted,
  );
  invariant(
    matches.length === 1,
    `Expected one exact Clerk user for "${query}", found ${matches.length}`,
  );
  return matches[0].id;
}

async function cachedBaseWallet(userId: string) {
  const source = [
    `const userId=${JSON.stringify(userId)};`,
    'const rows=await ctx.db.query("wallets").withIndex("by_user",q=>q.eq("userId",userId)).take(20);',
    'return rows.map(({chain,address,kind})=>({chain,address,kind:kind??"crossmint"}));',
  ].join(" ");
  const output = await runConvexCli([
    "run",
    "--inline-query",
    source,
    "--typecheck",
    "disable",
  ]);
  const rows = decodeCachedWallets(JSON.parse(output));
  const matches = rows.filter(
    (wallet) => wallet.chain === "base" && wallet.kind === "crossmint",
  );
  invariant(
    matches.length === 1,
    `Expected one cached Base Crossmint wallet, found ${matches.length}`,
  );
  return matches[0];
}

function hasPositionBalance(position: Position | undefined) {
  return (position?.liquidity ?? 0n) > 0n || (position?.staked ?? 0n) > 0n;
}

liveTest(
  "executes and unwinds the Base Aerodrome lifecycle with the Francesco Oddo Crossmint wallet",
  async () => {
    const budgetUsd = Number(
      process.env.BEE_MAINNET_BUDGET_USD ?? DEFAULT_BUDGET_USD,
    );
    invariant(
      Number.isFinite(budgetUsd) &&
        budgetUsd > 0 &&
        budgetUsd <= DEFAULT_BUDGET_USD,
      `BEE_MAINNET_BUDGET_USD must be greater than 0 and at most ${DEFAULT_BUDGET_USD}`,
    );
    invariant(
      ETH_TO_AERO_USD + LIQUIDITY_AERO_USD < budgetUsd,
      "The planned ETH transaction value must leave room under the total budget for Base gas",
    );

    const [userId, apiKey, signerSecret, rpcUrl] = await Promise.all([
      resolveClerkUserId(),
      convexEnv("CROSSMINT_API_KEY"),
      convexEnv("CROSSMINT_SIGNER_SECRET"),
      convexEnv("SUGAR_RPC_URI_8453"),
    ]);
    invariant(
      apiKey.startsWith("sk_production"),
      "Crossmint must use a production key for Base mainnet",
    );

    const cached = await cachedBaseWallet(userId);
    const crossmint = createCrossmint({ apiKey });
    const wallets = CrossmintWallets.from(crossmint);
    const locator = `userId:${userId}:evm:smart`;
    const wallet = await wallets.getWallet(locator, { chain: "base" });
    await wallet.useSigner({ type: "server", secret: signerSecret });
    const walletAddress = wallet.address;
    invariant(
      isHexAddress(walletAddress),
      "Crossmint returned a malformed wallet address",
    );
    invariant(
      sameAddress(walletAddress, cached.address),
      "The Clerk-owned Crossmint wallet does not match the Base address cached in Convex",
    );
    const expectedAddress = process.env.BEE_MAINNET_WALLET_ADDRESS?.trim();
    invariant(
      expectedAddress && /^0x[0-9a-fA-F]{40}$/.test(expectedAddress),
      "BEE_MAINNET_WALLET_ADDRESS is required for every live run",
    );
    invariant(
      sameAddress(wallet.address, expectedAddress),
      "The resolved wallet does not match BEE_MAINNET_WALLET_ADDRESS",
    );
    const reusedVeNftId = process.env.BEE_MAINNET_REUSE_VENFT_ID?.trim();
    const recoverOnly = process.env.BEE_MAINNET_RECOVER_ONLY === "1";
    if (recoverOnly) {
      invariant(
        reusedVeNftId,
        "BEE_MAINNET_REUSE_VENFT_ID is required for a recovery-only run",
      );
    }
    if (!reusedVeNftId) {
      invariant(
        process.env.BEE_MAINNET_IRREVERSIBLE_ACK === IRREVERSIBLE_ACK,
        `Creating a real veNFT requires BEE_MAINNET_IRREVERSIBLE_ACK=${IRREVERSIBLE_ACK}`,
      );
    } else {
      invariant(
        /^\d+$/.test(reusedVeNftId),
        "BEE_MAINNET_REUSE_VENFT_ID must be a decimal token id",
      );
    }

    const transport = createSugarFailoverTransport([rpcUrl], {
      minIntervalMs: 750,
    });
    // Every read, simulation, receipt, and quote stays on one authenticated
    // endpoint so a confirmed approval cannot be followed by stale state.
    const publicClient = createPublicClient({
      chain: base,
      transport,
    });
    const sugar = new BaseChain({
      account: walletAddress,
      transport,
      settings: {
        poolPaginationTargetCalls: 45,
        quoteMaxPaths: 64,
        requestConcurrency: 2,
        requestTimeoutMs: 45_000,
      },
      rpcPolicy: {
        baseDelayMs: 1_000,
        deadlineMs: 480_000,
        maxRetries: 5,
      },
    });
    const evmWallet = EVMWallet.from(wallet);
    const transactions: TransactionRecord[] = [];
    let submittedValue = 0n;
    let paidGasWei = 0n;
    let budgetWei = 0n;
    let startEth = 0n;
    let createdVeNftId: bigint | undefined;
    let mutationStarted = false;
    let cleanupCompleted = false;
    let mainError: unknown;
    let targetPool: LiquidityPool | undefined;
    const journalPath =
      process.env.BEE_MAINNET_JOURNAL_PATH?.trim() ||
      resolve(BACKEND_ROOT, ".artifacts/base-mainnet", `${Date.now()}.jsonl`);
    await mkdir(dirname(journalPath), { recursive: true });
    const journal = async (event: JournalEvent) => {
      await appendFile(
        journalPath,
        `${JSON.stringify({
          at: new Date().toISOString(),
          chainId: BASE_CHAIN_ID,
          wallet: wallet.address,
          ...event,
        })}\n`,
        { mode: 0o600 },
      );
    };
    await journal({
      event: "started",
      budgetUsd,
      recoverOnly,
      reusedVeNftId: reusedVeNftId ?? null,
    });

    const executePlan = async (
      action: string,
      plan: UnsignedTransaction[],
      countValue = true,
      forcedRole?: "approval" | "action",
    ) => {
      invariant(
        plan.length > 0,
        `${action} produced an empty transaction plan`,
      );
      const totalValue = plan.reduce(
        (total, step) => total + (step.value ?? 0n),
        0n,
      );
      let estimatedGas = 0n;
      for (const step of plan) {
        const value = step.value ?? 0n;
        try {
          estimatedGas += await publicClient.estimateGas({
            account: walletAddress,
            to: step.to,
            data: step.data,
            value,
          });
        } catch (error) {
          // A later call can depend on an earlier approval in the same atomic
          // batch, so standalone eth_estimateGas may correctly revert. Reserve
          // a conservative ceiling; Crossmint still simulates the full batch.
          if (plan.length === 1) throw error;
          estimatedGas += UNESTIMATABLE_BATCH_CALL_GAS;
        }
      }
      const gasPrice = await publicClient.getGasPrice();
      const nextSubmittedValue =
        submittedValue + (countValue ? totalValue : 0n);
      invariant(
        nextSubmittedValue + paidGasWei + estimatedGas * gasPrice <= budgetWei,
        `${action} would exceed the gas-inclusive ${budgetUsd} USD ETH budget`,
      );
      const steps: SugarTransactionStep[] = plan.map((step, index) => ({
        role:
          forcedRole ?? (index === plan.length - 1 ? "action" : "approval"),
        transaction: {
          to: step.to,
          data: step.data,
          value: (step.value ?? 0n).toString(),
        },
      }));
      submittedValue = nextSubmittedValue;
      mutationStarted = true;
      const result = await prepareAndApproveCrossmintBatch({
        wallet: evmWallet,
        steps,
        onPrepared: async (transactionId) => {
          await journal({
            event: "prepared",
            action,
            callCount: steps.length,
            roles: steps.map(({ role }) => role),
            transactionId,
            valueWei: totalValue.toString(),
            estimatedGas: estimatedGas.toString(),
          });
        },
      });
      invariant(
        isTransactionHash(result.hash),
        `${action} returned no transaction hash`,
      );
      const hash = result.hash;
      const receipt = await publicClient.waitForTransactionReceipt({
        hash,
        confirmations: 1,
        timeout: 120_000,
      });
      invariant(receipt.status === "success", `Transaction ${hash} reverted`);
      paidGasWei += receipt.gasUsed * receipt.effectiveGasPrice;
      transactions.push({
        action,
        transactionId: result.transactionId,
        hash,
        explorerLink: result.explorerLink ?? `https://basescan.org/tx/${hash}`,
        valueWei: totalValue.toString(),
      });
      await journal({
        event: "confirmed",
        action,
        callCount: steps.length,
        transactionId: result.transactionId,
        hash,
        gasUsed: receipt.gasUsed.toString(),
        effectiveGasPrice: receipt.effectiveGasPrice.toString(),
      });
      console.log(`[base-mainnet] ${action} (${steps.length} calls): ${hash}`);
    };

    const executeFreshErc20Swap = async (
      action: string,
      from: typeof BaseChain.aero,
      to: typeof BaseChain.eth,
      slippage: number,
    ) => {
      const balance = await sugar.getTokenBalance(from);
      if (balance === 0n) return;
      await executePlan(
        action,
        await sugar.swap(from, to, balance, slippage),
        false,
      );
    };

    const executeFreshPlan = async (
      action: string,
      buildPlan: () => Promise<UnsignedTransaction[]>,
      countValue = true,
    ) => {
      await executePlan(action, await buildPlan(), countValue);
    };

    const cleanup = async () => {
      const cleanupErrors: string[] = [];
      try {
        const position = await sugar.getPositionByPool(TARGET_POOL);
        if (position?.staked && position.staked > 0n) {
          await executePlan(
            "cleanup:unstake",
            await sugar.unstake(position),
            false,
          );
        }
      } catch (error) {
        cleanupErrors.push(
          `unstake: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
      try {
        const position = await sugar.getPositionByPool(TARGET_POOL);
        if (position?.liquidity && position.liquidity > 0n) {
          await executeFreshPlan(
            "cleanup:withdraw",
            async () => {
              const current = await sugar.getPositionByPool(TARGET_POOL);
              invariant(
                current?.liquidity && current.liquidity > 0n,
                "Cleanup position disappeared",
              );
              return sugar.withdraw(
                withdrawalFromPosition(current),
                30,
                0.03,
                true,
                true,
              );
            },
            false,
          );
        }
      } catch (error) {
        cleanupErrors.push(
          `withdraw: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
      try {
        await executeFreshErc20Swap(
          "cleanup:swap AERO to ETH",
          BaseChain.aero,
          BaseChain.eth,
          0.03,
        );
      } catch (error) {
        cleanupErrors.push(
          `swap: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
      if (targetPool) {
        const allowanceCleanups: Array<
          [string, () => Promise<UnsignedTransaction[]>]
        > = [
          [
            "AERO router",
            () =>
              sugar.revokeTokenAllowance(
                BaseChain.aero,
                sugar.settings.routerContractAddress,
              ),
          ],
          ["AERO Permit2", () => sugar.revokePermit2Allowance(BaseChain.aero)],
          [
            "LP gauge",
            () =>
              sugar.revokeTokenAllowance(
                {
                  ...targetPool!.token0,
                  tokenAddress: targetPool!.lp,
                  symbol: targetPool!.symbol,
                  decimals: targetPool!.decimals,
                },
                targetPool!.gauge,
              ),
          ],
          [
            "LP router",
            () =>
              sugar.revokeTokenAllowance(
                {
                  ...targetPool!.token0,
                  tokenAddress: targetPool!.lp,
                  symbol: targetPool!.symbol,
                  decimals: targetPool!.decimals,
                },
                sugar.settings.routerContractAddress,
              ),
          ],
        ];
        try {
          const { votingEscrow } = await sugar.getVeNftContracts();
          allowanceCleanups.push([
            "AERO voting escrow",
            () => sugar.revokeTokenAllowance(BaseChain.aero, votingEscrow),
          ]);
        } catch (error) {
          cleanupErrors.push(
            `veNFT allowance lookup: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
        for (const [label, build] of allowanceCleanups) {
          try {
            const plan = await build();
            if (plan.length > 0) {
              await executePlan(
                `cleanup:revoke ${label}`,
                plan,
                false,
                "approval",
              );
            }
          } catch (error) {
            cleanupErrors.push(
              `revoke ${label}: ${error instanceof Error ? error.message : String(error)}`,
            );
          }
        }
      }
      if (cleanupErrors.length > 0) {
        throw new Error(
          `Mainnet cleanup was incomplete: ${cleanupErrors.join(" | ")}`,
        );
      }
    };

    try {
      const prices = await sugar.getPrices([
        BaseChain.eth,
        BaseChain.aero,
        BaseChain.usdc,
      ]);
      const ethPrice = prices.find(
        (price) => price.token.symbol === "ETH",
      )?.price;
      const aeroPrice = prices.find(
        (price) => price.token.symbol === "AERO",
      )?.price;
      invariant(
        ethPrice && aeroPrice,
        "Aerodrome oracle did not return ETH and AERO prices",
      );
      budgetWei = unitsForUsd(budgetUsd, ethPrice, 18);

      const [loadedPool, initialPosition, initialVeNfts, initialAero] =
        await Promise.all([
          sugar.getPoolByAddress(TARGET_POOL),
          sugar.getPositionByPool(TARGET_POOL),
          reusedVeNftId
            ? sugar
                .getVeNft(BigInt(reusedVeNftId))
                .then((veNft) => (veNft ? [veNft] : []))
            : sugar.getVeNfts(),
          sugar.getTokenBalance(BaseChain.aero),
        ]);
      invariant(
        loadedPool,
        `Target Aerodrome pool ${TARGET_POOL} was not found`,
      );
      const pool = loadedPool;
      targetPool = pool;
      invariant(
        !pool.isCl && !pool.isStable,
        "Target pool must be a basic volatile pool",
      );
      invariant(pool.gaugeAlive, "Target pool gauge is not active");
      invariant(
        [pool.token0.symbol, pool.token1.symbol].includes("AERO") &&
          [pool.token0.symbol, pool.token1.symbol].includes("WETH"),
        "Target pool is not the expected WETH/AERO pool",
      );
      startEth = await sugar.getTokenBalance(BaseChain.eth);
      if (recoverOnly) {
        const existing = initialVeNfts.find(
          ({ id }) => id === BigInt(reusedVeNftId!),
        );
        invariant(
          existing && sameAddress(existing.owner, wallet.address),
          `veNFT ${reusedVeNftId} is not owned by the test wallet`,
        );
        createdVeNftId = existing.id;
        await cleanup();
        cleanupCompleted = true;
      } else {
        invariant(
          initialAero === 0n,
          "The wallet already has liquid AERO; use BEE_MAINNET_RECOVER_ONLY=1",
        );
        invariant(
          !hasPositionBalance(initialPosition),
          "The wallet already has a WETH/AERO position; use BEE_MAINNET_RECOVER_ONLY=1",
        );
        invariant(
          startEth >= budgetWei,
          `Wallet has ${formatEther(startEth)} ETH but the suite requires ${formatEther(budgetWei)} ETH`,
        );

        const ethSwapAmount = unitsForUsd(ETH_TO_AERO_USD, ethPrice, 18);
        await executePlan(
          "swap ETH to AERO",
          await sugar.swap(BaseChain.eth, BaseChain.aero, ethSwapAmount, 0.02),
        );
        const aeroAfterSwap = await sugar.getTokenBalance(BaseChain.aero);
        if (reusedVeNftId) {
          const existing = initialVeNfts.find(
            ({ id }) => id === BigInt(reusedVeNftId),
          );
          invariant(
            existing && sameAddress(existing.owner, wallet.address),
            `veNFT ${reusedVeNftId} is not owned by the test wallet`,
          );
          const lockedUsd =
            Number(formatUnits(existing.lockedAmount, existing.decimals)) *
            aeroPrice;
          invariant(
            lockedUsd >= VENFT_USD * 0.5 && lockedUsd <= VENFT_USD * 1.5,
            `Existing veNFT is worth approximately $${lockedUsd.toFixed(2)}, not the expected $${VENFT_USD}`,
          );
          createdVeNftId = existing.id;
        } else {
          const veNftAmount = unitsForUsd(VENFT_USD, aeroPrice, 18);
          invariant(
            aeroAfterSwap > veNftAmount,
            "ETH to AERO swap did not return enough AERO for the veNFT",
          );

          await executePlan(
            "create veNFT",
            await sugar.createVeNft(veNftAmount, VENFT_LOCK_SECONDS),
          );
          const veNftsAfterCreate = await sugar.getVeNfts();
          const initialIds = new Set(
            initialVeNfts.map((veNft) => veNft.id.toString()),
          );
          const created = veNftsAfterCreate.filter(
            (veNft) => !initialIds.has(veNft.id.toString()),
          );
          invariant(
            created.length === 1,
            `Expected one new veNFT, found ${created.length}`,
          );
          invariant(
            created[0].lockedAmount === veNftAmount,
            "New veNFT has the wrong locked AERO amount",
          );
          createdVeNftId = created[0].id;
        }

        const liquidAero = await sugar.getTokenBalance(BaseChain.aero);
        const desiredLiquidityAero = unitsForUsd(
          LIQUIDITY_AERO_USD,
          aeroPrice,
          18,
        );
        const liquidityAero =
          liquidAero < desiredLiquidityAero ? liquidAero : desiredLiquidityAero;
        invariant(
          liquidityAero > 0n,
          "No liquid AERO remains for the pool test",
        );
        await executeFreshPlan("deposit WETH/AERO liquidity", async () => {
          const depositQuote = await sugar.quoteBasicDeposit(
            pool,
            sameAddress(pool.token0.tokenAddress, BaseChain.aero.tokenAddress)
              ? { amountToken0: liquidityAero }
              : { amountToken1: liquidityAero },
          );
          return sugar.deposit(depositQuote, 30, 0.05);
        });

        let position = await sugar.getPositionByPool(TARGET_POOL);
        invariant(
          position?.liquidity && position.liquidity > 0n,
          "Liquidity position was not created",
        );
        await executeFreshPlan("stake WETH/AERO LP", async () => {
          const current = await sugar.getPositionByPool(TARGET_POOL);
          invariant(
            current?.liquidity && current.liquidity > 0n,
            "LP position disappeared before stake",
          );
          return sugar.stake(current);
        });
        position = await sugar.getPositionByPool(TARGET_POOL);
        invariant(
          position?.staked && position.staked > 0n,
          "LP position was not staked",
        );

        await executePlan(
          "claim WETH/AERO emissions",
          await sugar.claimEmissions(position),
        );
        position = await sugar.getPositionByPool(TARGET_POOL);
        invariant(
          position?.staked && position.staked > 0n,
          "Staked LP position disappeared before unstake",
        );
        await executePlan(
          "unstake WETH/AERO LP",
          await sugar.unstake(position),
        );

        position = await sugar.getPositionByPool(TARGET_POOL);
        invariant(
          position?.liquidity && position.liquidity > 0n,
          "LP position did not return after unstake",
        );
        await executePlan(
          "claim WETH/AERO fees",
          await sugar.claimFees(position),
        );
        position = await sugar.getPositionByPool(TARGET_POOL);
        invariant(
          position?.liquidity && position.liquidity > 0n,
          "LP position disappeared before withdrawal",
        );
        await executeFreshPlan("withdraw WETH/AERO liquidity", async () => {
          const current = await sugar.getPositionByPool(TARGET_POOL);
          invariant(
            current?.liquidity && current.liquidity > 0n,
            "LP position disappeared before withdrawal",
          );
          return sugar.withdraw(
            withdrawalFromPosition(current),
            30,
            0.03,
            true,
            true,
          );
        });
      }
    } catch (error) {
      mainError = error;
    } finally {
      if (mutationStarted && !cleanupCompleted) {
        try {
          await cleanup();
        } catch (cleanupError) {
          mainError = mainError
            ? new AggregateError(
                [mainError, cleanupError],
                "Mainnet lifecycle and cleanup both failed",
              )
            : cleanupError;
        }
      }
    }

    if (mainError) {
      await journal({
        event: "failed",
        error:
          mainError instanceof Error ? mainError.message : String(mainError),
      });
      throw mainError;
    }

    const [finalEth, finalAero, finalTargetPosition, finalVeNft] =
      await Promise.all([
        sugar.getTokenBalance(BaseChain.eth),
        sugar.getTokenBalance(BaseChain.aero),
        sugar.getPositionByPool(TARGET_POOL),
        createdVeNftId ? sugar.getVeNft(createdVeNftId) : undefined,
      ]);
    const spentWei = startEth > finalEth ? startEth - finalEth : 0n;

    expect(submittedValue).toBeLessThanOrEqual(budgetWei);
    expect(spentWei).toBeLessThanOrEqual(budgetWei);
    expect(finalAero).toBe(0n);
    expect(
      await sugar.balanceOf(
        sugar.settings.wrappedNativeTokenAddress,
        walletAddress,
      ),
    ).toBe(0n);
    expect(finalTargetPosition?.liquidity ?? 0n).toBe(0n);
    expect(finalTargetPosition?.staked ?? 0n).toBe(0n);
    expect(finalVeNft?.lockedAmount).toBeGreaterThan(0n);
    invariant(targetPool, "Target pool was not loaded");
    const lpToken = {
      ...targetPool.token0,
      tokenAddress: targetPool.lp,
      symbol: targetPool.symbol,
      decimals: targetPool.decimals,
    };
    const { votingEscrow } = await sugar.getVeNftContracts();
    expect(
      await sugar.revokeTokenAllowance(
        BaseChain.aero,
        sugar.settings.routerContractAddress,
      ),
    ).toHaveLength(0);
    expect(await sugar.revokePermit2Allowance(BaseChain.aero)).toHaveLength(0);
    expect(
      await sugar.revokeTokenAllowance(BaseChain.aero, votingEscrow),
    ).toHaveLength(0);
    expect(
      await sugar.revokeTokenAllowance(lpToken, targetPool.gauge),
    ).toHaveLength(0);
    expect(
      await sugar.revokeTokenAllowance(
        lpToken,
        sugar.settings.routerContractAddress,
      ),
    ).toHaveLength(0);
    await journal({
      event: "completed",
      netEthSpentWei: spentWei.toString(),
      submittedValueWei: submittedValue.toString(),
      paidGasWei: paidGasWei.toString(),
      veNftId: finalVeNft?.id.toString() ?? null,
    });

    console.log(
      JSON.stringify(
        {
          chainId: BASE_CHAIN_ID,
          wallet: wallet.address,
          budgetUsd,
          submittedValueEth: formatEther(submittedValue),
          netEthSpent: formatEther(spentWei),
          paidGasEth: formatEther(paidGasWei),
          journalPath,
          liquidAeroAfterCleanup: formatUnits(finalAero, 18),
          veNft: finalVeNft
            ? {
                id: finalVeNft.id.toString(),
                lockedAero: formatUnits(
                  finalVeNft.lockedAmount,
                  finalVeNft.decimals,
                ),
                expiresAt: finalVeNft.expiresAt,
              }
            : null,
          transactions,
        },
        null,
        2,
      ),
    );
  },
  1_800_000,
);
