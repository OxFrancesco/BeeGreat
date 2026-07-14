export const SUGAR_ACTIONS = [
  'deposit',
  'positions',
  'pools',
  'epochs_latest',
  'epochs',
  'withdraw',
  'stake',
  'unstake',
  'claim_emissions',
  'claim_fees',
  'quote',
  'swap',
] as const

export type SugarAction = (typeof SUGAR_ACTIONS)[number]
export type SugarParameter = string | number | boolean
export type SugarParameters = Record<string, SugarParameter>

export function isSugarAction(value: unknown): value is SugarAction {
  return typeof value === 'string' && (SUGAR_ACTIONS as readonly string[]).includes(value)
}
