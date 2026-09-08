export function acceptsPrivateMessage(space: { type: unknown }) {
  return space.type === 'dm'
}

export function untilAborted<T>(operation: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return operation
  return new Promise<T>((resolve, reject) => {
    const abort = () => reject(signal.reason ?? new Error('Message timed out'))
    const cleanup = () => signal.removeEventListener('abort', abort)
    operation.then(value => { cleanup(); resolve(value) }, error => { cleanup(); reject(error) })
    if (signal.aborted) abort()
    else signal.addEventListener('abort', abort, { once: true })
  })
}

export function createInboundQueue(options: {
  concurrency?: number
  perSenderLimit?: number
  totalLimit?: number
  timeoutMs?: number
  onError: (error: unknown) => void
}) {
  const queues = new Map<string, Array<(signal: AbortSignal) => Promise<void>>>()
  const active = new Set<string>()
  let count = 0
  function drain() {
    while (active.size < (options.concurrency ?? 4)) {
      const next = [...queues].find(([key]) => !active.has(key))
      if (!next) return
      const [key, pending] = next
      const task = pending.shift()!
      queues.delete(key)
      if (pending.length) queues.set(key, pending)
      active.add(key)
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(new Error('Message timed out')), options.timeoutMs ?? 120_000)
      void Promise.resolve().then(() => task(controller.signal))
        .catch(error => { try { options.onError(error) } catch {} })
        .finally(() => {
          clearTimeout(timer)
          active.delete(key)
          count--
          // Rotate this sender behind other waiting senders.
          const remaining = queues.get(key)
          if (remaining) { queues.delete(key); queues.set(key, remaining) }
          drain()
        })
    }
  }
  return {
    enqueue(key: string, task: (signal: AbortSignal) => Promise<void>) {
      const pending = queues.get(key) ?? []
      if (count >= (options.totalLimit ?? 256) || pending.length + Number(active.has(key)) >= (options.perSenderLimit ?? 8)) return false
      pending.push(task)
      queues.set(key, pending)
      count++
      drain()
      return true
    },
  }
}
