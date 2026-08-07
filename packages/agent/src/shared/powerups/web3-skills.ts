import { defineSkill } from '@flue/runtime'

// Lazy playbooks for the Web3 specialist. The profile instructions keep the
// always-on safety invariants (two-phase gate, no private keys, YOLO rules);
// these skills carry the deeper procedural recipes so the base prompt stays
// lean and the model loads a playbook only when the task matches.

export const aerodromeLiquiditySkill = defineSkill({
  name: 'aerodrome-liquidity',
  description:
    'Playbook for Velodrome/Aerodrome liquidity work: discovering pools, adding or removing liquidity, creating new basic or CL pools, staking into gauges, and claiming emissions or fees. Activate before any multi-step LP task or pool-creation request. Do NOT activate for balance checks, token sends, or single swap quotes.',
  instructions: `# Aerodrome/Velodrome liquidity playbook

## Choose the wallet and execution path first
- Call \`get_wallets\` once. Default Sugar READS to the linked EOA address when
  present; otherwise use the smart wallet address for Base positions it holds.
- Execution decision tree:
  - User wants the Bee smart wallet to act → \`prepare_sugar_execution\`
    (always Base 8453; parameters WITHOUT chain/wallet).
  - User wants their own linked wallet to act → \`prepare_linked_wallet_execution\`
    (pick the chain; parameters WITHOUT chain/wallet).
  - User only wants the transaction JSON to sign elsewhere → the matching
    \`sugar_*\` build tool with an explicit public wallet address.

## Discover before you act
- \`sugar_pools\` with token filters and a small \`limit\` first; add
  \`full: true\` only when the user asks about TVL, fees, or emissions.
- \`sugar_positions\` (wallet or owner required) before any withdraw, stake,
  unstake, or claim: it gives you the exact pool address (basic) or NFT
  position id (CL) the follow-up call needs.
- Basic positions are identified by \`pool\` (LP address); CL positions by
  \`position\` (NFT id as a decimal string). Every position-scoped action
  needs one of the two.

## Deposit into an existing pool
- Provide \`pool\` plus \`amount0\`/\`amount1\` (raw wei, or decimal units with
  \`use_decimals: true\` — prefer decimals, users speak in decimals).
- CL deposits also take a range: either \`price_lower\`/\`price_upper\` or
  \`tick_lower\`/\`tick_upper\`. Never mix price and tick inputs.
- Optional: \`slippage\` (0..1), \`deadline_minutes\` (>= 1).

## Create and seed a NEW pool (deposit without pool)
- Omit \`pool\`; provide \`token0\`, \`token1\`, and \`pool_type\`.
- Basic pool (\`stable\` or \`volatile\`): both \`amount0\` and \`amount1\` are
  required; \`tick_spacing\` is forbidden.
- CL pool (\`cl\`): also requires \`tick_spacing\`, a range
  (prices or ticks), and \`initial_price\` when the pool has no price yet.
- Never combine \`pool\` with token0/token1/pool_type/tick_spacing — the
  backend rejects it.

## Withdraw / stake / unstake / claim
- \`withdraw\`: \`fraction\` (0 < f <= 1) for partial exits; \`burn\` to burn a
  drained CL NFT; \`collect\` for fees; \`unwrap_native\` to receive ETH.
- \`stake\`/\`unstake\`: position must exist and have a gauge (check
  \`sugar_pools\` full output for gauge status). CL unstake is full-only;
  basic can pass a raw \`amount\`.
- \`claim_emissions\` needs a STAKED position; \`claim_fees\` an unstaked LP
  or CL position (\`burn\`/\`unwrap_native\` optional).
- Recommended LP flow: deposit → stake → (later) claim_emissions →
  unstake → withdraw. Prepare each as its own action; wait for the previous
  action's settled event before preparing the next. Whenever another step is
  still required, set the prepare tool's private \`continuation\` to the exact
  remaining work. For example, withdrawing a pool before swapping its USDC
  should say to inspect the settled balances and swap all received USDC to ETH.

## Quotes and swaps
- \`sugar_quote\` is read-only; do NOT call it right before
  \`prepare_sugar_execution\` with sugar_action "swap" — the prepare rebuilds
  a fresh quote internally.
- Amounts: raw wei by default, decimal units with \`use_decimals: true\`.
- Report effective price, price impact, and route from quote output; warn the
  user when price impact is large before preparing an execution.

## Chains
Reads work on Optimism 10, Unichain 130, Fraxtal 252, Lisk 1135, Soneium 1868,
Superseed 5330, Base 8453, Mode 34443, Celo 42220, Ink 57073. Smart-wallet
execution is Base mainnet only. Linked-wallet execution works on any supported
chain the user's wallet can switch to.`,
})

export const crossChainSwapSkill = defineSkill({
  name: 'cross-chain-swap',
  description:
    'Playbook for Base ↔ Arbitrum swaps through Socket with the Bee smart wallet: quoting, choosing the output token for destination gas, settlement lifecycle, and chaining a bridge into a follow-up DeFi step. Activate for bridging and cross-chain requests. Do NOT activate for same-chain balances, sends, or Aerodrome-only work.',
  instructions: `# Base ↔ Arbitrum cross-chain swap playbook

## Route selection heuristics
- Supported: ETH and USDC, both directions, Bee smart wallet only (same
  address on both chains).
- Source gas is sponsored (Crossmint), so a wallet holding ONLY Base USDC can
  still bridge — never tell the user they need source ETH first.
- Destination gas: if the destination wallet has no ETH, prefer output token
  "eth" so the arriving funds are spendable (e.g. Base/USDC → Arbitrum/ETH).
  If the user insists on USDC output, refuel is requested automatically when
  the route supports it — mention that a small native gas top-up is included
  only if the route reports it.

## Quote vs prepare
- \`quote_cross_chain_swap\` for previews and price checks; it stores nothing.
- \`prepare_cross_chain_swap\` fetches a FRESH executable quote and returns the
  pending actionId. Do not quote first and then prepare with the same numbers
  as if they were locked — the prepare re-quotes and its output may differ
  slightly; report the prepare's numbers, not the preview's.
- Socket quotes live ~60s but the confirmation lives 10 minutes: the executor
  re-fetches a route at execution time and refuses anything below the
  confirmed minimum output. Never promise the estimated output; the minimum
  output is the number that is guaranteed.

## Settlement lifecycle
- After confirmation the action reports: confirmed → in_progress (source
  transaction sent, destination pending) → executed | failed | refunded |
  expired.
- "in_progress" is NOT arrival. Never tell the user funds arrived until the
  status is "executed". Refunds surface as "refunded" with the refund
  transaction linked.
- Do not poll: the backend monitors the whole settlement window and Bee
  receives a \`web3.action_settled\` event at the terminal status. Report the
  expected duration (from the quote's estimated time), note the next step,
  and end the reply.

## Chaining bridge → next step (e.g. bridge then LP on Base/Arbitrum)
1. Prepare the swap, have Bee render the confirm card, stop.
   Set \`continuation\` to the exact next step that must run after settlement.
2. On \`web3.action_settled\` executed: continue immediately with the next
   step using the ACTUAL arrived amount (check \`get_wallet_balance\` on the
   destination chain rather than assuming the estimate).
3. On failed/refunded/expired: report exactly what happened and stop the
   plan — never re-prepare automatically without telling the user.

## Failure answers
- "requires a production Crossmint key" → environment is staging; cross-chain
  swaps are mainnet-only, say exactly that.
- Quote errors mentioning no safe route → suggest a smaller amount or the
  other token; Socket rejects routes whose output token or calldata target
  fails validation.`,
})
