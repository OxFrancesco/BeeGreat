import {
  callBeennectorService,
  type BeennectorProvider,
} from './client.ts'

type DeliveryClaim =
  | { status: 'accepted'; userId: string }
  | {
      status:
        | 'duplicate'
        | 'unmapped'
        | 'ambiguous'
        | 'subscription_required'
    }

function requiredWorkerValue(name: string) {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`${name} is not configured`)
  return value
}

export function channelSecret(name: string) {
  // Channel packages validate options at module evaluation. A deterministic
  // non-secret keeps local builds runnable; real deliveries cannot verify
  // until the deployment supplies the documented secret.
  return process.env[name]?.trim() || `unconfigured-${name.toLowerCase()}`
}

export async function claimBeennectorDelivery(input: {
  provider: BeennectorProvider
  deliveryId: string
  actorId?: string
  workspaceId?: string
}) {
  return await callBeennectorService<DeliveryClaim>(
    requiredWorkerValue('CONVEX_URL'),
    {
      convexSiteUrl: process.env.CONVEX_SITE_URL,
      brokerSecret:
        process.env.AGENT_CREDENTIAL_BROKER_SECRET ?? process.env.BRIDGE_SECRET,
    },
    { operation: 'claim_delivery', ...input },
  )
}

export function beennectorAgentId(
  userId: string,
  provider: BeennectorProvider,
) {
  return `${userId}~beennector-${provider}`
}

/** Flattens webhook facts into the string-only attributes a signal message carries. */
export function signalAttributes(
  values: Record<string, string | number | null | undefined>,
) {
  const attributes: Record<string, string> = {}
  for (const [key, value] of Object.entries(values)) {
    if (value !== null && value !== undefined) attributes[key] = String(value)
  }
  return attributes
}
