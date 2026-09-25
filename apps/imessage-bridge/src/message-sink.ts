import type { Space } from 'spectrum-ts'

/** The delivery operation used by replies and progress updates. */
export type MessageSink = {
  send(content: Parameters<Space['send']>[0]): Promise<void>
}
