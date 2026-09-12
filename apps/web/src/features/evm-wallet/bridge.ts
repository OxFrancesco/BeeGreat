import { Schema } from 'effect'
import { Address, ChainId, Plan } from '@beegreat/evm/model'

export const BridgeMessage = Schema.Union([
  Schema.Struct({
    kind: Schema.Literal('ready'),
    chainId: ChainId,
    expected: Schema.optionalKey(Address),
  }),
  Schema.Struct({
    kind: Schema.Literal('request'),
    id: Schema.String,
    method: Schema.String,
    params: Schema.Array(Schema.Json),
    chainId: ChainId,
    account: Address,
  }),
])
export interface Pairing {
  port: number
  token: string
  expires: number
}
const Pairing = Schema.Struct({
  port: Schema.Int.check(Schema.isBetween({ minimum: 1, maximum: 65535 })),
  token: Schema.String.check(Schema.isPattern(/^[a-f0-9]{64}$/)),
  expires: Schema.Number,
})
const storageKey = 'evm-wallet-pairing'

export function readPairing(): Pairing | null {
  const url = new URL(window.location.href)
  if (/^#[a-f0-9]{64}$/.test(url.hash)) {
    const decoded = Schema.decodeUnknownOption(Pairing)({
      port: Number(url.searchParams.get('bridgePort')),
      token: url.hash.slice(1),
      expires: Date.now() + 600_000,
    })
    url.hash = ''
    window.history.replaceState(null, '', url)
    if (decoded._tag === 'Some')
      sessionStorage.setItem(storageKey, JSON.stringify(decoded.value))
  }
  const saved = Schema.decodeUnknownOption(Schema.fromJsonString(Pairing))(
    sessionStorage.getItem(storageKey),
  )
  if (saved._tag === 'None' || saved.value.expires < Date.now()) {
    sessionStorage.removeItem(storageKey)
    return null
  }
  return saved.value
}
export function forgetPairing() {
  sessionStorage.removeItem(storageKey)
}
export const decodePlan = Schema.decodeUnknownSync(Plan)
