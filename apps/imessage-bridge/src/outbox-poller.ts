export type PollClock = {
  schedule: (callback: () => void, delayMs: number) => () => void
  random: () => number
}

const clock: PollClock = {
  schedule(callback, delayMs) {
    const timer = setTimeout(callback, delayMs)
    timer.unref()
    return () => clearTimeout(timer)
  },
  random: Math.random,
}

// A completed claim is the only point that schedules another request. Slow
// requests never overlap, and a stopped instance cannot restart its timer.
export function startOutboxPoller(
  poll: () => Promise<boolean>,
  onError: (cause: unknown) => void,
  timing: PollClock = clock,
) {
  let stopped = false
  let idleDelay = 3_000
  let cancelTimer = () => {}
  let inFlight: Promise<void>

  async function run() {
    let worked = false
    try {
      worked = await poll()
    } catch (error) {
      onError(error)
    }
    if (stopped) return
    const delay = worked ? 3_000 : idleDelay
    idleDelay = worked ? 3_000 : Math.min(60_000, idleDelay * 2)
    // Downward jitter keeps the idle bound at 60s, including at the cap.
    const jittered = Math.round(delay * (0.8 + timing.random() * 0.2))
    cancelTimer = timing.schedule(() => { inFlight = run() }, jittered)
  }

  inFlight = run()
  return {
    async stop() {
      stopped = true
      cancelTimer()
      await inFlight
    },
  }
}
