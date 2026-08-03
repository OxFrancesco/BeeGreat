/** Pass only allowlisted Sugar settings across the Convex/SDK boundary. */
export function sugarRuntimeEnvironment(
  source: object,
): Record<string, string> {
  const { SUGAR_RPC_URI_8453: rawBaseRpcUrl } = source as {
    readonly SUGAR_RPC_URI_8453?: unknown
  }
  const baseRpcUrl =
    typeof rawBaseRpcUrl === 'string' ? rawBaseRpcUrl.trim() : ''
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
      if (SUGAR_BOOLEAN_PARAMETERS.has(name) && typeof value !== 'boolean') {
        if (typeof value === 'string') {
          const normalized = value.trim().toLowerCase()
          if (normalized === 'true') return [name, true]
          if (normalized === 'false') return [name, false]
        }
        throw new Error(`${name} must be a boolean`)
      }
      if (SUGAR_NUMBER_PARAMETERS.has(name) && typeof value === 'string') {
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
