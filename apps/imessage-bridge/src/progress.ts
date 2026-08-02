import { getToolCopy } from '@beegreat/tool-presentation'
import type { ConversationStreamChunk } from '@flue/sdk'

const FIRST_HEARTBEAT_MS = 4_000
const LONG_HEARTBEAT_MS = 18_000
const MAX_PROGRESS_MESSAGES = 6

type ToolActivity = {
  input: unknown
  name: string
}

function presentedToolActivity(
  activity: ToolActivity,
  state: 'running' | 'done' | 'error',
) {
  const copy = getToolCopy(activity.name, state, activity.input)
  const owner = copy.powerup ?? copy.specialist
  return owner ? `${owner}: ${copy.label}` : copy.label
}

/**
 * Reduces Flue's public lifecycle stream to bounded, user-safe iMessage copy.
 * Reasoning/text deltas and tool inputs/outputs are intentionally never echoed.
 */
export function createIMessageProgressProjector(startedAt = Date.now()) {
  const tools = new Map<string, ToolActivity>()
  const seenEvents = new Set<string>()
  let firstHeartbeatSent = false
  let longHeartbeatSent = false
  let sent = 0

  function take(message: string) {
    if (sent >= MAX_PROGRESS_MESSAGES) return undefined
    sent += 1
    return message
  }

  return {
    event(chunk: ConversationStreamChunk, _now = Date.now()) {
      if (chunk.type === 'tool-input') {
        const eventKey = `input:${chunk.toolCallId}`
        if (seenEvents.has(eventKey)) return undefined
        seenEvents.add(eventKey)
        const activity = { name: chunk.toolName, input: chunk.input }
        tools.set(chunk.toolCallId, activity)
        return take(presentedToolActivity(activity, 'running'))
      }

      if (
        chunk.type === 'tool-output' ||
        chunk.type === 'tool-output-error'
      ) {
        const activity = tools.get(chunk.toolCallId)
        if (!activity) return undefined
        const eventKey = `output:${chunk.toolCallId}`
        if (seenEvents.has(eventKey)) return undefined
        seenEvents.add(eventKey)
        return take(
          presentedToolActivity(
            activity,
            chunk.type === 'tool-output-error' ? 'error' : 'done',
          ),
        )
      }

      return undefined
    },

    heartbeat(now = Date.now()) {
      const elapsed = now - startedAt
      if (!firstHeartbeatSent && elapsed >= FIRST_HEARTBEAT_MS) {
        firstHeartbeatSent = true
        return take('Still working on it…')
      }
      if (!longHeartbeatSent && elapsed >= LONG_HEARTBEAT_MS) {
        longHeartbeatSent = true
        return take(
          'This is taking a little longer — I’m still working on it.',
        )
      }
      return undefined
    },
  }
}

export function createIMessageProgressReporter(
  send: (message: string) => Promise<unknown>,
  onError: (error: unknown) => void,
) {
  const projector = createIMessageProgressProjector()
  let queue = Promise.resolve()

  function emit(message: string | undefined) {
    if (!message) return
    queue = queue.then(async () => {
      try {
        await send(message)
      } catch (error) {
        onError(error)
      }
    })
  }

  const heartbeat = setInterval(() => {
    emit(projector.heartbeat())
  }, 1_000)

  return {
    event(chunk: ConversationStreamChunk) {
      emit(projector.event(chunk))
    },
    async stop() {
      clearInterval(heartbeat)
      await queue
    },
  }
}
