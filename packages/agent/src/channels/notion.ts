import { createNotionChannel } from '@flue/notion'
import { dispatch } from '@flue/runtime'
import { Bee } from '../agents/bee.ts'
import {
  beennectorAgentId,
  channelSecret,
  claimBeennectorDelivery,
  signalAttributes,
} from '../shared/beennectors/channel.ts'

export const channel = createNotionChannel({
  verificationToken: channelSecret('NOTION_VERIFICATION_TOKEN'),
  async webhook({ event }) {
    const payload = event as unknown as Record<string, unknown>
    const authors = Array.isArray(payload.authors)
      ? (payload.authors as Array<Record<string, unknown>>)
      : []
    const actorId =
      typeof authors[0]?.id === 'string' ? authors[0].id : undefined
    const workspaceId =
      typeof payload.workspace_id === 'string' ? payload.workspace_id : undefined
    const deliveryId =
      typeof payload.id === 'string'
        ? payload.id
        : `${String(payload.type)}:${String(payload.timestamp)}`
    const claim = await claimBeennectorDelivery({
      provider: 'notion',
      deliveryId,
      actorId,
      workspaceId,
    })
    if (claim.status !== 'accepted') return undefined

    const entity =
      payload.entity && typeof payload.entity === 'object'
        ? (payload.entity as Record<string, unknown>)
        : undefined
    const data =
      payload.data && typeof payload.data === 'object'
        ? (payload.data as Record<string, unknown>)
        : undefined
    const parent =
      data?.parent && typeof data.parent === 'object'
        ? (data.parent as Record<string, string | null>)
        : undefined
    const type = String(payload.type ?? 'notion.event')
    await dispatch(Bee, {
      id: beennectorAgentId(claim.userId, 'notion'),
      message: {
        kind: 'signal',
        type,
        body: `${type}${entity && typeof entity.id === 'string' ? ` on ${String(entity.type ?? 'entity')} ${entity.id}` : ''}`,
        attributes: signalAttributes({
          deliveryId,
          workspaceId: workspaceId ?? null,
          entityId: typeof entity?.id === 'string' ? entity.id : null,
          entityType: typeof entity?.type === 'string' ? entity.type : null,
          parentId: typeof parent?.id === 'string' ? parent.id : null,
          parentType: typeof parent?.type === 'string' ? parent.type : null,
        }),
      },
    })
    return undefined
  },
})
