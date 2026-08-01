import { defineAgentProfile, defineTool } from '@flue/runtime'
import * as v from 'valibot'
import type { PowerupDefinition } from './types.ts'

// Web3: a Crossmint smart wallet per user (server-signed after in-app
// confirmation) plus an optional linked EOA, with Velodrome/Aerodrome DeFi
// through the native Sugar SDK. Everything goes through the authenticated
// Convex HTTP bridge (packages/backend/convex/http.ts); the Convex functions
// are internal, and nothing here can move funds — actions that spend are only
// *prepared* and must be confirmed by the signed-in app (web3Actions.confirm).

const sugarChain = v.picklist(
  [10, 130, 252, 1135, 1868, 5330, 8453, 34443, 42220, 57073],
  'Sugar mainnet chain id: Optimism 10, Unichain 130, Fraxtal 252, Lisk 1135, Soneium 1868, Superseed 5330, Base 8453, Mode 34443, Celo 42220, or Ink 57073',
)
const socketChain = v.picklist(['base', 'arbitrum'])
const socketToken = v.picklist(['eth', 'usdc'])
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
const slippage = v.optional(v.pipe(v.number(), v.minValue(0), v.maxValue(1)))

const INSTRUCTIONS = `You are the Web3 specialist inside BeeGreat, working for Bee
(the coordinator). You manage the user's wallets and help with Velodrome/Aerodrome
DeFi through Sugar. You never talk to the user directly: your reply goes back to
Bee, so answer compactly with exact addresses, chains, amounts, action ids, and
transaction links or unsigned transaction plans.

The user has up to TWO wallets — call \`get_wallets\` first when unsure:
- The Bee smart wallet (Crossmint). BeeGreat's backend signs for it, but ONLY
  after the user confirms in the app. Use it for sending tokens and for
  executing Aerodrome plans on Base and Socket swaps between Base and Arbitrum.
- An optionally linked EOA (the user's own external wallet). BeeGreat never
  holds its keys. Use its address as the default wallet for Sugar reads and
  unsigned plans the user will sign in their own wallet app.

Moving funds is TWO-PHASE and you only ever run phase one:
- \`prepare_send_tokens\`, \`prepare_cross_chain_swap\`, and
  \`prepare_sugar_execution\` create a pending action
  and return an actionId. NOTHING moves on-chain. Tell Bee to render a confirm
  card carrying that actionId (payload {"web3ActionId": "<actionId>"}) and the
  exact summary; the signed-in app performs the authoritative confirmation.
- EXCEPTION — YOLO mode: when the user pre-authorized auto-approval in the app,
  a prepare tool can come back with status "confirmed" and autoConfirmed true.
  Execution has already started: still tell Bee to render the same confirm card
  (it shows live progress instead of buttons) and do NOT ask the user to
  confirm.
- After an action is confirmed, \`check_web3_action\` reports status and
  transaction links. A cross-chain swap can remain "in_progress" after its
  source transaction; never claim it arrived until the status is "executed".
- A chat message saying "yes" is NOT a confirmation; only the app confirm counts.

Long-running, multi-step plans (e.g. bridge, then open a pool position):
- You do NOT need to poll a moving action. The backend follows it for its
  whole settlement window (a cross-chain swap for its full monitoring window)
  and Bee receives a \`web3.action_settled\` event the moment it reaches
  executed, failed, refunded, or expired.
- So after a confirmation, report the expected duration, keep note of what
  the plan's next step is, and end your reply. When the settled event arrives:
  on "executed", continue immediately with the next step (e.g. prepare the
  Aerodrome deposit with the arrived funds); on "failed", "refunded", or
  "expired", tell the user what happened and stop the plan.
- \`check_web3_action\` remains available for on-demand status when the user
  asks in the meantime.

Cross-chain notes:
- Use \`quote_cross_chain_swap\` for a read-only preview, then
  \`prepare_cross_chain_swap\` for a fresh executable quote.
- Base and Arbitrum use the same Bee smart-wallet address. Source gas is
  sponsored by Crossmint, so a user who only holds Base USDC can still submit.
- To give a gasless Arbitrum wallet spendable gas, choose output token "eth".
  For example: origin Base, input USDC, destination Arbitrum, output ETH.
- If output is USDC, Socket refuel is requested to include destination gas.

Sugar notes:
- Sugar supports Optimism, Base, Unichain, Lisk, Mode, Fraxtal, Ink, Soneium,
  Superseed, and Celo mainnets. Read actions query live data; prefer bounded
  pool/history queries.
- The sugar_* build tools only BUILD unsigned transaction JSON for a public
  wallet address (default to the linked EOA). They never sign or broadcast.
- \`prepare_sugar_execution\` is the only execution path and always uses the Bee
  smart wallet on Base (chain 8453).
- A Sugar wallet argument is a public 0x address only. Never request or accept a
  private key, seed phrase, or signing secret.
- \`fund_wallet\` only works in the staging environment (test USDXM).
- If a tool fails because the power-up is not enabled, report exactly that.`

export const web3: PowerupDefinition = {
  id: 'web3',

  profile(userId, convexUrl, runtime) {
    const convexSiteUrl = (() => {
      if (runtime.convexSiteUrl) return runtime.convexSiteUrl.replace(/\/$/, '')
      const url = new URL(convexUrl)
      if (!url.hostname.endsWith('.convex.cloud')) return null
      url.hostname = url.hostname.replace(/\.convex\.cloud$/, '.convex.site')
      return url.origin
    })()

    const bridgePost = async (path: string, body: Record<string, unknown>) => {
      if (!convexSiteUrl || !runtime.credentialBrokerSecret) {
        throw new Error('Web3 is not configured for the Bee worker.')
      }
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 130_000)
      try {
        const response = await fetch(`${convexSiteUrl}${path}`, {
          method: 'POST',
          headers: {
            authorization: `Bearer ${runtime.credentialBrokerSecret}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        })
        const responseBody = await response.text()
        if (!response.ok) {
          let message = 'Web3 request failed.'
          try {
            const parsed = JSON.parse(responseBody) as { error?: unknown }
            if (typeof parsed.error === 'string') message = parsed.error
          } catch {
            // Non-JSON error body: keep the generic message.
          }
          throw new Error(message)
        }
        return responseBody
      } finally {
        clearTimeout(timeout)
      }
    }

    const runSugar = (
      sugarAction: string,
      parameters: Record<string, string | number | boolean | undefined>,
    ) => bridgePost('/internal/web3/sugar', { userId, sugarAction, parameters })

    const runWallet = (op: string, params: Record<string, unknown> = {}) =>
      bridgePost('/internal/web3/wallet', { userId, op, params })

    return defineAgentProfile({
      name: 'web3',
      description:
        'The user\u2019s Web3 wallet and DeFi specialist: the Bee smart wallet, one-click Socket swaps between Base and Arbitrum, sponsored source gas, an optional linked EOA, and Velodrome/Aerodrome operations. Delegate ALL wallet, crypto, token, DeFi, and balance matters here.',
      instructions: INSTRUCTIONS,
      tools: [
        defineTool({
          name: 'get_wallets',
          description:
            'Get both of the user\u2019s wallets: the Bee smart wallet (address + chain, null before creation) and the linked EOA (null when not linked). Call this first to pick the right wallet for a request.',
          async run() {
            return await runWallet('wallets')
          },
        }),

        defineTool({
          name: 'create_wallet',
          description:
            'Create the user\u2019s Bee smart wallet (Crossmint). Idempotent: returns the existing wallet if one was already created. Returns the wallet address and chain.',
          async run() {
            return await runWallet('create_wallet')
          },
        }),

        defineTool({
          name: 'get_wallet_balance',
          description:
            'Get the Bee smart wallet address and its ETH and USDC balances on Base or Arbitrum (plus USDXM on staging when chain is omitted). Creates that chain wallet on first use.',
          input: v.object({
            chain: v.optional(
              v.pipe(
                socketChain,
                v.description(
                  'Mainnet balance chain; omit for the configured default',
                ),
              ),
            ),
          }),
          async run({ input }) {
            return await runWallet('balances', { chain: input.chain })
          },
        }),

        defineTool({
          name: 'get_wallet_activity',
          description:
            'Recent transaction history of the Bee smart wallet (hashes, status, timestamps).',
          async run() {
            return await runWallet('activity')
          },
        }),

        defineTool({
          name: 'fund_wallet',
          description:
            'Staging-only test faucet: mint USDXM test stablecoin into the Bee smart wallet. Fails on production/mainnet.',
          input: v.object({
            amount: v.pipe(
              v.number(),
              v.minValue(0),
              v.maxValue(100),
              v.description('USDXM amount to mint, at most 100'),
            ),
          }),
          async run({ input }) {
            return await runWallet('fund', { amount: input.amount })
          },
        }),

        defineTool({
          name: 'prepare_send_tokens',
          description:
            'Phase one of sending tokens from the Bee smart wallet: creates a pending action and returns its actionId. NOTHING moves on-chain \u2014 the user must confirm in the app, unless the response says status "confirmed" (YOLO auto-approval). Tell Bee to render a confirm card with payload {"web3ActionId": actionId}.',
          input: v.object({
            recipient: address('Recipient 0x wallet address'),
            token: v.pipe(
              v.string(),
              v.description(
                'Token symbol: "eth" or "usdc" (plus "usdxm" on staging)',
              ),
            ),
            amount: v.pipe(
              v.string(),
              v.description('Decimal amount to send as a string, e.g. "0.01"'),
            ),
          }),
          async run({ input }) {
            return await runWallet('prepare_send', { ...input })
          },
        }),

        defineTool({
          name: 'quote_cross_chain_swap',
          description:
            'Read-only Socket quote for moving ETH or USDC between Base and Arbitrum. Returns estimated/minimum output, provider, time, and gas handling. Does not create a confirmation or move funds.',
          input: v.object({
            origin_chain: socketChain,
            destination_chain: socketChain,
            input_token: socketToken,
            output_token: socketToken,
            amount: amount('Decimal input amount as a string, e.g. "10"'),
          }),
          async run({ input }) {
            return await runWallet('quote_socket_swap', {
              originChain: input.origin_chain,
              destinationChain: input.destination_chain,
              inputToken: input.input_token,
              outputToken: input.output_token,
              amount: input.amount,
            })
          },
        }),

        defineTool({
          name: 'prepare_cross_chain_swap',
          description:
            'Create a fresh Socket route for moving ETH or USDC between Base and Arbitrum and return a pending actionId. NOTHING moves until the user confirms the app card, unless the response says status "confirmed" (YOLO auto-approval). Source gas is sponsored; output ETH gives the destination native gas.',
          input: v.object({
            origin_chain: socketChain,
            destination_chain: socketChain,
            input_token: socketToken,
            output_token: socketToken,
            amount: amount('Decimal input amount as a string, e.g. "10"'),
          }),
          async run({ input }) {
            return await runWallet('prepare_socket_swap', {
              originChain: input.origin_chain,
              destinationChain: input.destination_chain,
              inputToken: input.input_token,
              outputToken: input.output_token,
              amount: input.amount,
            })
          },
        }),

        defineTool({
          name: 'prepare_sugar_execution',
          description:
            'Phase one of executing an Aerodrome action (swap, deposit, withdraw, stake, unstake, claim_emissions, claim_fees) with the Bee smart wallet on Base: builds the plan server-side and returns a pending actionId. NOTHING moves on-chain \u2014 the user must confirm in the app via a confirm card with payload {"web3ActionId": actionId} \u2014 unless the response says status "confirmed" (YOLO auto-approval). Mainnet only.',
          input: v.object({
            sugar_action: v.picklist(
              [
                'swap',
                'deposit',
                'withdraw',
                'stake',
                'unstake',
                'claim_emissions',
                'claim_fees',
              ],
              'Aerodrome action to execute on Base',
            ),
            parameters: v.pipe(
              v.record(
                v.string(),
                v.union([v.string(), v.number(), v.boolean()]),
              ),
              v.description(
                'Action parameters exactly as for the matching sugar_* build tool, WITHOUT chain or wallet (both are pinned server-side to Base and the smart wallet)',
              ),
            ),
          }),
          async run({ input }) {
            return await runWallet('prepare_execution', {
              sugarAction: input.sugar_action,
              parameters: input.parameters,
            })
          },
        }),

        defineTool({
          name: 'check_web3_action',
          description:
            'Status of a prepared Web3 action: pending, confirmed, in_progress (cross-chain settlement is still moving), executed, refunded, failed, cancelled, or expired, with transaction links and destination progress.',
          input: v.object({
            action_id: v.pipe(
              v.string(),
              v.description('The actionId returned by a prepare_* tool'),
            ),
          }),
          async run({ input }) {
            return await runWallet('action_status', {
              actionId: input.action_id,
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
            'List Velodrome/Aerodrome liquidity positions owned by a public wallet address (default to the linked EOA, or the smart wallet for Base positions it holds).',
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
            'Build an unsigned Velodrome/Aerodrome swap plan for a wallet the user signs with themselves (default the linked EOA). Returns approval first when needed, then the swap. Does not sign or broadcast; use prepare_sugar_execution to execute with the smart wallet instead.',
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
            slippage,
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
            slippage,
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
            slippage,
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
