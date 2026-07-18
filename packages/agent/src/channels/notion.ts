import { createNotionChannel } from '@flue/notion'
import { dispatch } from '@flue/runtime'
import bee from '../agents/bee.ts'
import {
  beennectorAgentId,
  channelSecret,
  claimBeennectorDelivery,
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
    if (claim.status !== 'accepted') return

    const entity =
      payload.entity && typeof payload.entity === 'object'
        ? (payload.entity as Record<string, unknown>)
        : undefined
    const data =
      payload.data && typeof payload.data === 'object'
        ? (payload.data as Record<string, unknown>)
        : undefined
    await dispatch(bee, {
      id: beennectorAgentId(claim.userId, 'notion'),
      input: {
        type: String(payload.type ?? 'notion.event'),
        deliveryId,
        workspaceId: workspaceId ?? null,
        entity: entity
          ? {
              id: typeof entity.id === 'string' ? entity.id : null,
              type: typeof entity.type === 'string' ? entity.type : null,
            }
          : null,
        parent:
          data?.parent && typeof data.parent === 'object'
            ? (data.parent as Record<string, string | null>)
            : null,
      },
    })
  },
})
