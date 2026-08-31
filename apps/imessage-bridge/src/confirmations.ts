// Interprets an incoming prompt against Bee's pending interactive state — the
// first-focus preview / web3 confirmation / highlight-completion decision
// ladder — and produces the reply. Guard clauses keep the original decision
// order: first-focus confirm/cancel, then web3 confirm/cancel, then highlight
// completion, then a plain prompt to Bee.

import type { DeliveredAttachment } from '@flue/sdk'
import type { Space } from 'spectrum-ts'
import type { AgentTransport, FirstFocusActionInput } from './agent-transport'
import {
  isFirstFocusCancellation,
  isFirstFocusConfirmation,
  isHighlightCompletion,
  isWeb3Cancellation,
  isWeb3Confirmation,
  resolveQuestionAnswer,
  type FirstFocusPreview,
} from './bee-response'
import { askBee, latestInteractiveReply } from './conversation'
import { replyForWeb3Action, type BeeReply } from './reply'

export type ChannelContext = {
  threadId: number
  activeHighlight: {
    highlightId: string
    taskId: string
    title: string
    expiresAt: number
  } | null
}

export type PromptResolution = {
  reply: BeeReply
  celebrate: boolean
  directWeb3Reply: boolean
}

function firstFocusActionInput(preview: FirstFocusPreview) {
  const input: FirstFocusActionInput = {
    requestId: preview.requestId,
    goalTitle: preview.goalTitle,
    projectTitle: preview.projectTitle,
    taskTitle: preview.taskTitle,
  }
  if (preview.highlightExpiresAt) {
    input.highlightExpiresAt = preview.highlightExpiresAt
  }
  return input
}

export async function resolvePromptReply(input: {
  transport: AgentTransport
  space: Space
  userId: string
  context: ChannelContext
  prompt: string
  images: DeliveredAttachment[]
}): Promise<PromptResolution> {
  const { transport, space, userId, context, prompt, images } = input
  const numberedQuestionReply = /^\s*\[?\d+\]?\s*(?:,\s*\[?\d+\]?\s*)*$/.test(
    prompt,
  )
  const questionReply = numberedQuestionReply
    ? await latestInteractiveReply(transport, userId, context.threadId)
    : undefined
  const deliveredPrompt = resolveQuestionAnswer(questionReply?.question, prompt)

  if (isFirstFocusConfirmation(prompt) || isFirstFocusCancellation(prompt)) {
    const interactive = await latestInteractiveReply(
      transport,
      userId,
      context.threadId,
    )
    const preview = interactive.firstFocus
    if (preview) {
      if (isFirstFocusConfirmation(prompt)) {
        await transport.channelAction(userId, {
          action: 'confirm_first_focus',
          ...firstFocusActionInput(preview),
        })
        return {
          reply: await askBee(
            transport,
            space,
            userId,
            context.threadId,
            '[BeeGreat app event] The first-focus plan was confirmed and persisted successfully. Acknowledge it; do not create or mutate the plan again.',
          ),
          celebrate: false,
          directWeb3Reply: false,
        }
      }
      await transport.channelAction(userId, {
        action: 'cancel_first_focus',
        ...firstFocusActionInput(preview),
      })
      return {
        reply: await askBee(
          transport,
          space,
          userId,
          context.threadId,
          '[BeeGreat app event] The first-focus preview was cancelled. Nothing was created. Acknowledge the cancellation; do not create or mutate the plan.',
        ),
        celebrate: false,
        directWeb3Reply: false,
      }
    }
    const web3Confirmation = interactive.web3
    if (
      web3Confirmation &&
      (isWeb3Confirmation(prompt) || isWeb3Cancellation(prompt))
    ) {
      const confirmed = isWeb3Confirmation(prompt)
      const current = await transport.web3ActionFor(
        userId,
        web3Confirmation.actionId,
      )
      if (!current) {
        throw new Error('This Web3 confirmation is no longer available.')
      }
      if (current.status !== 'pending') {
        return {
          reply: replyForWeb3Action(current),
          celebrate: false,
          directWeb3Reply: true,
        }
      }
      if (current.kind === 'execute_eoa_plan' && confirmed) {
        return {
          reply: replyForWeb3Action(current),
          celebrate: false,
          directWeb3Reply: true,
        }
      }
      await transport.channelAction(userId, {
        action: confirmed ? 'confirm_web3' : 'cancel_web3',
        actionId: web3Confirmation.actionId,
        summary: current.summary,
      })
      const updated = await transport.web3ActionFor(
        userId,
        web3Confirmation.actionId,
      )
      return {
        reply: replyForWeb3Action(
          updated ?? {
            ...current,
            status: confirmed ? 'confirmed' : 'cancelled',
          },
        ),
        celebrate: false,
        directWeb3Reply: true,
      }
    }
    return {
      reply: await askBee(
        transport,
        space,
        userId,
        context.threadId,
        deliveredPrompt,
        images,
      ),
      celebrate: false,
      directWeb3Reply: false,
    }
  }

  if (isHighlightCompletion(prompt) && context.activeHighlight) {
    const highlight = context.activeHighlight
    const completion = await transport.channelAction<{
      status: 'completed' | 'already_completed'
      honeyAwarded: number
      scoreAwarded: number
    }>(userId, {
      action: 'complete_highlight',
      requestId: `complete-highlight:${highlight.highlightId}`,
      taskId: highlight.taskId,
    })
    return {
      reply: await askBee(
        transport,
        space,
        userId,
        context.threadId,
        `[BeeGreat app event] Highlight "${highlight.title}" was completed successfully. The verified award was ${completion.honeyAwarded} Honey and ${completion.scoreAwarded} Honeycomb Score. Acknowledge this completion and reward only; do not call a completion tool or create, update, or mutate any data again.`,
      ),
      celebrate: completion.status === 'completed',
      directWeb3Reply: false,
    }
  }

  return {
    reply: await askBee(
      transport,
      space,
      userId,
      context.threadId,
      deliveredPrompt,
      images,
    ),
    celebrate: false,
    directWeb3Reply: false,
  }
}
