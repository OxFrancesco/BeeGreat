// HTTP transport to the BeeGreat Flue agent worker: conversation-scoped Flue
// clients plus the bridge's channel, outbox, web3, and voice endpoints.

import { createFlueClient, type FlueClient } from '@flue/sdk'
import type { Web3ActionProjection } from './bee-response'

const BEE_AGENT_NAME = 'bee'

export type AgentTransportOptions = {
  agentUrl: string
  bridgeSecret: string
}

function conversationId(userId: string, threadId: number) {
  return threadId > 0 ? `${userId}~${threadId}` : userId
}

export function createAgentTransport(options: AgentTransportOptions) {
  const agentUrl = options.agentUrl.replace(/\/$/, '')
  const bridgeSecret = options.bridgeSecret
  const bridgeHeaders = {
    'x-bridge-secret': bridgeSecret,
  }

  // Flue 2.0 clients are conversation-scoped: one client per conversation URL.
  // The worker authorizes the bridge via shared secret and scopes every request
  // to one user, so each mapped user+thread pair gets its own client.
  const clients = new Map<string, FlueClient>()
  function clientFor(userId: string, threadId: number) {
    const url = `${agentUrl}/agents/${BEE_AGENT_NAME}/${conversationId(userId, threadId)}`
    let client = clients.get(url)
    if (!client) {
      client = createFlueClient({
        url,
        headers: { 'x-bridge-secret': bridgeSecret, 'x-bridge-user': userId },
      })
      clients.set(url, client)
    }
    return client
  }

  async function channelAction<T>(
    userId: string,
    body: Record<string, unknown>,
  ): Promise<T> {
    const response = await fetch(`${agentUrl}/bridge/channel`, {
      method: 'POST',
      headers: {
        ...bridgeHeaders,
        'x-bridge-user': userId,
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    })
    const result = (await response.json().catch(() => null)) as Record<
      string,
      unknown
    > | null
    if (!response.ok) {
      const message =
        result && typeof result.error === 'string'
          ? result.error
          : `Bee channel action failed (HTTP ${response.status})`
      throw Object.assign(new Error(message), {
        status: response.status,
        body: result,
      })
    }
    return result as T
  }

  async function outboxAction<T>(
    action: 'claim_delivery' | 'complete_delivery' | 'retry_delivery',
    input: Record<string, unknown>,
  ): Promise<T> {
    const response = await fetch(`${agentUrl}/bridge/outbox`, {
      method: 'POST',
      headers: { ...bridgeHeaders, 'content-type': 'application/json' },
      body: JSON.stringify({ action, ...input }),
    })
    const result = (await response.json().catch(() => null)) as T
    if (!response.ok) {
      throw new Error(`iMessage outbox failed (HTTP ${response.status})`)
    }
    return result
  }

  async function web3ActionFor(userId: string, actionId: string) {
    return await channelAction<(Web3ActionProjection & { id: string }) | null>(
      userId,
      {
        action: 'get_web3_action',
        actionId,
      },
    )
  }

  async function transcribeVoice(
    userId: string,
    bytes: Buffer,
    mimeType: string,
  ) {
    const response = await fetch(`${agentUrl}/voice/transcribe`, {
      method: 'POST',
      headers: {
        ...bridgeHeaders,
        'x-bridge-user': userId,
        'content-type': mimeType,
      },
      body: bytes,
    })
    const result = (await response.json().catch(() => null)) as {
      text?: unknown
      error?: unknown
    } | null
    if (!response.ok || !result || typeof result.text !== 'string') {
      const message =
        result && typeof result.error === 'string'
          ? result.error
          : `Voice transcription failed (HTTP ${response.status})`
      throw Object.assign(new Error(message), {
        status: response.status,
        body: result,
      })
    }
    return result.text.trim()
  }

  return {
    clientFor,
    channelAction,
    outboxAction,
    web3ActionFor,
    transcribeVoice,
  }
}

export type AgentTransport = ReturnType<typeof createAgentTransport>
