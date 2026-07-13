#!/usr/bin/env bun

import { executeSugarActionJson, type SugarExecutionOptions } from './actions'
import { SUGAR_ACTIONS, type SugarAction, type SugarParameter, type SugarParameters } from './index'

const BOOLEAN_FLAGS = new Set(['burn', 'collect', 'full', 'unwrap_native', 'use_decimals'])
const NUMBER_FLAGS = new Set([
  'chain', 'deadline_minutes', 'initial_price', 'limit', 'offset',
  'price_lower', 'price_upper', 'slippage', 'tick_lower', 'tick_spacing', 'tick_upper',
])

export const SUGAR_CLI_HELP = `Usage: sugar-ts <action> [--flag=value]

Actions: ${SUGAR_ACTIONS.map((action) => action.replaceAll('_', '-')).join(', ')}

The CLI prints JSON reads or unsigned transactions. It never signs or broadcasts.`

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
  if (!SUGAR_ACTIONS.includes(action as SugarAction)) throw new Error(`Unknown Sugar action: ${rawAction}\n\n${SUGAR_CLI_HELP}`)
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
  return { action: action as SugarAction, parameters }
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
  const output = await executeSugarActionJson(action, parameters, options)
  write(output)
  return output
}

if (import.meta.main) {
  runSugarCli().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
}
