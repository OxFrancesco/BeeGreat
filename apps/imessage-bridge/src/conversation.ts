// Conversation layer over the Flue agent: sends prompts with live progress,
// mirrors transcripts to Convex, and reads back the latest interactive state
// (first-focus previews, web3 confirmations, questions) from history.

import { changedMessagesForConvexSync } from '@beegreat/chat-sync'
import { FlueApiError, type DeliveredAttachment, type FlueClient } from '@flue/sdk'
import { text, type Space } from 'spectrum-ts'
import type { AgentTransport } from './agent-transport'
import {
  extractBeeResponse,
  latestFirstFocusPreview,
  latestQuestion,
  latestWeb3Confirmation,
} from './bee-response'
import { captureBridgeFailure } from './failures'
import { createIMessageProgressReporter } from './progress'
import type { BeeReply } from './reply'

/** Sends one prompt to Bee and returns both spoken copy and projected UI. */
export async function askBee(
  transport: AgentTransport,
  space: Space,
  userId: string,
  threadId: number,
  body: string,
  images: DeliveredAttachment[] = [],
): Promise<BeeReply> {
  const client = transport.clientFor(userId, threadId)
  const progress = createIMessageProgressReporter(
    async (message) => {
      await space.send(text(message))
    },
    (error) => captureBridgeFailure(error, 'progress.send', userId),
  )
  try {
    const admission = await client.send({
      message: images.length
        ? { kind: 'user', body, attachments: images }
        : { kind: 'user', body },
    })
    let currentStepText = ''
    let finalStepText = ''
    // read() awaits settlement and resolves with the reply; wait() alone no
    // longer carries the assistant text in Flue 2.0.
    const result = await client.read(admission, {
      onEvent: (event) => {
        progress.event(event)
        if (event.type === 'message-started') {
          currentStepText = ''
        } else if (event.type === 'message-delta' && event.kind === 'text') {
          currentStepText += event.delta
        } else if (
          event.type === 'message-completed' &&
          currentStepText.trim()
        ) {
          finalStepText = currentStepText
        }
      },
    })
    try {
      const messages = changedMessagesForConvexSync(
        (await client.history()).messages,
        new Map(),
      ).slice(-200)
      await transport.channelAction(userId, {
        action: 'sync_transcript',
        threadId,
        messages,
      })
    } catch (error) {
      // A transcript mirror outage must not suppress an otherwise valid reply.
      captureBridgeFailure(error, 'transcript.sync', userId)
    }
    // Flue accumulates tool stages in one envelope. The final completed text
    // step is the coherent user-facing stage; fall back only for transports
    // that do not emit text deltas.
    return extractBeeResponse(
      (finalStepText || currentStepText).trim() || result.text,
    )
  } finally {
    await progress.stop()
  }
}

export async function latestInteractiveReply(
  transport: AgentTransport,
  userId: string,
  threadId: number,
) {
  let messages: Awaited<ReturnType<FlueClient['history']>>['messages']
  try {
    messages = (await transport.clientFor(userId, threadId).history()).messages
  } catch (error) {
    // Flue 2 only creates a conversation's stream on its first prompt, so a
    // fresh thread has no history yet — that just means nothing interactive.
    if (error instanceof FlueApiError && error.status === 404) {
      return { firstFocus: undefined, web3: undefined, question: undefined }
    }
    throw error
  }
  return {
    firstFocus: latestFirstFocusPreview(messages),
    web3: latestWeb3Confirmation(messages),
    question: latestQuestion(messages),
  }
}

export async function syncDirectExchange(
  transport: AgentTransport,
  userId: string,
  threadId: number,
  messageId: string,
  prompt: string,
  reply: BeeReply,
  createdAt: number,
) {
  const assistantText = reply.markdown || reply.spoken
  if (!assistantText) return
  const messages = [
    {
      id: `imessage:${messageId}:user`,
      role: 'user' as const,
      text: prompt,
      createdAt,
    },
    {
      id: `imessage:${messageId}:assistant`,
      role: 'assistant' as const,
      text: assistantText,
      createdAt: createdAt + 1,
    },
  ].map(({ id, role, text: body, createdAt: timestamp }) => ({
    id,
    role,
    contentJson: JSON.stringify({
      id,
      role,
      parts: [{ type: 'text', text: body, state: 'done' }],
      metadata: {
        timestamp: new Date(timestamp).toISOString(),
        channel: 'imessage',
      },
    }),
    createdAt: timestamp,
  }))
  await transport.channelAction(userId, {
    action: 'sync_transcript',
    threadId,
    messages,
  })
}
