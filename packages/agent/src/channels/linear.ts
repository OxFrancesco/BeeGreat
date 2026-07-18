import { createLinearChannel } from '@flue/linear'
import { dispatch } from '@flue/runtime'
import bee from '../agents/bee.ts'
import {
  beennectorAgentId,
  channelSecret,
  claimBeennectorDelivery,
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
    if (claim.status !== 'accepted') return

    const data =
      event.data && typeof event.data === 'object'
        ? (event.data as Record<string, unknown>)
        : undefined
    await dispatch(bee, {
      id: beennectorAgentId(claim.userId, 'linear'),
      input: {
        type: `linear.${String(event.type ?? 'event')}`,
        deliveryId,
        action: String(event.action ?? 'updated'),
        organizationId: workspaceId ?? null,
        actor: typeof actor?.name === 'string' ? actor.name : null,
        item: data
          ? {
              id: typeof data.id === 'string' ? data.id : null,
              identifier:
                typeof data.identifier === 'string' ? data.identifier : null,
              title: typeof data.title === 'string' ? data.title : null,
              body: typeof data.body === 'string' ? data.body : null,
              issueId: typeof data.issueId === 'string' ? data.issueId : null,
              url: typeof data.url === 'string' ? data.url : null,
            }
          : null,
      },
    })
  },
})
