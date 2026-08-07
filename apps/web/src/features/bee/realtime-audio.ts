export const XAI_SAMPLE_RATE = 24_000

export function floatToPcm16(
  input: Float32Array,
  inputRate: number,
  outputRate = XAI_SAMPLE_RATE,
) {
  const ratio = inputRate / outputRate
  const outputLength = Math.max(1, Math.round(input.length / ratio))
  const output = new Uint8Array(outputLength * 2)
  const view = new DataView(output.buffer)
  for (let index = 0; index < outputLength; index += 1) {
    const start = Math.floor(index * ratio)
    const end = Math.min(input.length, Math.floor((index + 1) * ratio))
    let sum = 0
    for (let source = start; source < Math.max(start + 1, end); source += 1) {
      sum += input[Math.min(source, input.length - 1)]
    }
    const sample = Math.max(-1, Math.min(1, sum / Math.max(1, end - start)))
    view.setInt16(
      index * 2,
      sample < 0 ? sample * 0x8000 : sample * 0x7fff,
      true,
    )
  }
  return output
}

export function pcm16ToFloat(bytes: Uint8Array) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const output = new Float32Array(Math.floor(bytes.byteLength / 2))
  for (let index = 0; index < output.length; index += 1) {
    output[index] = view.getInt16(index * 2, true) / 0x8000
  }
  return output
}

export function bytesToBase64(bytes: Uint8Array) {
  let binary = ''
  const chunkSize = 0x8000
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize))
  }
  return btoa(binary)
}

export function base64ToBytes(value: string) {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes
}
