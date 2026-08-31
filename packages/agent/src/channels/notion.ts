import { createNotionChannel } from '@flue/notion'
import type { JsonValue } from '@flue/runtime'
import * as v from 'valibot'
import { dispatchBee } from '../agents/bee.ts'
import {
  beennectorAgentId,
  channelSecret,
  claimBeennectorDelivery,
  signalAttributes,
} from '../shared/beennectors/channel.ts'
import { jsonRecordSchema, type JsonRecord } from '../shared/json.ts'

const stringSchema = v.string()

function asRecord(value: JsonValue | undefined): JsonRecord | undefined {
  return v.is(jsonRecordSchema, value) ? value : undefined
}

export const channel = createNotionChannel({
  verificationToken: channelSecret('NOTION_VERIFICATION_TOKEN'),
  async webhook({ event }) {
    // Notion delivers JSON webhook payloads; decode once, then narrow the
    // fields the signal needs.
    const payload: JsonRecord = v.is(jsonRecordSchema, event) ? event : {}
    const authors = Array.isArray(payload.authors) ? payload.authors : []
    const firstAuthor = asRecord(authors[0])
    const actorId = v.is(stringSchema, firstAuthor?.id)
      ? firstAuthor?.id
      : undefined
    const workspaceId = v.is(stringSchema, payload.workspace_id)
      ? payload.workspace_id
      : undefined
    const deliveryId = v.is(stringSchema, payload.id)
      ? payload.id
      : `${String(payload.type)}:${String(payload.timestamp)}`
    const claim = await claimBeennectorDelivery({
      provider: 'notion',
      deliveryId,
      actorId,
      workspaceId,
    })
    if (claim.status !== 'accepted') return undefined

    const entity = asRecord(payload.entity)
    const data = asRecord(payload.data)
    const parent = asRecord(data?.parent)
    const entityId = entity?.id
    const entityType = entity?.type
    const parentId = parent?.id
    const parentType = parent?.type
    const type = String(payload.type ?? 'notion.event')
    await dispatchBee({
      id: beennectorAgentId(claim.userId, 'notion'),
      message: {
        kind: 'signal',
        type,
        body: `${type}${entity && v.is(stringSchema, entityId) ? ` on ${String(entity.type ?? 'entity')} ${entityId}` : ''}`,
        attributes: signalAttributes({
          deliveryId,
          workspaceId: workspaceId ?? null,
          entityId: v.is(stringSchema, entityId) ? entityId : null,
          entityType: v.is(stringSchema, entityType) ? entityType : null,
          parentId: v.is(stringSchema, parentId) ? parentId : null,
          parentType: v.is(stringSchema, parentType) ? parentType : null,
        }),
      },
    })
    return undefined
  },
})
