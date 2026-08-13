import { createLinearChannel } from '@flue/linear'
import { dispatchBee } from '../agents/bee.ts'
import {
  beennectorAgentId,
  channelSecret,
  claimBeennectorDelivery,
  signalAttributes,
} from '../shared/beennectors/channel.ts'

export const channel = createLinearChannel({
  webhookSecret: channelSecret('LINEAR_WEBHOOK_SECRET'),
  async webhook({ payload, deliveryId }) {
    const event = payload as unknown as Record<string, unknown>
    const actor =
      event.actor && typeof event.actor === 'object'
        ? (event.actor as Record<string, unknown>)
        : undefined
    const actorId = typeof actor?.id === 'string' ? actor.id : undefined
    const workspaceId =
      typeof event.organizationId === 'string'
        ? event.organizationId
        : undefined
    const claim = await claimBeennectorDelivery({
      provider: 'linear',
      deliveryId,
      actorId,
      workspaceId,
    })
    if (claim.status !== 'accepted') return undefined

    const data =
      event.data && typeof event.data === 'object'
        ? (event.data as Record<string, unknown>)
        : undefined
    const type = `linear.${String(event.type ?? 'event')}`
    const action = String(event.action ?? 'updated')
    const identifier =
      typeof data?.identifier === 'string' ? data.identifier : null
    const title = typeof data?.title === 'string' ? data.title : null
    const body = typeof data?.body === 'string' ? data.body : null
    await dispatchBee({
      id: beennectorAgentId(claim.userId, 'linear'),
      message: {
        kind: 'signal',
        type,
        body:
          body ||
          `${action}${identifier ? ` ${identifier}` : ''}${title ? `: ${title}` : ''}`,
        attributes: signalAttributes({
          deliveryId,
          action,
          organizationId: workspaceId ?? null,
          actor: typeof actor?.name === 'string' ? actor.name : null,
          itemId: typeof data?.id === 'string' ? data.id : null,
          identifier,
          title,
          issueId: typeof data?.issueId === 'string' ? data.issueId : null,
          url: typeof data?.url === 'string' ? data.url : null,
        }),
      },
    })
    return undefined
  },
})
