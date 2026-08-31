import { createLinearChannel } from '@flue/linear'
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

function asString(value: JsonValue | undefined): string | null {
  return v.is(stringSchema, value) ? value : null
}

export const channel = createLinearChannel({
  webhookSecret: channelSecret('LINEAR_WEBHOOK_SECRET'),
  async webhook({ payload, deliveryId }) {
    // Linear delivers JSON webhook payloads; decode once, then narrow the
    // fields the signal needs.
    const event: JsonRecord = v.is(jsonRecordSchema, payload) ? payload : {}
    const actor = asRecord(event.actor)
    const actorId = asString(actor?.id) ?? undefined
    const workspaceId = asString(event.organizationId) ?? undefined
    const claim = await claimBeennectorDelivery({
      provider: 'linear',
      deliveryId,
      actorId,
      workspaceId,
    })
    if (claim.status !== 'accepted') return undefined

    const data = asRecord(event.data)
    const type = `linear.${String(event.type ?? 'event')}`
    const action = String(event.action ?? 'updated')
    const identifier = asString(data?.identifier)
    const title = asString(data?.title)
    const body = asString(data?.body)
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
          actor: asString(actor?.name),
          itemId: asString(data?.id),
          identifier,
          title,
          issueId: asString(data?.issueId),
          url: asString(data?.url),
        }),
      },
    })
    return undefined
  },
})
