// HTTP transport to the BeeGreat Flue agent worker: conversation-scoped Flue
// clients plus the bridge's channel, outbox, web3, and voice endpoints.

import type { ChatMessageSyncEnvelope } from '@beegreat/chat-sync'
import { createFlueClient, type FlueClient } from '@flue/sdk'
import type { Web3ActionProjection } from './bee-response'

const BEE_AGENT_NAME = 'bee'

export type AgentTransportOptions = {
  agentUrl: string
  bridgeSecret: string
}

/** Identifying fields of a first-focus preview echoed back on confirm/cancel. */
export type FirstFocusActionInput = {
  requestId: string
  goalTitle: string
  projectTitle: string
  taskTitle: string
  highlightExpiresAt?: number
}

/** One request the bridge can make of the worker's /bridge/channel endpoint. */
export type ChannelActionBody =
  | { action: 'context'; source: 'imessage'; sourceAddress: string }
  | { action: 'create_thread'; source: 'imessage'; sourceAddress: string }
  | { action: 'title_thread'; threadId: number; title: string }
  | {
      action: 'sync_transcript'
      threadId: number
      messages: ChatMessageSyncEnvelope[]
    }
  | ({
      action: 'confirm_first_focus' | 'cancel_first_focus'
    } & FirstFocusActionInput)
  | { action: 'confirm_web3' | 'cancel_web3'; actionId: string; summary: string }
  | { action: 'get_web3_action'; actionId: string }
  | { action: 'complete_highlight'; requestId: string; taskId: string }

/** Delivery lease fields the worker's /bridge/outbox actions operate on. */
export type OutboxActionInput = {
  leaseId: string
  deliveryId?: string
}

/** Every bridge endpoint reports a non-ok response through this envelope. */
type BridgeErrorBody = {
  error?: string
}

/** The worker's /voice/transcribe endpoint answers with text or an error. */
type VoiceTranscriptionBody = {
  text?: string
  error?: string
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
    body: ChannelActionBody,
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
    // SAFETY: /bridge/channel is the bridge's own worker; a non-ok response
    // carries the shared bridge error envelope, and an unparseable body is
    // normalized to null.
    const result = (await response.json().catch(() => null)) as
      | BridgeErrorBody
      | null
    if (!response.ok) {
      const message =
        result?.error ?? `Bee channel action failed (HTTP ${response.status})`
      throw Object.assign(new Error(message), {
        status: response.status,
        body: result,
      })
    }
    // SAFETY: on an ok response the /bridge/channel worker returns the result
    // shape of the requested `action`; the caller instantiates T to that
    // action's contract, which TypeScript cannot verify across the wire.
    return result as T
  }

  async function outboxAction<T>(
    action: 'claim_delivery' | 'complete_delivery' | 'retry_delivery',
    input: OutboxActionInput,
  ): Promise<T> {
    const response = await fetch(`${agentUrl}/bridge/outbox`, {
      method: 'POST',
      headers: { ...bridgeHeaders, 'content-type': 'application/json' },
      body: JSON.stringify({ action, ...input }),
    })
    // SAFETY: on an ok response the /bridge/outbox worker returns the result
    // shape of the requested `action`; the caller instantiates T to that
    // action's contract, which TypeScript cannot verify across the wire.
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
    // SAFETY: /voice/transcribe is the bridge's own worker; it answers with
    // the transcription envelope (`text` on success, `error` on failure), and
    // an unparseable body is normalized to null.
    const result = (await response.json().catch(() => null)) as
      | VoiceTranscriptionBody
      | null
    if (!response.ok || !result || result.text === undefined) {
      const message =
        result?.error ?? `Voice transcription failed (HTTP ${response.status})`
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
