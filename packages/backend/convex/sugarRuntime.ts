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

/** Normalize the narrow coercions accepted from model-generated tool input. */
export function normalizeSugarAgentParameters(
  parameters: Record<string, string | number | boolean>,
): Record<string, string | number | boolean> {
  return Object.fromEntries(
    Object.entries(parameters).map(([name, value]) => {
      if (!SUGAR_BOOLEAN_PARAMETERS.has(name) || typeof value === 'boolean') {
        return [name, value]
      }
      if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase()
        if (normalized === 'true') return [name, true]
        if (normalized === 'false') return [name, false]
      }
      throw new Error(`${name} must be a boolean`)
    }),
  )
}
