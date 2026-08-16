// Formats Bee replies for iMessage and sends them: markdown body (optionally
// with a confetti celebration effect) followed by rich links, re-projecting
// any pending web3 confirmation against its current server-side status.

import { projectTextWeb3Action } from '@beegreat/tool-presentation'
import { markdown, richlink, type Space } from 'spectrum-ts'
import { effect, imessage } from 'spectrum-ts/providers/imessage'
import {
  projectWeb3Action,
  type BeeResponseProjection,
  type Web3ActionProjection,
} from './bee-response'
import type { AgentTransport } from './agent-transport'

export type BeeReply = BeeResponseProjection

export function replyForWeb3Action(action: Web3ActionProjection): BeeReply {
  const projected = projectTextWeb3Action(action)
  return {
    spoken: '',
    markdown: projected.text,
    links: projected.links,
  }
}

export async function sendReply(
  transport: AgentTransport,
  space: Space,
  reply: BeeReply,
  userId: string,
  celebrate = false,
) {
  const currentWeb3 = reply.web3Confirmation
    ? await transport
        .web3ActionFor(userId, reply.web3Confirmation.actionId)
        .catch(() => null)
    : null
  let projected = reply
  if (currentWeb3) {
    projected = projectWeb3Action(reply, currentWeb3)
  } else if (reply.web3Confirmation) {
    projected = projectWeb3Action(reply, {
      summary: reply.web3Confirmation.summary,
      status: 'expired',
      autoConfirmed: false,
    })
  }
  if (projected.markdown) {
    await space.send(
      celebrate
        ? effect(markdown(projected.markdown), imessage.effect.message.confetti)
        : markdown(projected.markdown),
    )
  }
  for (const link of projected.links) {
    await space.send(richlink(link))
  }
}
