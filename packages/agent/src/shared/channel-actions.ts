import type { JsonValue } from '@flue/runtime'

import { callFocusService } from './focus-client'

export type ChannelActionName =
  | 'context'
  | 'create_thread'
  | 'create_cli_thread'
  | 'title_thread'
  | 'sync_transcript'
  | 'confirm_first_focus'
  | 'cancel_first_focus'
  | 'complete_highlight'
  | 'confirm_web3'
  | 'cancel_web3'
  | 'get_web3_action'

export type ChannelActionOptions = {
  convexUrl: string
  convexSiteUrl?: string
  brokerSecret?: string
  clerkIssuer: string
}

export function channelOwnerKey(clerkIssuer: string, userId: string) {
  return `${clerkIssuer.trim().replace(/\/$/, '')}|${userId}`
}

/**
 * Trusted channel adapters submit intent here; Convex still owns validation,
 * idempotency, atomic writes, and focus-economy settlement.
 */
export async function callChannelAction<T extends JsonValue = JsonValue>(
  options: ChannelActionOptions,
  userId: string,
  action: ChannelActionName,
  input: Record<string, JsonValue | undefined> = {},
  fetcher: typeof fetch = fetch,
): Promise<T> {
  return await callFocusService<T>(
    userId,
    options.convexUrl,
    {
      convexSiteUrl: options.convexSiteUrl,
      brokerSecret: options.brokerSecret,
    },
    `channel_${action}`,
    {
      ...input,
      ownerKey: channelOwnerKey(options.clerkIssuer, userId),
    },
    fetcher,
  )
}
