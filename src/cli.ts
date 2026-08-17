#!/usr/bin/env bun

import { executeSugarAction, type SugarExecutionOptions } from './actions'
import { isSugarAction, isSugarTxAction, SUGAR_ACTIONS, type SugarAction, type SugarParameter, type SugarParameters } from './contracts'
import { extractPlanSteps, localMnemonicSigner, renderPlanSummary, sendPlan, type PlanSigner } from './send'
import {
  confirmPrompt, deleteLocalWallet, getActiveWallet, loadLocalWallet,
  loadWalletConnectRecord, openSecret, promptLine, saveLocalWallet, sealSecret, walletDir,
} from './wallet'

const BOOLEAN_FLAGS = new Set(['burn', 'collect', 'full', 'unwrap_native', 'use_decimals'])
const NUMBER_FLAGS = new Set([
  'chain', 'deadline_minutes', 'initial_price', 'limit', 'lock_duration_seconds', 'offset',
  'price_lower', 'price_upper', 'slippage', 'tick_lower', 'tick_spacing', 'tick_upper',
])

/** Default chain for the wallet-connected flow: Base, home of Aerodrome. */
const DEFAULT_CHAIN = 8453

export const SUGAR_CLI_HELP = `Usage: sugar-ts <action> [--flag=value]
       sugar-ts wallet <connect|create|restore|status|disconnect|remove>

Actions: ${SUGAR_ACTIONS.map((action) => action.replaceAll('_', '-')).join(', ')}

Reads print JSON. Transaction actions print an unsigned plan unless a wallet
is connected, in which case the CLI shows a summary, asks for confirmation,
then signs and broadcasts (WalletConnect wallets approve in-app).

Wallet commands:
  wallet connect     pair a browser-extension or mobile wallet over WalletConnect
  wallet create      generate a wallet; mnemonic is encrypted (scrypt + AES-256-GCM)
                     and stored in the macOS Keychain (file fallback elsewhere)
  wallet restore     import an existing mnemonic into the encrypted store
  wallet status      show the active wallet
  wallet disconnect  drop the WalletConnect session
  wallet remove      delete the local encrypted wallet

Transaction flags:
  --yes              skip the confirmation prompt
  --dry-run          always print the unsigned plan, never broadcast

Environment: WALLETCONNECT_PROJECT_ID, SUGAR_WALLET_PASSPHRASE (non-interactive
local signing), SUGAR_RPC_URI_<chain> (RPC override).`

function parseBoolean(name: string, value: string): boolean {
  if (value === 'true' || value === '1') return true
  if (value === 'false' || value === '0') return false
  throw new Error(`--${name.replaceAll('_', '-')} must be true or false`)
}

function coerceFlag(name: string, value: string): SugarParameter {
  if (BOOLEAN_FLAGS.has(name)) return parseBoolean(name, value)
  if (NUMBER_FLAGS.has(name)) {
    const number = Number(value)
    if (!Number.isFinite(number)) throw new Error(`--${name.replaceAll('_', '-')} must be a number`)
    return number
  }
  return value
}

export function parseSugarCliArgs(argv: string[]): { action: SugarAction; parameters: SugarParameters } {
  const [rawAction, ...flags] = argv
  if (!rawAction || rawAction === '--help' || rawAction === '-h') throw new Error(SUGAR_CLI_HELP)
  const action = rawAction.replaceAll('-', '_')
  if (!isSugarAction(action)) throw new Error(`Unknown Sugar action: ${rawAction}\n\n${SUGAR_CLI_HELP}`)
  const parameters: SugarParameters = {}
  for (let index = 0; index < flags.length; index++) {
    const flag = flags[index]
    if (!flag.startsWith('--')) throw new Error(`Unexpected positional argument: ${flag}`)
    const equals = flag.indexOf('=')
    const rawName = flag.slice(2, equals === -1 ? undefined : equals)
    const negated = rawName.startsWith('no-')
    const name = (negated ? rawName.slice(3) : rawName).replaceAll('-', '_')
    let value = equals === -1 ? undefined : flag.slice(equals + 1)
    if (negated) {
      if (!BOOLEAN_FLAGS.has(name) || value !== undefined) throw new Error(`Invalid negated flag: ${flag}`)
      parameters[name] = false
      continue
    }
    if (value === undefined && BOOLEAN_FLAGS.has(name)) {
      const following = flags[index + 1]
      if (following === 'true' || following === 'false') value = flags[++index]
      else value = 'true'
    } else if (value === undefined) {
      value = flags[++index]
      if (value === undefined || value.startsWith('--')) throw new Error(`Missing value for --${rawName}`)
    }
    parameters[name] = coerceFlag(name, value)
  }
  return { action, parameters }
}

export async function runSugarCli(
  argv = Bun.argv.slice(2),
  options: SugarExecutionOptions = {},
  write: (output: string) => void = console.log,
): Promise<string> {
  if (argv.length === 0 || argv[0] === '--help' || argv[0] === '-h') {
    write(SUGAR_CLI_HELP)
    return SUGAR_CLI_HELP
  }
  const { action, parameters } = parseSugarCliArgs(argv)
  const output = JSON.stringify(await executeSugarAction(action, parameters, options), null, 2)
  write(output)
  return output
}

/** Split wallet-flow flags (--yes, --dry-run) from the Sugar action flags. */
export function splitSendFlags(argv: string[]): { argv: string[]; yes: boolean; dryRun: boolean } {
  const rest: string[] = []
  let yes = false
  let dryRun = false
  for (const flag of argv) {
    if (flag === '--yes' || flag === '-y') yes = true
    else if (flag === '--dry-run') dryRun = true
    else rest.push(flag)
  }
  return { argv: rest, yes, dryRun }
}

async function passphraseFromEnvOrPrompt(label: string): Promise<string> {
  const env = process.env.SUGAR_WALLET_PASSPHRASE
  if (env) return env
  return promptLine(label, true)
}

async function createOrRestoreWallet(restore: boolean, log: (line: string) => void): Promise<void> {
  if (loadLocalWallet() && !(await confirmPrompt('A local wallet already exists. Overwrite it?'))) {
    log('Keeping the existing wallet.')
    return
  }
  const { english, generateMnemonic, mnemonicToAccount } = await import('viem/accounts')
  const mnemonic = restore
    ? (await promptLine('Mnemonic (input hidden): ', true)).trim().toLowerCase().replace(/\s+/g, ' ')
    : generateMnemonic(english)
  let address: `0x${string}`
  try {
    address = mnemonicToAccount(mnemonic).address
  } catch {
    throw new Error('that is not a valid BIP-39 mnemonic')
  }
  if (!restore) {
    log('\nYour new wallet mnemonic (write it down, it is shown ONCE and never stored in plaintext):\n')
    log(`  ${mnemonic}\n`)
  }
  const passphrase = await passphraseFromEnvOrPrompt('Choose an encryption passphrase (min 8 chars): ')
  if (passphrase.length < 8) throw new Error('passphrase must be at least 8 characters')
  if (!process.env.SUGAR_WALLET_PASSPHRASE) {
    const repeat = await promptLine('Repeat passphrase: ', true)
    if (repeat !== passphrase) throw new Error('passphrases do not match')
  }
  saveLocalWallet({ version: 1, kind: 'mnemonic', address, sealed: sealSecret(mnemonic, passphrase) })
  const backend = process.platform === 'darwin' && process.env.SUGAR_WALLET_NO_KEYCHAIN !== '1'
    ? 'macOS Keychain' : `encrypted file in ${walletDir()}`
  log(`Wallet ${restore ? 'restored' : 'created'}: ${address} (sealed with scrypt + AES-256-GCM, stored in the ${backend})`)
}

export async function runWalletCommand(argv: string[], log: (line: string) => void = console.log): Promise<void> {
  const [command] = argv
  if (command === 'connect') {
    const { connectWalletConnect } = await import('./walletconnect')
    const record = await connectWalletConnect(log)
    log(`Connected ${record.peer ?? 'wallet'}: ${record.address} (chains: ${record.chains.join(', ')})`)
    return
  }
  if (command === 'create' || command === 'restore') return createOrRestoreWallet(command === 'restore', log)
  if (command === 'status') {
    const active = getActiveWallet()
    if (!active) {
      log('No wallet configured. Run: wallet connect (WalletConnect) or wallet create / wallet restore (local).')
      return
    }
    if (active.source === 'walletconnect') {
      log(`Active wallet: ${active.address} via WalletConnect (${active.peer ?? 'unknown wallet'}, chains: ${active.chains.join(', ')})`)
    } else {
      log(`Active wallet: ${active.address} (local encrypted wallet)`)
    }
    if (active.source === 'walletconnect' && loadLocalWallet()) {
      log(`Also stored: local wallet ${loadLocalWallet()!.address} (used when WalletConnect is disconnected)`)
    }
    return
  }
  if (command === 'disconnect') {
    const { disconnectWalletConnect } = await import('./walletconnect')
    log(await disconnectWalletConnect() ? 'WalletConnect session disconnected.' : 'No WalletConnect session to disconnect.')
    return
  }
  if (command === 'remove') {
    const wallet = loadLocalWallet()
    if (!wallet) {
      log('No local wallet stored.')
      return
    }
    if (!(await confirmPrompt(`Delete the encrypted wallet for ${wallet.address}? Without the mnemonic backup the funds are unrecoverable.`))) {
      log('Keeping the wallet.')
      return
    }
    deleteLocalWallet()
    log('Local wallet deleted.')
    return
  }
  throw new Error(`Unknown wallet command: ${command ?? ''}\n\n${SUGAR_CLI_HELP}`)
}

async function resolveSigner(log: (line: string) => void, rpcUrl?: string): Promise<PlanSigner> {
  const wc = loadWalletConnectRecord()
  if (wc) {
    const { walletConnectSendTransaction } = await import('./walletconnect')
    return {
      address: wc.address,
      describe: `WalletConnect (${wc.peer ?? 'wallet'})`,
      send: (transaction, chainId) => walletConnectSendTransaction(transaction, chainId, log),
    }
  }
  const local = loadLocalWallet()
  if (!local) throw new Error('no wallet configured; run: wallet connect or wallet create')
  const passphrase = await passphraseFromEnvOrPrompt('Wallet passphrase: ')
  return localMnemonicSigner(openSecret(local.sealed, passphrase), rpcUrl)
}

/**
 * Wallet-aware entrypoint: reads behave exactly like runSugarCli; transaction
 * actions broadcast through the connected wallet after a confirmation prompt.
 */
export async function runAeroCli(
  argv = Bun.argv.slice(2),
  options: SugarExecutionOptions = {},
  write: (output: string) => void = console.log,
): Promise<void> {
  if (argv.length === 0 || argv[0] === '--help' || argv[0] === '-h') {
    write(SUGAR_CLI_HELP)
    return
  }
  if (argv[0] === 'wallet') {
    await runWalletCommand(argv.slice(1), write)
    return
  }
  const { argv: actionArgv, yes, dryRun } = splitSendFlags(argv)
  const { action, parameters } = parseSugarCliArgs(actionArgv)
  const active = getActiveWallet()
  if (parameters.chain === undefined && (active || isSugarTxAction(action))) parameters.chain = DEFAULT_CHAIN
  const explicitWallet = parameters.wallet !== undefined
  const walletAccepted = isSugarTxAction(action) || action === 'positions'
  if (!explicitWallet && active && walletAccepted) parameters.wallet = active.address
  const result = await executeSugarAction(action, parameters, options)
  const walletMatches = active !== undefined
    && String(parameters.wallet).toLowerCase() === active.address.toLowerCase()
  if (!isSugarTxAction(action) || dryRun || !walletMatches) {
    write(JSON.stringify(result, null, 2))
    if (isSugarTxAction(action) && !dryRun && !active) {
      console.error('\nHint: connect a wallet to broadcast this plan (sugar-ts wallet connect).')
    }
    if (isSugarTxAction(action) && !dryRun && active && !walletMatches) {
      console.error(`\nHint: --wallet differs from the connected wallet (${active.address}); printed the unsigned plan instead.`)
    }
    return
  }
  const steps = extractPlanSteps(result)
  write(renderPlanSummary(action, result, steps))
  if (!yes) {
    if (!process.stdin.isTTY) throw new Error('no TTY for the confirmation prompt; pass --yes or --dry-run')
    if (!(await confirmPrompt('Sign and broadcast?'))) {
      write('Aborted; nothing was sent.')
      return
    }
  }
  const chainId = Number(parameters.chain)
  const signer = await resolveSigner(write, options.rpcUrl)
  const hashes = await sendPlan({ steps, chainId, signer, rpcUrl: options.rpcUrl, log: write })
  write(JSON.stringify({ status: 'sent', chain: chainId, wallet: signer.address, hashes }, null, 2))
}

if (import.meta.main) {
  runAeroCli()
    .then(() => process.exit(0)) // The WalletConnect relay socket would otherwise keep the process alive.
    .catch((error) => {
      console.error(error instanceof Error ? error.message : String(error))
      process.exit(1)
    })
}
