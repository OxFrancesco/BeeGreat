import { toError } from '@beegreat/observability'
import { changedMessagesForConvexSync } from '@beegreat/chat-sync'
import { projectTextWeb3Action } from '@beegreat/tool-presentation'
import {
  createFlueClient,
  FlueApiError,
  type DeliveredAttachment,
  type FlueClient,
} from '@flue/sdk'
import * as Sentry from '@sentry/bun'
import { markdown, richlink, type Space, Spectrum, text } from 'spectrum-ts'
import { effect, imessage } from 'spectrum-ts/providers/imessage'
import { promptFailureReply } from './agent-error'
import {
  extractBeeResponse,
  isFirstFocusCancellation,
  isFirstFocusConfirmation,
  isHighlightCompletion,
  isWeb3Cancellation,
  isWeb3Confirmation,
  latestFirstFocusPreview,
  latestQuestion,
  latestWeb3Confirmation,
  projectWeb3Action,
  resolveQuestionAnswer,
  type FirstFocusPreview,
  type Web3ActionProjection,
} from './bee-response'
import { createIdentityClient, normalizeAddress } from './identity'
import { createIMessageProgressReporter } from './progress'

// Bridges iMessage (via Spectrum Cloud) to the BeeGreat Flue agent worker.
// Senders linked in Convex are answered as their BeeGreat user; unknown
// senders get one magic link to sign in or sign up and link this address.

const BEE_AGENT_NAME = 'bee'
const NEW_CONVERSATION_COMMANDS = new Set(['/clear', '/new'])
const UNLINK_COMMANDS = new Set(['/unlink', '/disconnect'])

type ChannelContext = {
  threadId: number
  activeHighlight: {
    highlightId: string
    taskId: string
    title: string
    expiresAt: number
  } | null
}

type IncomingPrompt = {
  text: string
  images: DeliveredAttachment[]
  unsupportedAttachment: boolean
}

type BeeReply = ReturnType<typeof extractBeeResponse>

type ClaimedDelivery = {
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

function replyForWeb3Action(action: Web3ActionProjection): BeeReply {
  const projected = projectTextWeb3Action(action)
  return {
    spoken: '',
    markdown: projected.text,
    links: projected.links,
  }
}

function captureBridgeFailure(
  error: unknown,
  operation: string,
  userId?: string,
) {
  Sentry.withScope((scope) => {
    scope.setTag('service', 'imessage-bridge')
    scope.setTag('operation', operation)
    scope.setTag('handled', 'true')
    if (userId) scope.setUser({ id: userId })
    Sentry.captureException(toError(error))
  })
}

const REQUIRED_ENV = [
  'PROJECT_ID',
  'PROJECT_SECRET',
  'AGENT_URL',
  'BRIDGE_SECRET',
]
const missing = REQUIRED_ENV.filter((name) => !process.env[name])
if (missing.length > 0) {
  console.warn(
    `imessage-bridge: not configured (missing ${missing.join(', ')}); see .env.example`,
  )
  captureBridgeFailure(
    new Error(
      `iMessage bridge configuration is incomplete: ${missing.join(', ')}`,
    ),
    'startup.configuration',
  )
  await Sentry.flush(2_000)
  process.exit(1)
}

const AGENT_URL = process.env.AGENT_URL!
const BRIDGE_SECRET = process.env.BRIDGE_SECRET!
const bridgeHeaders = {
  'x-bridge-secret': BRIDGE_SECRET,
}

const identity = createIdentityClient({
  agentUrl: AGENT_URL,
  bridgeSecret: BRIDGE_SECRET,
})

function conversationId(userId: string, threadId: number) {
  return threadId > 0 ? `${userId}~${threadId}` : userId
}

// Flue 2.0 clients are conversation-scoped: one client per conversation URL.
// The worker authorizes the bridge via shared secret and scopes every request
// to one user, so each mapped user+thread pair gets its own client.
const clients = new Map<string, FlueClient>()
function clientFor(userId: string, threadId: number) {
  const url = `${AGENT_URL.replace(/\/$/, '')}/agents/${BEE_AGENT_NAME}/${conversationId(userId, threadId)}`
  let client = clients.get(url)
  if (!client) {
    client = createFlueClient({
      url,
      headers: { 'x-bridge-secret': BRIDGE_SECRET, 'x-bridge-user': userId },
    })
    clients.set(url, client)
  }
  return client
}

async function channelAction<T>(
  userId: string,
  body: Record<string, unknown>,
): Promise<T> {
  const response = await fetch(
    `${AGENT_URL.replace(/\/$/, '')}/bridge/channel`,
    {
      method: 'POST',
      headers: {
        ...bridgeHeaders,
        'x-bridge-user': userId,
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    },
  )
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
  const response = await fetch(
    `${AGENT_URL.replace(/\/$/, '')}/bridge/outbox`,
    {
      method: 'POST',
      headers: { ...bridgeHeaders, 'content-type': 'application/json' },
      body: JSON.stringify({ action, ...input }),
    },
  )
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

async function syncDirectExchange(
  userId: string,
  threadId: number,
  messageId: string,
  prompt: string,
  reply: BeeReply,
  createdAt: number,
) {
  const assistantText = reply.markdown || reply.spoken
  if (!assistantText) return
  const messages = [
    {
      id: `imessage:${messageId}:user`,
      role: 'user' as const,
      text: prompt,
      createdAt,
    },
    {
      id: `imessage:${messageId}:assistant`,
      role: 'assistant' as const,
      text: assistantText,
      createdAt: createdAt + 1,
    },
  ].map(({ id, role, text: body, createdAt: timestamp }) => ({
    id,
    role,
    contentJson: JSON.stringify({
      id,
      role,
      parts: [{ type: 'text', text: body, state: 'done' }],
      metadata: {
        timestamp: new Date(timestamp).toISOString(),
        channel: 'imessage',
      },
    }),
    createdAt: timestamp,
  }))
  await channelAction(userId, {
    action: 'sync_transcript',
    threadId,
    messages,
  })
}

/** Sends one prompt to Bee and returns both spoken copy and projected UI. */
async function askBee(
  space: Space,
  userId: string,
  threadId: number,
  body: string,
  images: DeliveredAttachment[] = [],
): Promise<BeeReply> {
  const client = clientFor(userId, threadId)
  const progress = createIMessageProgressReporter(
    async (message) => await space.send(text(message)),
    (error) => captureBridgeFailure(error, 'progress.send', userId),
  )
  try {
    const admission = await client.send({
      message: {
        kind: 'user',
        body,
        ...(images.length ? { attachments: images } : {}),
      },
    })
    let currentStepText = ''
    let finalStepText = ''
    // read() awaits settlement and resolves with the reply; wait() alone no
    // longer carries the assistant text in Flue 2.0.
    const result = await client.read(admission, {
      onEvent: (event) => {
        progress.event(event)
        if (event.type === 'message-started') {
          currentStepText = ''
        } else if (event.type === 'message-delta' && event.kind === 'text') {
          currentStepText += event.delta
        } else if (
          event.type === 'message-completed' &&
          currentStepText.trim()
        ) {
          finalStepText = currentStepText
        }
      },
    })
    try {
      const messages = changedMessagesForConvexSync(
        (await client.history()).messages,
        new Map(),
      ).slice(-200)
      await channelAction(userId, {
        action: 'sync_transcript',
        threadId,
        messages,
      })
    } catch (error) {
      // A transcript mirror outage must not suppress an otherwise valid reply.
      captureBridgeFailure(error, 'transcript.sync', userId)
    }
    // Flue accumulates tool stages in one envelope. The final completed text
    // step is the coherent user-facing stage; fall back only for transports
    // that do not emit text deltas.
    return extractBeeResponse(
      (finalStepText || currentStepText).trim() || result.text,
    )
  } finally {
    await progress.stop()
  }
}

async function latestInteractiveReply(userId: string, threadId: number) {
  let messages: Awaited<ReturnType<FlueClient['history']>>['messages']
  try {
    messages = (await clientFor(userId, threadId).history()).messages
  } catch (error) {
    // Flue 2 only creates a conversation's stream on its first prompt, so a
    // fresh thread has no history yet — that just means nothing interactive.
    if (error instanceof FlueApiError && error.status === 404) {
      return { firstFocus: undefined, web3: undefined, question: undefined }
    }
    throw error
  }
  return {
    firstFocus: latestFirstFocusPreview(messages),
    web3: latestWeb3Confirmation(messages),
    question: latestQuestion(messages),
  }
}

async function transcribeVoice(
  userId: string,
  bytes: Buffer,
  mimeType: string,
) {
  const response = await fetch(
    `${AGENT_URL.replace(/\/$/, '')}/voice/transcribe`,
    {
      method: 'POST',
      headers: {
        ...bridgeHeaders,
        'x-bridge-user': userId,
        'content-type': mimeType,
      },
      body: bytes,
    },
  )
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

async function promptFromContent(
  userId: string,
  content: {
    type: string
    text?: string
    mimeType?: string
    read?: () => Promise<Buffer>
    items?: { content: unknown }[]
  },
): Promise<IncomingPrompt> {
  if (content.type === 'text') {
    return {
      text: content.text?.trim() ?? '',
      images: [],
      unsupportedAttachment: false,
    }
  }
  if (
    (content.type === 'voice' ||
      (content.type === 'attachment' &&
        content.mimeType?.startsWith('audio/'))) &&
    content.read &&
    content.mimeType
  ) {
    return {
      text: await transcribeVoice(
        userId,
        await content.read(),
        content.mimeType,
      ),
      images: [],
      unsupportedAttachment: false,
    }
  }
  if (
    content.type === 'attachment' &&
    content.mimeType?.startsWith('image/') &&
    content.read
  ) {
    return {
      text: '',
      images: [
        {
          type: 'image',
          data: (await content.read()).toString('base64'),
          mimeType: content.mimeType,
        },
      ],
      unsupportedAttachment: false,
    }
  }
  if (content.type === 'group' && Array.isArray(content.items)) {
    const parts = await Promise.all(
      content.items.map((item) =>
        promptFromContent(
          userId,
          item.content as Parameters<typeof promptFromContent>[1],
        ),
      ),
    )
    return {
      text: parts
        .map((part) => part.text)
        .filter(Boolean)
        .join('\n'),
      images: parts.flatMap((part) => part.images),
      unsupportedAttachment: parts.some((part) => part.unsupportedAttachment),
    }
  }
  return { text: '', images: [], unsupportedAttachment: true }
}

async function sendReply(
  space: Space,
  reply: BeeReply,
  userId: string,
  celebrate = false,
) {
  const currentWeb3 = reply.web3Confirmation
    ? await web3ActionFor(userId, reply.web3Confirmation.actionId).catch(
        () => null,
      )
    : null
  let projected = reply
  if (currentWeb3) {
    projected = projectWeb3Action(reply, currentWeb3)
  } else if (reply.web3Confirmation) {
    projected = projectWeb3Action(reply, {
      summary: reply.web3Confirmation.summary,
      status: 'expired',
      autoConfirmed: false,
    })
  }
  if (projected.markdown) {
    await space.send(
      celebrate
        ? effect(markdown(projected.markdown), imessage.effect.message.confetti)
        : markdown(projected.markdown),
    )
  }
  for (const link of projected.links) {
    await space.send(richlink(link))
  }
}

function firstFocusActionInput(preview: FirstFocusPreview) {
  return {
    requestId: preview.requestId,
    goalTitle: preview.goalTitle,
    projectTitle: preview.projectTitle,
    taskTitle: preview.taskTitle,
    ...(preview.highlightExpiresAt
      ? { highlightExpiresAt: preview.highlightExpiresAt }
      : {}),
  }
}

const app = await Spectrum({
  projectId: process.env.PROJECT_ID!,
  projectSecret: process.env.PROJECT_SECRET!,
  providers: [imessage.config()],
})

let deliveryPollActive = false
async function pollTerminalDeliveries() {
  if (deliveryPollActive) return
  deliveryPollActive = true
  const leaseId = crypto.randomUUID()
  let delivery: ClaimedDelivery | null = null
  try {
    delivery = await outboxAction<ClaimedDelivery | null>('claim_delivery', {
      leaseId,
    })
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
    const im = imessage(app)
    const dm = await im.space.create(await im.user(delivery.address))
    await dm.send(markdown(projected.text))
    for (const link of projected.links) await dm.send(richlink(link))
    await outboxAction('complete_delivery', {
      deliveryId: delivery.deliveryId,
      leaseId: delivery.leaseId,
    })
  } catch (error) {
    captureBridgeFailure(error, 'outbox.deliver')
    if (delivery) {
      await outboxAction('retry_delivery', {
        deliveryId: delivery.deliveryId,
        leaseId: delivery.leaseId,
      }).catch(() => {})
    }
  } finally {
    deliveryPollActive = false
  }
}

const deliveryTimer = setInterval(() => void pollTerminalDeliveries(), 3_000)
deliveryTimer.unref()
void pollTerminalDeliveries()

console.log(`imessage-bridge: connected; resolving senders via ${AGENT_URL}`)

// `--greet <address...>` opens a DM with each given address so they learn
// Bee's number (Spectrum's shared pool assigns it on first contact).
const greetFlagIndex = process.argv.indexOf('--greet')
if (greetFlagIndex !== -1) {
  const im = imessage(app)
  const addresses = process.argv
    .slice(greetFlagIndex + 1)
    .filter((value) => !value.startsWith('--'))
  for (const address of addresses) {
    try {
      const dm = await im.space.create(await im.user(address))
      await dm.send(
        text(
          "Bee here 🐝 Text me anytime — I'm connected to your BeeGreat goals.",
        ),
      )
      console.log(`imessage-bridge: greeted ${address}`)
    } catch (error) {
      captureBridgeFailure(error, 'greeting.send')
      console.error(`imessage-bridge: greeting ${address} failed`, error)
    }
  }
}

/** One magic link (or a gentle throttle) for a sender Bee doesn't know yet. */
async function welcomeUnknownSender(space: Space, address: string) {
  const link = await identity.beginLink(address)
  if (link.status === 'throttled') return
  if (link.status === 'rate_limited') {
    await space.send(
      text(
        'Too many link attempts from this address for now. Try again in an hour.',
      ),
    )
    return
  }
  if (link.status === 'invalid') {
    await space.send(
      text(
        "I couldn't create a sign-in link for this address. Try again soon.",
      ),
    )
    return
  }
  await space.send(
    text(
      "Hi, I'm Bee 🐝 — your BeeGreat personal agent. Open this link to sign in (or create your account) and connect this number. It's valid for 15 minutes; text me again after connecting.",
    ),
  )
  await space.send(richlink(link.url))
}

for await (const [space, message] of app.messages) {
  // For iMessage the sender's cross-provider id is their address (phone/email).
  const rawAddress = message.sender?.id
  if (!rawAddress) continue
  const senderAddress = normalizeAddress(rawAddress)

  let userId: string | null
  try {
    userId = await identity.resolve(senderAddress)
  } catch (error) {
    captureBridgeFailure(error, 'identity.resolve')
    console.error('imessage-bridge: sender resolution failed', error)
    continue
  }

  if (!userId) {
    try {
      await welcomeUnknownSender(space, senderAddress)
    } catch (error) {
      captureBridgeFailure(error, 'identity.begin_link')
      console.error('imessage-bridge: welcome link failed', error)
    }
    continue
  }

  try {
    // Tapback 👀 so the sender knows Bee is on it (replies can take a while).
    // Fire-and-forget: acknowledgement UX must not delay the actual work.
    void message.react('👀').catch(() => {})
    void space.startTyping().catch(() => {})

    const incoming = await promptFromContent(
      userId,
      message.content as Parameters<typeof promptFromContent>[1],
    )
    if (
      incoming.unsupportedAttachment &&
      !incoming.text &&
      incoming.images.length === 0
    ) {
      await space.send(
        text(
          'I can read text, voice notes, and images here. Open another file in BeeGreat or paste its text.',
        ),
      )
      continue
    }
    const prompt =
      incoming.text ||
      (incoming.images.length ? 'Please help me with the image I sent.' : '')
    if (!prompt) continue

    const command = prompt.trim().toLowerCase()
    if (UNLINK_COMMANDS.has(command)) {
      const disconnected = await identity.unlink(senderAddress)
      await space.send(
        text(
          disconnected
            ? 'This number is no longer linked to your BeeGreat account. Text me anytime to link it again.'
            : "This number wasn't linked, so there was nothing to disconnect.",
        ),
      )
      continue
    }

    const context = await channelAction<ChannelContext>(userId, {
      action: 'context',
      source: 'imessage',
      sourceAddress: senderAddress,
    })
    if (NEW_CONVERSATION_COMMANDS.has(command)) {
      await channelAction(userId, {
        action: 'create_thread',
        source: 'imessage',
        sourceAddress: senderAddress,
      })
      await space.send(
        text('New conversation started. What would you like to work on?'),
      )
      continue
    }

    // Fire-and-forget: the thread title is cosmetic and must not delay Bee.
    void channelAction(userId, {
      action: 'title_thread',
      threadId: context.threadId,
      title: incoming.text || 'iMessage conversation',
    }).catch(() => {})

    let reply: BeeReply
    let celebrate = false
    let directWeb3Reply = false
    const numberedQuestionReply = /^\s*\[?\d+\]?\s*(?:,\s*\[?\d+\]?\s*)*$/.test(
      prompt,
    )
    const questionReply = numberedQuestionReply
      ? await latestInteractiveReply(userId, context.threadId)
      : undefined
    const deliveredPrompt = resolveQuestionAnswer(
      questionReply?.question,
      prompt,
    )
    if (isFirstFocusConfirmation(prompt) || isFirstFocusCancellation(prompt)) {
      const interactive = await latestInteractiveReply(userId, context.threadId)
      const preview = interactive.firstFocus
      if (preview) {
        if (isFirstFocusConfirmation(prompt)) {
          await channelAction(userId, {
            action: 'confirm_first_focus',
            ...firstFocusActionInput(preview),
          })
          reply = await askBee(
            space,
            userId,
            context.threadId,
            '[BeeGreat app event] The first-focus plan was confirmed and persisted successfully. Acknowledge it; do not create or mutate the plan again.',
          )
        } else {
          await channelAction(userId, {
            action: 'cancel_first_focus',
            ...firstFocusActionInput(preview),
          })
          reply = await askBee(
            space,
            userId,
            context.threadId,
            '[BeeGreat app event] The first-focus preview was cancelled. Nothing was created. Acknowledge the cancellation; do not create or mutate the plan.',
          )
        }
      } else {
        const web3Confirmation = interactive.web3
        if (
          web3Confirmation &&
          (isWeb3Confirmation(prompt) || isWeb3Cancellation(prompt))
        ) {
          const confirmed = isWeb3Confirmation(prompt)
          const current = await web3ActionFor(userId, web3Confirmation.actionId)
          if (!current) {
            throw new Error('This Web3 confirmation is no longer available.')
          }
          if (current.status === 'pending') {
            if (current.kind === 'execute_eoa_plan' && confirmed) {
              reply = replyForWeb3Action(current)
              directWeb3Reply = true
            } else {
              await channelAction(userId, {
                action: confirmed ? 'confirm_web3' : 'cancel_web3',
                actionId: web3Confirmation.actionId,
                summary: current.summary,
              })
              const updated = await web3ActionFor(
                userId,
                web3Confirmation.actionId,
              )
              reply = replyForWeb3Action(
                updated ?? {
                  ...current,
                  status: confirmed ? 'confirmed' : 'cancelled',
                },
              )
              directWeb3Reply = true
            }
          } else {
            reply = replyForWeb3Action(current)
            directWeb3Reply = true
          }
        } else {
          reply = await askBee(
            space,
            userId,
            context.threadId,
            deliveredPrompt,
            incoming.images,
          )
        }
      }
    } else if (isHighlightCompletion(prompt) && context.activeHighlight) {
      const highlight = context.activeHighlight
      const completion = await channelAction<{
        status: 'completed' | 'already_completed'
        honeyAwarded: number
        scoreAwarded: number
      }>(userId, {
        action: 'complete_highlight',
        requestId: `complete-highlight:${highlight.highlightId}`,
        taskId: highlight.taskId,
      })
      reply = await askBee(
        space,
        userId,
        context.threadId,
        `[BeeGreat app event] Highlight "${highlight.title}" was completed successfully. The verified award was ${completion.honeyAwarded} Honey and ${completion.scoreAwarded} Honeycomb Score. Acknowledge this completion and reward only; do not call a completion tool or create, update, or mutate any data again.`,
      )
      celebrate = completion.status === 'completed'
    } else {
      reply = await askBee(
        space,
        userId,
        context.threadId,
        deliveredPrompt,
        incoming.images,
      )
    }

    await sendReply(space, reply, userId, celebrate)
    if (directWeb3Reply) {
      await syncDirectExchange(
        userId,
        context.threadId,
        message.id,
        prompt,
        reply,
        message.timestamp.getTime(),
      ).catch((error) =>
        captureBridgeFailure(error, 'transcript.sync_direct', userId),
      )
    }
  } catch (error) {
    captureBridgeFailure(error, 'prompt.handle', userId)
    console.error('imessage-bridge: prompt failed', error)
    await space.send(text(promptFailureReply(error)))
  } finally {
    await space.stopTyping().catch(() => {})
  }
}
