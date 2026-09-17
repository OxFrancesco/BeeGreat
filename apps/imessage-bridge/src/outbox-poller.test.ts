import { describe, expect, test } from 'bun:test'
import { startOutboxPoller, type PollClock } from './outbox-poller'

function manualClock(random = 1) {
  let now = 0
  let next: { at: number; callback: () => void } | undefined
  const delays: number[] = []
  const timing: PollClock = {
    random: () => random,
    schedule(callback, delayMs) {
      delays.push(delayMs)
      next = { at: now + delayMs, callback }
      return () => { next = undefined }
    },
  }
  async function flush() {
    for (let i = 0; i < 10; i++) await Promise.resolve()
  }
  return {
    timing, delays, flush,
    now: () => now,
    async advance(ms: number) {
      await flush()
      const end = now + ms
      while (next && next.at <= end) {
        now = next.at
        const callback = next.callback
        next = undefined
        callback()
        await flush()
      }
      now = end
    },
  }
}

const fail = (error: unknown) => { throw error }

describe('outbox request scheduling', () => {
  test('empty queue uses 9 claims over the first five minutes, then at most one per minute without jitter', async () => {
    const clock = manualClock()
    let claims = 0
    const poller = startOutboxPoller(async () => { claims++; return false }, fail, clock.timing)
    await clock.advance(300_000)
    expect(claims).toBe(9)
    expect(clock.delays.slice(0, 6)).toEqual([3_000, 6_000, 12_000, 24_000, 48_000, 60_000])
    await clock.advance(300_000)
    expect(claims).toBe(14)
    await poller.stop()
  })

  test('new delivery after prolonged idle is found within 60 seconds and drains backlog quickly', async () => {
    const clock = manualClock()
    let pending = 0
    const delivered: number[] = []
    const poller = startOutboxPoller(async () => {
      if (!pending) return false
      pending--
      delivered.push(clock.now())
      return true
    }, fail, clock.timing)
    await clock.advance(300_000)
    pending = 3
    await clock.advance(60_000)
    expect(delivered).toEqual([333_000, 336_000, 339_000])
    expect(pending).toBe(0)
    await poller.stop()
  })

  test('claim failures back off and reconnect resumes work', async () => {
    const clock = manualClock()
    let online = false
    let errors = 0
    let deliveries = 0
    const poller = startOutboxPoller(async () => {
      if (!online) throw new Error('offline')
      deliveries++
      return true
    }, () => { errors++ }, clock.timing)
    await clock.advance(300_000)
    expect(errors).toBe(9)
    online = true
    await clock.advance(36_000)
    expect(deliveries).toBe(2)
    expect(clock.delays.at(-1)).toBe(3_000)
    await poller.stop()
  })

  test('slow requests never overlap; stop drains the request and cancels future claims', async () => {
    const clock = manualClock()
    let resolve: (worked: boolean) => void = () => {}
    let claims = 0
    const poller = startOutboxPoller(() => {
      claims++
      return new Promise<boolean>(done => { resolve = done })
    }, fail, clock.timing)
    await clock.advance(300_000)
    expect(claims).toBe(1)
    let stopped = false
    const stopping = poller.stop().then(() => { stopped = true })
    await clock.flush()
    expect(stopped).toBe(false)
    resolve(true)
    await stopping
    await clock.advance(300_000)
    expect(claims).toBe(1)
  })

  test('shutdown during idle cancels timer; restarting claims immediately', async () => {
    const clock = manualClock()
    let claims = 0
    const poll = async () => { claims++; return false }
    const first = startOutboxPoller(poll, fail, clock.timing)
    await clock.advance(300_000)
    await first.stop()
    await clock.advance(300_000)
    expect(claims).toBe(9)
    const second = startOutboxPoller(poll, fail, clock.timing)
    expect(claims).toBe(10)
    await second.stop()
  })

  test('independent instances use bounded jitter to spread claims', async () => {
    const early = manualClock(0)
    const late = manualClock(1)
    const a = startOutboxPoller(async () => false, fail, early.timing)
    const b = startOutboxPoller(async () => false, fail, late.timing)
    await early.advance(300_000)
    await late.advance(300_000)
    expect(early.delays.slice(0, 6)).toEqual([2400, 4800, 9600, 19200, 38400, 48000])
    expect(late.delays.at(-1)).toBe(60000)
    await Promise.all([a.stop(), b.stop()])
  })
})
