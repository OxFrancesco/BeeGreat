// Address handling shared by the iMessage link flow. The bridge normalizes
// senders the same way (apps/imessage-bridge); the two must stay in sync so a
// linked address always resolves.

export type ImessageAddressKind = 'phone' | 'email'

/** Phone numbers compare without formatting; emails compare lowercased. */
export function normalizeImessageAddress(address: string) {
  const trimmed = address.trim().toLowerCase()
  return trimmed.includes('@') ? trimmed : trimmed.replace(/[\s().-]/g, '')
}

export function imessageAddressKind(address: string): ImessageAddressKind {
  return address.includes('@') ? 'email' : 'phone'
}

export function isValidImessageAddress(address: string) {
  const normalized = normalizeImessageAddress(address)
  if (normalized.length < 3 || normalized.length > 320) return false
  return imessageAddressKind(normalized) === 'email'
    ? /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)
    : /^\+?[0-9]{3,20}$/.test(normalized)
}

/** Shows enough of the address to recognize it without exposing all of it. */
export function maskImessageAddress(address: string) {
  const normalized = normalizeImessageAddress(address)
  if (imessageAddressKind(normalized) === 'email') {
    const [local, domain] = normalized.split('@')
    const visible = local.slice(0, 2)
    return `${visible}${'•'.repeat(Math.max(local.length - 2, 1))}@${domain}`
  }
  return `${normalized.slice(0, 2)}•••${normalized.slice(-4)}`
}
