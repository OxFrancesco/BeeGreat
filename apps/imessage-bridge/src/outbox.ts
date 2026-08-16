// Polls the agent's iMessage outbox for terminal web3 delivery states and
// pushes them to the recipient's DM. Claims use a lease so a crashed bridge
// never strands a delivery; failures are retried server-side.

import { projectTextWeb3Action } from '@beegreat/tool-presentation'
import { markdown, richlink, type Space } from 'spectrum-ts'
import type { AgentTransport } from './agent-transport'
import type { Web3ActionProjection } from './bee-response'
import { captureBridgeFailure } from './failures'

export type ClaimedDelivery = {
  deliveryId: string
  leaseId: string
  address: string
  action: {
    summary: string
    kind: NonNullable<Web3ActionProjection['kind']>
    status: 'executed' | 'failed' | 'refunded' | 'expired'
    detail?: string
    error?: string
    explorerLink?: string
  }
}

export function startTerminalDeliveryPolling(
  transport: AgentTransport,
  openDm: (address: string) => Promise<Space>,
) {
  let deliveryPollActive = false
  async function pollTerminalDeliveries() {
    if (deliveryPollActive) return
    deliveryPollActive = true
    const leaseId = crypto.randomUUID()
    let delivery: ClaimedDelivery | null = null
    try {
      delivery = await transport.outboxAction<ClaimedDelivery | null>(
        'claim_delivery',
        { leaseId },
      )
      if (!delivery) return
      const projected = projectTextWeb3Action({
        summary: delivery.action.summary,
        kind: delivery.action.kind,
        status: delivery.action.status,
        autoConfirmed: false,
        error: delivery.action.error,
        socketProgress: delivery.action.detail
          ? {
              detail: delivery.action.detail,
              destinationExplorerLink: delivery.action.explorerLink,
            }
          : null,
        result: delivery.action.explorerLink
          ? [{ hash: null, explorerLink: delivery.action.explorerLink }]
          : null,
      })
      const dm = await openDm(delivery.address)
      await dm.send(markdown(projected.text))
      for (const link of projected.links) await dm.send(richlink(link))
      await transport.outboxAction('complete_delivery', {
        deliveryId: delivery.deliveryId,
        leaseId: delivery.leaseId,
      })
    } catch (error) {
      captureBridgeFailure(error, 'outbox.deliver')
      if (delivery) {
        await transport
          .outboxAction('retry_delivery', {
            deliveryId: delivery.deliveryId,
            leaseId: delivery.leaseId,
          })
          .catch(() => {})
      }
    } finally {
      deliveryPollActive = false
    }
  }

  const deliveryTimer = setInterval(() => void pollTerminalDeliveries(), 3_000)
  deliveryTimer.unref()
  void pollTerminalDeliveries()
  return deliveryTimer
}
