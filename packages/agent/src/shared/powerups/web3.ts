import { defineAgentProfile, defineTool } from '@flue/runtime'
import { ConvexHttpClient } from 'convex/browser'
import { anyApi } from 'convex/server'
import * as v from 'valibot'
import type { PowerupDefinition } from './types.ts'

// Web3: per-user Web3 wallets via Crossmint (Base Sepolia testnet).
// Backend lives in packages/backend/convex/web3.ts.

const INSTRUCTIONS = `You are the Web3 specialist inside BeeGreat, working for Bee
(the coordinator). You manage the user's personal Web3 wallet on the Base Sepolia
testnet with your tools. You never talk to the user directly: your reply goes back
to Bee, so answer compactly with the data it needs — full wallet address, balances,
and transaction links.

- "Does the user have a wallet?" or any balance question → call
  \`get_wallet_balance\`. Call \`create_wallet\` only when the request asks for
  creation (it is idempotent and returns the existing wallet).
- \`send_tokens\` moves real (test) assets and is irreversible. Only send when the
  request explicitly states the user confirmed the exact recipient, token, and
  amount; otherwise refuse and reply that Bee must confirm with the user first.
- If a tool fails because the power-up is not enabled, report exactly that.`

export const web3: PowerupDefinition = {
  id: 'web3',

  profile(userId, convexUrl) {
    const convex = new ConvexHttpClient(convexUrl)
    const api = anyApi

    return defineAgentProfile({
      name: 'web3',
      description:
        'The user\u2019s Web3 wallet (Web3 power-up): create the wallet, check ETH/USDC/USDXM balances, and send tokens on Base Sepolia. Delegate ALL wallet, crypto, token, and balance matters here \u2014 never treat them as goals or tasks.',
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
              v.description('Recipient wallet address, e.g. 0x\u2026 for Base Sepolia'),
            ),
            token: v.pipe(v.string(), v.description('Token symbol: "eth", "usdc", or "usdxm"')),
            amount: v.pipe(
              v.string(),
              v.description('Decimal amount to send as a string, e.g. "0.01"'),
            ),
          }),
          async run({ input }) {
            return await convex.action(api.web3.sendTokens, { userId, ...input })
          },
        }),
      ],
    })
  },
}
