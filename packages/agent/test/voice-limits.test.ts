import { expect, test } from 'bun:test'
import { readLimitedBody } from '../src/shared/limited-body'
import { connectVoiceSockets } from '../src/routes/realtime-proxy'

test('chunked and understated bodies stop at the byte cap and cancel their stream', async () => {
  for (const headers of [{}, { 'content-length': '1' }]) {
    let cancelled = false
    const body = new ReadableStream({ pull(controller) { controller.enqueue(new Uint8Array(8)) }, cancel() { cancelled = true } })
    const request = new Request('https://example.test/voice', { method: 'POST', headers, body })
    await expect(readLimitedBody(request, 10)).rejects.toThrow(/too large/)
    expect(cancelled).toBe(true)
  }
  expect(await readLimitedBody(new Request('https://example.test/voice', { method: 'POST', body: 'hello' }), 10)).toEqual(new TextEncoder().encode('hello'))
})

class Socket extends EventTarget {
  closed = false
  sent: Array<string | ArrayBuffer> = []
  send(value: string | ArrayBuffer) { this.sent.push(value) }
  close() { this.closed = true }
}

test('server deadline closes both sockets and oversized input never reaches the provider', async () => {
  const client = new Socket()
  const upstream = new Socket()
  let released = 0
  // Only the event, send, and close methods are exercised by the transport helper.
  const stop = connectVoiceSockets(client as unknown as WebSocket, upstream as unknown as WebSocket, Date.now() + 15, () => { released++ })
  client.dispatchEvent(new MessageEvent('message', { data: 'a'.repeat(256 * 1024 + 1) }))
  expect(upstream.sent).toEqual([])
  expect(client.closed && upstream.closed).toBe(true)
  stop()
  expect(released).toBe(1)
  const secondClient = new Socket()
  const secondUpstream = new Socket()
  connectVoiceSockets(secondClient as unknown as WebSocket, secondUpstream as unknown as WebSocket, Date.now() + 10, () => {})
  await new Promise(resolve => setTimeout(resolve, 20))
  expect(secondClient.closed && secondUpstream.closed).toBe(true)
})
