import * as Console from 'effect/Console'
import * as Effect from 'effect/Effect'
import * as Option from 'effect/Option'
import * as Argument from 'effect/unstable/cli/Argument'
import * as Command from 'effect/unstable/cli/Command'

const GUIDE_TOPICS = [
  'getting-started',
  'wallet',
  'swap',
  'liquidity',
  'staking',
  'rewards',
  'venft',
  'chains',
  'completions',
] as const

type GuideTopic = (typeof GUIDE_TOPICS)[number]

const GUIDES = {
  'getting-started': `Getting started with aero
=========================

⚠️  aero is vibecoded and in EARLY BETA — use it at your own risk. Review
every plan with --dry-run before signing, start with small amounts, and
never risk funds you cannot afford to lose.

aero talks to Aerodrome (Base) and Velodrome (OP Superchain) straight from
your terminal. Reads print JSON; transaction commands build an unsigned plan
and only broadcast after you connect a wallet and confirm.

A five-minute tour:

  1. aero pools --token0 ETH --token1 USDC --full --limit 3
       Look around. No wallet needed for reads.
  2. aero quote --from-token ETH --to-token USDC --amount 0.05 --use-decimals
       Price a swap, including route and price impact.
  3. aero wallet connect
       Pair your mobile/extension wallet via WalletConnect (or
       'aero wallet create' for a local encrypted wallet).
  4. aero swap --from-token ETH --to-token USDC --amount 0.05 --use-decimals
       Review the plan summary, confirm, approve in your wallet.

Not sure which flags a command needs? Every command supports
  aero <command> --wizard
which asks for each value interactively. --dry-run always prints the plan
without sending anything, and --yes skips the confirmation for scripts.

Next: aero guide wallet | swap | liquidity | staking | rewards | venft`,

  wallet: `Wallets
=======

Two ways to sign:

  WalletConnect (recommended)   aero wallet connect
    Scan the QR (or paste the wc: URI) with Rabby, Rainbow, MetaMask, or a
    Safe. Every transaction is approved inside your wallet app; aero never
    sees a private key.

  Local encrypted wallet        aero wallet create | aero wallet restore
    Generates (or imports) a BIP-39 mnemonic, seals it with scrypt +
    AES-256-GCM, and stores it in the macOS Keychain (an encrypted 0600 file
    elsewhere). Signing asks for your passphrase; set SUGAR_WALLET_PASSPHRASE
    for non-interactive use.

Housekeeping:

  aero wallet status       who is connected, and on which chains
  aero wallet disconnect   drop the WalletConnect session
  aero wallet remove       delete the local encrypted wallet

When both exist, WalletConnect wins (pairing is an explicit recent action).
Transaction commands use the connected wallet automatically when --wallet is
omitted; passing a different --wallet prints an unsigned plan instead.`,

  swap: `Swapping
========

Price first, then trade:

  aero quote --from-token ETH --to-token USDC --amount 0.1 --use-decimals
  aero swap  --from-token ETH --to-token USDC --amount 0.1 --use-decimals

What the swap plan contains:
  - the best route across basic, stable, and CL pools (up to 3 hops through
    vetted connector tokens only — honeypot intermediates cannot appear)
  - ERC20 + Permit2 approvals when needed (listed before the swap itself)
  - a minimum-out floor from --slippage (default 0.01 = 1%)
  - an oracle sanity guard: quotes wildly above fair value are rejected

Tips:
  --use-decimals lets you write 0.1 instead of 100000000000000000.
  --dry-run prints the unsigned plan as JSON (pipe it anywhere).
  --slippage 0.005 tightens the floor for large, liquid pairs.
  Guided mode: aero swap --wizard`,

  liquidity: `Providing liquidity
===================

Find a pool, quote the deposit, add liquidity:

  aero pools --token0 ETH --token1 USDC --full
  aero deposit --pool <lp address> --amount0 0.1 --use-decimals

Pass only one amount for an existing pool — the other side is quoted for
you. Instead of --pool you can describe a new pool with --token0/--token1
and --pool-type (volatile | stable | cl; CL also needs --tick-spacing).

Concentrated liquidity ranges take either prices or ticks:
  aero deposit --pool <cl pool> --amount0 500 --use-decimals \\
    --price-lower 2200 --price-upper 2800

Withdrawing:
  aero positions
  aero withdraw --position <id> --pool <lp>          everything
  aero withdraw --position <id> --pool <lp> --fraction 0.5
  CL extras: --burn (retire the empty NFT), --unwrap-native, --no-collect

After depositing, stake the position to earn emissions: aero guide staking`,

  staking: `Staking
=======

Liquidity earns trading fees; STAKED liquidity earns AERO/VELO emissions
from the pool's gauge instead. Fees for staked positions go to the pool's
voters, so pick one: fees (unstaked) or emissions (staked).

  aero positions                          find your position id
  aero stake --position <id> --pool <lp>
  aero claim-emissions --position <id> --pool <lp>    any time
  aero unstake --position <id> --pool <lp>            leave the gauge
    (basic pools can unstake partially with --amount)

Notes:
  - staking a CL position transfers the NFT into the gauge (approval first)
  - a position must be unstaked before withdrawing or claiming fees
  - gauges must be alive (voted for); aero checks and tells you if not`,

  rewards: `Rewards
=======

Three separate reward streams:

  Trading fees (unstaked LPs)
    aero claim-fees --position <id> --pool <lp>
    CL extras: --unwrap-native, --burn (empty position only)

  Gauge emissions (staked LPs)
    aero claim-emissions --position <id> --pool <lp>

  Voting rewards (veNFT voters)
    Voters earn the fees + incentives of pools they vote for, claimable
    per epoch. Inspect what a pool paid recently:
      aero epochs-latest
      aero epochs --lp <pool address>

Epoch flip is Thursday 00:00 UTC — claim voting rewards after the flip.`,

  venft: `veNFTs (vote-escrow)
====================

Lock AERO (Base) or VELO (Optimism) into a veNFT to get voting power that
directs emissions and earns voting rewards.

  aero create-venft --amount 100 --use-decimals --lock-duration-seconds 31536000

Duration is rounded down to whole weeks; the maximum is 4 years. Longer lock
= more voting power. The plan includes the governance-token approval.

The SDK also builds every lifecycle transaction (the agent tools expose
them): increase / extend / merge / split / permanent locks, vote / reset /
poke, managed-veNFT deposits, rebase claims, and pool incentives.

Lock durations cheat sheet:
  1 week 604800 | 1 month 2592000 | 6 months 15552000
  1 year 31536000 | 4 years 126144000`,

  chains: `Chains
======

Every command accepts --chain <id>; the default is 8453 (Base, Aerodrome).

  10    Optimism (Velodrome)     1135  Lisk
  130   Unichain                 1868  Soneium
  252   Fraxtal                  5330  Superseed
  8453  Base (Aerodrome)         34443 Mode
  42220 Celo                     57073 Ink

RPC overrides: set SUGAR_RPC_URI_<chainId> (e.g. SUGAR_RPC_URI_8453) to use
your own endpoint instead of the public default.`,

  completions: `Shell completions
=================

aero ships completion scripts for bash, zsh, and fish:

  zsh   aero --completions zsh  > ~/.config/zsh/completions/_aero
        (ensure the directory is in your fpath, then: autoload -Uz compinit && compinit)

  bash  aero --completions bash > ~/.local/share/bash-completion/completions/aero

  fish  aero --completions fish > ~/.config/fish/completions/aero.fish

Completions cover every subcommand and flag, including choice values like
--pool-type. Regenerate after upgrading aero.

Also handy: every command supports --wizard for interactive, prompted input.`,
} satisfies Record<GuideTopic, string>

export const guideCommand = Command.make('guide', {
  topic: Argument.choice('topic', GUIDE_TOPICS).pipe(
    Argument.optional,
    Argument.withDescription('Guide to read (omit to list all topics)'),
  ),
}, Effect.fn(function* (config) {
  const topic = Option.getOrUndefined(config.topic)
  if (topic === undefined) {
    yield* Console.log([
      'aero guides — pick a topic:',
      '',
      ...GUIDE_TOPICS.map((name) => `  aero guide ${name}`),
      '',
      "New here? Start with 'aero guide getting-started'.",
    ].join('\n'))
    return
  }
  yield* Console.log(GUIDES[topic])
})).pipe(Command.withDescription('In-terminal walkthroughs: swaps, liquidity, staking, rewards, veNFTs'))
