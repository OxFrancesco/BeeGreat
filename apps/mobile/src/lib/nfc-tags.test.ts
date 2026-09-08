// @ts-expect-error Bun provides this runtime module without a workspace type package.
import { expect, mock, test } from 'bun:test'
let release: () => void = () => {}
let cancellations = 0
let writes = 0
mock.module('react-native-nfc-manager', () => ({
  default: {
    start: async () => {}, isSupported: async () => true, isEnabled: async () => true,
    requestTechnology: () => new Promise<void>((resolve) => { release = resolve }),
    ndefHandler: { writeNdefMessage: async () => { writes++ } },
    setAlertMessageIOS: async () => {},
    cancelTechnologyRequest: async () => { cancellations++ },
  },
  Ndef: { encodeMessage: () => [1], uriRecord: (value: string) => value },
  NfcTech: { Ndef: 'Ndef' },
}))
const { writeNfcActionTag } = await import('./nfc-tags')
test('overlapping write cannot cancel the original NFC request', async () => {
  const first = writeNfcActionTag('beegreat://nfc/first')
  await new Promise((resolve) => setTimeout(resolve, 5))
  await expect(writeNfcActionTag('beegreat://nfc/second')).rejects.toThrow('Another tag write')
  expect(cancellations).toBe(0)
  release()
  await first
  expect(writes).toBe(1)
  expect(cancellations).toBe(1)
  const next = writeNfcActionTag('beegreat://nfc/next')
  await new Promise((resolve) => setTimeout(resolve, 5))
  release()
  await next
  expect(writes).toBe(2)
})
