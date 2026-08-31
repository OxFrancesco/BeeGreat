export class NfcUnavailableError extends Error {}

export async function isNfcAvailable() {
  return false
}

export async function writeNfcActionTag(_url: string): Promise<never> {
  throw new NfcUnavailableError('NFC tag writing is available in the BeeGreat mobile app.')
}

export function nfcErrorMessage(cause: unknown) {
  return cause instanceof Error
    ? cause.message
    : 'NFC tag writing is available in the BeeGreat mobile app.'
}
