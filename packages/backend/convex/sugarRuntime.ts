import * as Predicate from 'effect/Predicate'

/**
 * Configuration surfaces (the typed Convex env, test fixtures) that may carry
 * the Sugar Base RPC override alongside unrelated settings.
 */
type SugarRuntimeSource = {
  readonly SUGAR_RPC_URI_8453?: string | undefined
  readonly [setting: string]: string | undefined
}

/** Pass only allowlisted Sugar settings across the Convex/SDK boundary. */
export function sugarRuntimeEnvironment(
  source: SugarRuntimeSource,
): Record<string, string> {
  const baseRpcUrl = source.SUGAR_RPC_URI_8453?.trim() ?? ''
  return baseRpcUrl ? { SUGAR_RPC_URI_8453: baseRpcUrl } : {}
}

const SUGAR_BOOLEAN_PARAMETERS = new Set([
  'burn',
  'collect',
  'full',
  'unwrap_native',
  'use_decimals',
])

const SUGAR_NUMBER_PARAMETERS = new Set([
  'chain',
  'deadline_minutes',
  'initial_price',
  'limit',
  'offset',
  'price_lower',
  'price_upper',
  'slippage',
  'tick_lower',
  'tick_spacing',
  'tick_upper',
])

/** Normalize the narrow coercions accepted from model-generated tool input. */
export function normalizeSugarAgentParameters(
  parameters: Record<string, string | number | boolean>,
): Record<string, string | number | boolean> {
  return Object.fromEntries(
    Object.entries(parameters).map(([name, value]) => {
      if (SUGAR_BOOLEAN_PARAMETERS.has(name) && !Predicate.isBoolean(value)) {
        if (Predicate.isString(value)) {
          const normalized = value.trim().toLowerCase()
          if (normalized === 'true') return [name, true]
          if (normalized === 'false') return [name, false]
        }
        throw new Error(`${name} must be a boolean`)
      }
      if (SUGAR_NUMBER_PARAMETERS.has(name) && Predicate.isString(value)) {
        const trimmed = value.trim()
        const parsed = Number(trimmed)
        if (trimmed === '' || !Number.isFinite(parsed)) {
          throw new Error(`${name} must be a finite number`)
        }
        return [name, parsed]
      }
      return [name, value]
    }),
  )
}
