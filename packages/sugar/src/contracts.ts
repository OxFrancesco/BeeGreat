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
  'create_venft',
  'quote',
  'swap',
] as const

export type SugarAction = (typeof SUGAR_ACTIONS)[number]
export type SugarParameter = string | number | boolean
export type SugarParameters = Record<string, SugarParameter>

export function isSugarAction(value: unknown): value is SugarAction {
  return typeof value === 'string' && (SUGAR_ACTIONS as readonly string[]).includes(value)
}

/** The subset of actions that build transactions (executable plans). */
export const SUGAR_TX_ACTIONS = [
  'swap',
  'deposit',
  'withdraw',
  'stake',
  'unstake',
  'claim_emissions',
  'claim_fees',
  'create_venft',
] as const

export type SugarTxAction = (typeof SUGAR_TX_ACTIONS)[number]

export function isSugarTxAction(value: unknown): value is SugarTxAction {
  return typeof value === 'string' && (SUGAR_TX_ACTIONS as readonly string[]).includes(value)
}
