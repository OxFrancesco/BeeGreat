import { defineAgentProfile, defineTool } from '@flue/runtime'
import { ConvexHttpClient } from 'convex/browser'
import { anyApi } from 'convex/server'
import * as v from 'valibot'
import type { PowerupDefinition } from './types.ts'

// Web3: per-user wallets via Crossmint plus unsigned Velodrome/Aerodrome
// transaction planning and on-chain reads through the Sugar CLI bridge.
// Backend lives in packages/backend/convex/web3.ts.

const sugarChain = v.picklist(
  [10, 130, 252, 1135, 1868, 5330, 8453, 34443, 42220, 57073],
  'Sugar mainnet chain id: Optimism 10, Unichain 130, Fraxtal 252, Lisk 1135, Soneium 1868, Superseed 5330, Base 8453, Mode 34443, Celo 42220, or Ink 57073',
)
const address = (description: string) =>
  v.pipe(
    v.string(),
    v.regex(/^0x[0-9a-fA-F]{40}$/, 'Must be a 20-byte 0x address'),
    v.description(description),
  )
const amount = (description: string) =>
  v.pipe(v.string(), v.description(description))
const poolType = v.optional(v.picklist(['cl', 'stable', 'volatile']))
const fraction = v.optional(
  v.pipe(
    v.number(),
    v.check((value) => value > 0, 'Must be greater than 0'),
    v.maxValue(1),
  ),
)
const poolPosition = {
  pool: v.optional(
    address('Basic pool LP address; may also narrow a CL position lookup'),
  ),
  position: v.optional(
    v.pipe(
      v.string(),
      v.regex(/^\d+$/, 'Must be a non-negative decimal integer'),
      v.description('CL NFT position id as a decimal string'),
    ),
  ),
}

const INSTRUCTIONS = `You are the Web3 specialist inside BeeGreat, working for Bee
(the coordinator). You manage the user's personal Crossmint wallet and help with
Velodrome/Aerodrome DeFi through Sugar. You never talk to the user directly: your
reply goes back to Bee, so answer compactly with exact addresses, chains, amounts,
and transaction links or unsigned transaction plans.

- "Does the user have a wallet?" or any balance question → call
  \`get_wallet_balance\`. Call \`create_wallet\` only when the request asks for
  creation (it is idempotent and returns the existing wallet).
- \`send_tokens\` moves real (test) assets and is irreversible. Only send when the
  request explicitly states the user confirmed the exact recipient, token, and
  amount; otherwise refuse and reply that Bee must confirm with the user first.
- Sugar supports Optimism, Base, Unichain, Lisk, Mode, Fraxtal, Ink, Soneium,
  Superseed, and Celo mainnets. Read actions query live data. Prefer bounded
  pool/history queries.
- Sugar write actions only BUILD unsigned transaction JSON. They never sign or
  broadcast. Clearly tell Bee that nothing moved on-chain and return every unsigned
  transaction in order; never claim completion from a transaction plan.
- A Sugar wallet argument is a public 0x address only. Never request or accept a
  private key, seed phrase, or signing secret.
- If a tool fails because the power-up is not enabled, report exactly that.`

export const web3: PowerupDefinition = {
  id: 'web3',

  profile(userId, convexUrl, runtime) {
    const convex = new ConvexHttpClient(convexUrl)
    const api = anyApi
    const convexSiteUrl = (() => {
      if (runtime.convexSiteUrl) return runtime.convexSiteUrl.replace(/\/$/, '')
      const url = new URL(convexUrl)
      if (!url.hostname.endsWith('.convex.cloud')) return null
      url.hostname = url.hostname.replace(/\.convex\.cloud$/, '.convex.site')
      return url.origin
    })()
    const runSugar = async (
      sugarAction: string,
      parameters: Record<string, string | number | boolean | undefined>,
    ) => {
      if (!convexSiteUrl || !runtime.credentialBrokerSecret) {
        throw new Error('Sugar is not configured for the Bee worker.')
      }
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 130_000)
      try {
        const response = await fetch(`${convexSiteUrl}/internal/web3/sugar`, {
          method: 'POST',
          headers: {
            authorization: `Bearer ${runtime.credentialBrokerSecret}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({ userId, sugarAction, parameters }),
          signal: controller.signal,
        })
        const body = await response.text()
        if (!response.ok) {
          const parsed = JSON.parse(body) as { error?: unknown }
          throw new Error(
            typeof parsed.error === 'string'
              ? parsed.error
              : 'Sugar request failed.',
          )
        }
        return body
      } finally {
        clearTimeout(timeout)
      }
    }

    return defineAgentProfile({
      name: 'web3',
      description:
        'The user\u2019s Web3 wallet and Velodrome/Aerodrome DeFi specialist: wallet creation, balances, testnet transfers, pools, positions, epochs, quotes, swaps, liquidity, staking, and rewards. Sugar transaction actions return unsigned plans only. Delegate ALL wallet, crypto, token, DeFi, and balance matters here.',
      instructions: INSTRUCTIONS,
      tools: [
        defineTool({
          name: 'create_wallet',
          description:
            'Create the user\u2019s Web3 wallet (Base Sepolia, Crossmint). Idempotent: returns the existing wallet if one was already created. Returns the wallet address.',
          async run() {
            return await convex.action(api.web3.getOrCreateWallet, { userId })
          },
        }),

        defineTool({
          name: 'get_wallet_balance',
          description:
            'Get the user\u2019s wallet address and its ETH, USDC, and USDXM (test stablecoin) balances on Base Sepolia. Fails if no wallet exists yet.',
          async run() {
            return await convex.action(api.web3.getBalances, { userId })
          },
        }),

        defineTool({
          name: 'send_tokens',
          description:
            'Send tokens from the user\u2019s wallet. Moves real (test) assets and is irreversible: only call when the delegated request states the user explicitly confirmed the exact recipient, token, and amount.',
          input: v.object({
            recipient: v.pipe(
              v.string(),
              v.description(
                'Recipient wallet address, e.g. 0x\u2026 for Base Sepolia',
              ),
            ),
            token: v.pipe(
              v.string(),
              v.description('Token symbol: "eth", "usdc", or "usdxm"'),
            ),
            amount: v.pipe(
              v.string(),
              v.description('Decimal amount to send as a string, e.g. "0.01"'),
            ),
          }),
          async run({ input }) {
            return await convex.action(api.web3.sendTokens, {
              userId,
              ...input,
            })
          },
        }),

        defineTool({
          name: 'sugar_pools',
          description:
            'List Velodrome/Aerodrome pools on a supported mainnet. Compact by default; full adds TVL, reserves, fees, gauge, and emissions.',
          input: v.object({
            chain: sugarChain,
            token0: v.optional(
              v.pipe(
                v.string(),
                v.description('Token symbol or address filter'),
              ),
            ),
            token1: v.optional(
              v.pipe(
                v.string(),
                v.description('Second token symbol or address filter'),
              ),
            ),
            pool_type: poolType,
            full: v.optional(v.boolean()),
            limit: v.optional(
              v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(100)),
            ),
          }),
          async run({ input }) {
            return await runSugar('pools', input)
          },
        }),

        defineTool({
          name: 'sugar_positions',
          description:
            'List Velodrome/Aerodrome liquidity positions owned by a public wallet address.',
          input: v.pipe(
            v.object({
              chain: sugarChain,
              wallet: v.optional(
                address('Public wallet address whose positions to list'),
              ),
              owner: v.optional(
                address('Public owner address; takes precedence over wallet'),
              ),
            }),
            v.check(
              (input) =>
                input.wallet !== undefined || input.owner !== undefined,
              'Provide wallet or owner',
            ),
          ),
          async run({ input }) {
            return await runSugar('positions', input)
          },
        }),

        defineTool({
          name: 'sugar_epochs_latest',
          description:
            'Read the latest voting epoch for every gauged pool, including votes, emissions, fees, incentives, and gauge status.',
          input: v.object({ chain: sugarChain, pool_type: poolType }),
          async run({ input }) {
            return await runSugar('epochs_latest', input)
          },
        }),

        defineTool({
          name: 'sugar_epochs',
          description: 'Read paginated historical voting epochs for one pool.',
          input: v.object({
            chain: sugarChain,
            lp: address('Pool LP address'),
            pool_type: poolType,
            limit: v.optional(
              v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(100)),
            ),
            offset: v.optional(v.pipe(v.number(), v.integer(), v.minValue(0))),
          }),
          async run({ input }) {
            return await runSugar('epochs', input)
          },
        }),

        defineTool({
          name: 'sugar_quote',
          description:
            'Get a read-only swap quote with raw and decimal amounts, effective price, oracle prices, price impact, and route.',
          input: v.object({
            chain: sugarChain,
            from_token: v.pipe(
              v.string(),
              v.description('Input token symbol or address'),
            ),
            to_token: v.pipe(
              v.string(),
              v.description('Output token symbol or address'),
            ),
            amount: amount(
              'Input amount as raw wei, or decimal token units when use_decimals is true',
            ),
            use_decimals: v.optional(v.boolean()),
          }),
          async run({ input }) {
            return await runSugar('quote', input)
          },
        }),

        defineTool({
          name: 'sugar_swap',
          description:
            'Build an unsigned Velodrome/Aerodrome swap plan. Returns approval first when needed, then the swap. Does not sign or broadcast.',
          input: v.object({
            chain: sugarChain,
            wallet: address(
              'Public address that will externally sign the transaction plan',
            ),
            from_token: v.pipe(
              v.string(),
              v.description('Input token symbol or address'),
            ),
            to_token: v.pipe(
              v.string(),
              v.description('Output token symbol or address'),
            ),
            amount: amount(
              'Input amount as raw wei, or decimal token units when use_decimals is true',
            ),
            slippage: v.optional(
              v.pipe(v.number(), v.minValue(0), v.maxValue(1)),
            ),
            use_decimals: v.optional(v.boolean()),
          }),
          async run({ input }) {
            return await runSugar('swap', input)
          },
        }),

        defineTool({
          name: 'sugar_deposit',
          description:
            'Build unsigned transactions to add liquidity to an existing or new basic/CL pool. Does not sign or broadcast.',
          input: v.object({
            chain: sugarChain,
            wallet: address(
              'Public address that will externally sign the transaction plan',
            ),
            pool: v.optional(address('Existing pool LP address')),
            token0: v.optional(
              v.pipe(
                v.string(),
                v.description('Token symbol/address for a new pool'),
              ),
            ),
            token1: v.optional(
              v.pipe(
                v.string(),
                v.description('Second token symbol/address for a new pool'),
              ),
            ),
            pool_type: poolType,
            tick_spacing: v.optional(v.pipe(v.number(), v.integer())),
            amount0: v.optional(
              amount(
                'Token0 amount in raw wei, or decimal units when use_decimals is true',
              ),
            ),
            amount1: v.optional(
              amount(
                'Token1 amount in raw wei, or decimal units when use_decimals is true',
              ),
            ),
            price_lower: v.optional(v.number()),
            price_upper: v.optional(v.number()),
            tick_lower: v.optional(v.pipe(v.number(), v.integer())),
            tick_upper: v.optional(v.pipe(v.number(), v.integer())),
            initial_price: v.optional(v.number()),
            slippage: v.optional(
              v.pipe(v.number(), v.minValue(0), v.maxValue(1)),
            ),
            deadline_minutes: v.optional(v.pipe(v.number(), v.minValue(1))),
            use_decimals: v.optional(v.boolean()),
          }),
          async run({ input }) {
            return await runSugar('deposit', input)
          },
        }),

        defineTool({
          name: 'sugar_withdraw',
          description:
            'Build an unsigned full or partial liquidity withdrawal plan. Identify basic positions by pool and CL positions by NFT id.',
          input: v.object({
            chain: sugarChain,
            wallet: address(
              'Public address that will externally sign the transaction plan',
            ),
            ...poolPosition,
            fraction,
            burn: v.optional(v.boolean()),
            collect: v.optional(v.boolean()),
            unwrap_native: v.optional(v.boolean()),
            slippage: v.optional(
              v.pipe(v.number(), v.minValue(0), v.maxValue(1)),
            ),
            deadline_minutes: v.optional(v.pipe(v.number(), v.minValue(1))),
          }),
          async run({ input }) {
            return await runSugar('withdraw', input)
          },
        }),

        defineTool({
          name: 'sugar_stake',
          description:
            'Build unsigned transactions to stake an LP or CL position into its gauge.',
          input: v.object({
            chain: sugarChain,
            wallet: address(
              'Public address that will externally sign the transaction plan',
            ),
            ...poolPosition,
          }),
          async run({ input }) {
            return await runSugar('stake', input)
          },
        }),

        defineTool({
          name: 'sugar_unstake',
          description:
            'Build unsigned transactions to unstake from a gauge. CL is full-only; basic can pass a raw partial amount.',
          input: v.object({
            chain: sugarChain,
            wallet: address(
              'Public address that will externally sign the transaction plan',
            ),
            ...poolPosition,
            amount: v.optional(
              amount('Raw wei amount for a partial basic-position unstake'),
            ),
          }),
          async run({ input }) {
            return await runSugar('unstake', input)
          },
        }),

        defineTool({
          name: 'sugar_claim_emissions',
          description:
            'Build an unsigned transaction to claim gauge emissions for a staked position.',
          input: v.object({
            chain: sugarChain,
            wallet: address(
              'Public address that will externally sign the transaction plan',
            ),
            ...poolPosition,
          }),
          async run({ input }) {
            return await runSugar('claim_emissions', input)
          },
        }),

        defineTool({
          name: 'sugar_claim_fees',
          description:
            'Build an unsigned transaction to claim LP fees, optionally unwrapping native ETH or burning a drained CL NFT.',
          input: v.object({
            chain: sugarChain,
            wallet: address(
              'Public address that will externally sign the transaction plan',
            ),
            ...poolPosition,
            burn: v.optional(v.boolean()),
            unwrap_native: v.optional(v.boolean()),
          }),
          async run({ input }) {
            return await runSugar('claim_fees', input)
          },
        }),
      ],
    })
  },
}
