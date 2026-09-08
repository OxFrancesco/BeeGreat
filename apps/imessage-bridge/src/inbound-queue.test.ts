import { expect, test } from 'bun:test'
import { readAttachment } from './content'
import { acceptsPrivateMessage, createInboundQueue, untilAborted } from './inbound-queue'

const tick = () => new Promise(resolve => setTimeout(resolve, 5))

test('only verified direct messages can enter account handling', () => {
  expect(acceptsPrivateMessage({ type: 'dm' })).toBe(true)
  for (const type of ['group', undefined, null, 'DM', '']) expect(acceptsPrivateMessage({ type })).toBe(false)
})

test('one blocked sender cannot monopolize workers and sender admission stays bounded', async () => {
  const seen: string[] = []
  let release!: () => void
  const blocked = new Promise<void>(resolve => { release = resolve })
  const queue = createInboundQueue({ concurrency: 2, perSenderLimit: 2, onError: () => {} })
  queue.enqueue('a', async () => { seen.push('a1'); await blocked })
  expect(queue.enqueue('a', async () => { seen.push('a2') })).toBe(true)
  expect(queue.enqueue('a', async () => { seen.push('a3') })).toBe(false)
  queue.enqueue('b', async () => { seen.push('b') })
  await tick()
  expect(seen).toEqual(['a1', 'b'])
  release()
  await tick()
  expect(seen).toEqual(['a1', 'b', 'a2'])
})

test('primary and fallback failures cannot stop the next message', async () => {
  const failures: unknown[] = []
  const seen: string[] = []
  const queue = createInboundQueue({ concurrency: 1, onError: error => { failures.push(error) } })
  queue.enqueue('a', async () => {
    try { throw new Error('primary') } catch { throw new Error('fallback') }
  })
  queue.enqueue('b', async () => { seen.push('b') })
  await tick()
  expect(failures).toHaveLength(1)
  expect(seen).toEqual(['b'])
})

test('deadline aborts attachment processing before paid work and releases the sender', async () => {
  let release!: () => void
  const attachment = new Promise<void>(resolve => { release = resolve })
  const seen: string[] = []
  const queue = createInboundQueue({ timeoutMs: 10, onError: () => {} })
  queue.enqueue('a', async signal => {
    await untilAborted(attachment, signal)
    signal.throwIfAborted()
    seen.push('paid')
  })
  queue.enqueue('a', async () => { seen.push('next') })
  await new Promise(resolve => setTimeout(resolve, 30))
  release()
  await tick()
  expect(seen).toEqual(['next'])
})

test('attachment timeout cancels the underlying stream', async () => {
  let cancelled = 0
  const stream = new ReadableStream<Uint8Array>({ cancel() { cancelled++ } })
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(new Error('Timed out')), 10)
  await expect(readAttachment({ stream: async () => stream }, controller.signal)).rejects.toThrow()
  clearTimeout(timer)
  expect(cancelled).toBe(1)
})
