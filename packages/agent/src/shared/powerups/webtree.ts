import { defineTool } from '@flue/runtime'
import { ConvexHttpClient } from 'convex/browser'
import { anyApi } from 'convex/server'
import * as v from 'valibot'
import type { PowerupDefinition } from './types.ts'

// WebTree: per-user Web3 wallets via Crossmint (Base Sepolia testnet).
// Backend lives in packages/backend/convex/webtree.ts.

export const webtree: PowerupDefinition = {
  id: 'webtree',

  instructions: `## WebTree power-up (enabled)

The user has switched on WebTree, which gives them a personal Web3 wallet on the
Base Sepolia testnet. Anything about wallets, crypto, tokens, or balances is a
WebTree matter: answer it with the wallet tools below, NEVER by searching goals
or tasks (a task named "wallet" is not a wallet). "Do I have a wallet?" means
call \`get_wallet_balance\` (or \`create_wallet\` if they want one), not
\`get_goals\`. Use \`create_wallet\` the first time they ask for a wallet
(it is safe to call again — it returns the existing wallet). Read balances with
\`get_wallet_balance\` before answering questions about funds. Sending tokens
moves real (test) assets: always restate the recipient, token, and amount and
get an explicit yes in this conversation — with a \`confirm\` component — before
calling \`send_tokens\`. Never read wallet addresses aloud in full; say the first
and last four characters and put the full address in the UI block.`,

  tools(userId, convexUrl) {
    const convex = new ConvexHttpClient(convexUrl)
    const api = anyApi

    return [
      defineTool({
        name: 'create_wallet',
        description:
          'Create the user\u2019s Web3 wallet (Base Sepolia, Crossmint). Idempotent: returns the existing wallet if one was already created. Returns the wallet address.',
        async run() {
          return await convex.action(api.webtree.getOrCreateWallet, { userId })
        },
      }),

      defineTool({
        name: 'get_wallet_balance',
        description:
          'Get the user\u2019s wallet address and its ETH, USDC, and USDXM (test stablecoin) balances on Base Sepolia. Fails if no wallet exists yet \u2014 offer to create one.',
        async run() {
          return await convex.action(api.webtree.getBalances, { userId })
        },
      }),

      defineTool({
        name: 'send_tokens',
        description:
          'Send tokens from the user\u2019s wallet. Moves real (test) assets and is irreversible: only call after the user explicitly confirmed the exact recipient, token, and amount in this conversation.',
        input: v.object({
          recipient: v.pipe(
            v.string(),
            v.description('Recipient wallet address, e.g. 0x\u2026 for Base Sepolia'),
          ),
          token: v.pipe(v.string(), v.description('Token symbol: "eth", "usdc", or "usdxm"')),
          amount: v.pipe(
            v.string(),
            v.description('Decimal amount to send as a string, e.g. "0.01"'),
          ),
        }),
        async run({ input }) {
          return await convex.action(api.webtree.sendTokens, { userId, ...input })
        },
      }),
    ]
  },
}
