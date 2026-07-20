export class NfcUnavailableError extends Error {}

type NfcModule = typeof import('react-native-nfc-manager')

let modulePromise: Promise<NfcModule> | null = null
let started = false

async function loadNfcModule() {
  modulePromise ??= import('react-native-nfc-manager').catch(() => {
    modulePromise = null
    throw new NfcUnavailableError(
      'NFC needs a new BeeGreat development or production build on a physical phone.',
    )
  })
  return modulePromise
}

async function getReadyNfc() {
  const nfc = await loadNfcModule()
  if (!started) {
    await nfc.default.start()
    started = true
  }
  if (!(await nfc.default.isSupported())) {
    throw new NfcUnavailableError('This phone does not support NFC tags.')
  }
  if (!(await nfc.default.isEnabled())) {
    throw new NfcUnavailableError('Turn on NFC in your phone settings and try again.')
  }
  return nfc
}

export async function isNfcAvailable() {
  try {
    await getReadyNfc()
    return true
  } catch {
    return false
  }
}

export async function writeNfcActionTag(url: string) {
  const nfc = await getReadyNfc()
  const bytes = nfc.Ndef.encodeMessage([nfc.Ndef.uriRecord(url)])

  try {
    await nfc.default.requestTechnology(nfc.NfcTech.Ndef, {
      alertMessage: 'Hold your phone near the NFC tag.',
    })
    await nfc.default.ndefHandler.writeNdefMessage(bytes)
    if (process.env.EXPO_OS === 'ios') {
      await nfc.default.setAlertMessageIOS('Your BeeGreat tap action is ready.')
    }
  } finally {
    await nfc.default.cancelTechnologyRequest({ throwOnError: false })
  }
}

export function nfcErrorMessage(error: unknown) {
  if (error instanceof NfcUnavailableError) return error.message
  if (error instanceof Error) {
    const normalized = error.message.toLowerCase()
    if (normalized.includes('cancel') || normalized.includes('invalidate')) {
      return 'Tag writing was cancelled.'
    }
    if (normalized.includes('read only') || normalized.includes('not writable')) {
      return 'That NFC tag is read-only. Try another writable tag.'
    }
    if (normalized.includes('small') || normalized.includes('capacity')) {
      return 'That NFC tag does not have enough space.'
    }
  }
  return 'Could not write the NFC tag. Hold it steady and try again.'
}
