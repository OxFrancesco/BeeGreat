import { toError } from '@beegreat/observability'
import {
  createFlueClient,
  type AgentPromptImage,
  type FlueClient,
} from '@flue/sdk'
import * as Sentry from '@sentry/bun'
import {
  markdown,
  richlink,
  type Space,
  Spectrum,
  text,
} from 'spectrum-ts'
import { effect, imessage } from 'spectrum-ts/providers/imessage'
import { promptFailureReply } from './agent-error'
import {
  extractBeeResponse,
  isFirstFocusCancellation,
  isFirstFocusConfirmation,
  isHighlightCompletion,
  latestFirstFocusPreview,
  type FirstFocusPreview,
} from './bee-response'

// Bridges iMessage (via Spectrum Cloud) to the BeeGreat Flue agent worker.
// Only senders in IMESSAGE_USER_MAP are answered; everyone else is ignored.

const BEE_AGENT_NAME = 'bee'
const NEW_CONVERSATION_COMMANDS = new Set(['/clear', '/new'])

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
  images: AgentPromptImage[]
  unsupportedAttachment: boolean
}

type BeeReply = ReturnType<typeof extractBeeResponse>

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

const REQUIRED_ENV = ['PROJECT_ID', 'PROJECT_SECRET', 'AGENT_URL', 'BRIDGE_SECRET', 'IMESSAGE_USER_MAP']
const missing = REQUIRED_ENV.filter((name) => !process.env[name])
if (missing.length > 0) {
  console.warn(`imessage-bridge: not configured (missing ${missing.join(', ')}); see .env.example`)
  captureBridgeFailure(
    new Error(`iMessage bridge configuration is incomplete: ${missing.join(', ')}`),
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

/** Phone numbers compare without formatting; emails compare lowercased. */
function normalizeAddress(address: string) {
  const trimmed = address.trim().toLowerCase()
  return trimmed.includes('@') ? trimmed : trimmed.replace(/[\s().-]/g, '')
}

function parseUserMap(raw: string) {
  const map = new Map<string, string>()
  for (const pair of raw.split(',')) {
    const [address, userId] = pair.split('=').map((part) => part.trim())
    if (address && userId) map.set(normalizeAddress(address), userId)
  }
  return map
}

const userMap = parseUserMap(process.env.IMESSAGE_USER_MAP!)
if (userMap.size === 0) {
  console.warn('imessage-bridge: IMESSAGE_USER_MAP has no valid `sender=clerkUserId` pairs')
  captureBridgeFailure(
    new Error('IMESSAGE_USER_MAP has no valid entries'),
    'startup.user_map',
  )
  await Sentry.flush(2_000)
  process.exit(1)
}

// The worker authorizes the bridge via shared secret and scopes every request
// to one user, so each mapped user gets their own client.
const clients = new Map<string, FlueClient>()
function clientFor(userId: string) {
  let client = clients.get(userId)
  if (!client) {
    client = createFlueClient({
      baseUrl: AGENT_URL,
      headers: { 'x-bridge-secret': BRIDGE_SECRET, 'x-bridge-user': userId },
    })
    clients.set(userId, client)
  }
  return client
}

function conversationId(userId: string, threadId: number) {
  return threadId > 0 ? `${userId}~${threadId}` : userId
}

async function channelAction<T>(
  userId: string,
  body: Record<string, unknown>,
): Promise<T> {
  const response = await fetch(`${AGENT_URL.replace(/\/$/, '')}/bridge/channel`, {
    method: 'POST',
    headers: {
      ...bridgeHeaders,
      'x-bridge-user': userId,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  const result = (await response.json().catch(() => null)) as
    | Record<string, unknown>
    | null
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

/** Sends one prompt to Bee and returns both spoken copy and projected UI. */
async function askBee(
  userId: string,
  threadId: number,
  body: string,
  images: AgentPromptImage[] = [],
): Promise<BeeReply> {
  const client = clientFor(userId)
  const { result } = await client.agents.prompt(
    BEE_AGENT_NAME,
    conversationId(userId, threadId),
    {
      message: body,
      ...(images.length ? { images } : {}),
    },
  )
  return extractBeeResponse(result.text)
}

async function latestPreview(userId: string, threadId: number) {
  const history = await clientFor(userId).agents.history(
    BEE_AGENT_NAME,
    conversationId(userId, threadId),
  )
  return latestFirstFocusPreview(history.messages)
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
  if (
    !response.ok ||
    !result ||
    typeof result.text !== 'string'
  ) {
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
      unsupportedAttachment: parts.some(
        (part) => part.unsupportedAttachment,
      ),
    }
  }
  return { text: '', images: [], unsupportedAttachment: true }
}

async function sendReply(
  space: Space,
  reply: BeeReply,
  celebrate = false,
) {
  if (reply.markdown) {
    await space.send(
      celebrate
        ? effect(markdown(reply.markdown), imessage.effect.message.confetti)
        : markdown(reply.markdown),
    )
  }
  for (const link of reply.links) {
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

console.log(`imessage-bridge: connected; answering ${userMap.size} allowlisted sender(s) via ${AGENT_URL}`)

// `--greet` opens a DM with each allowlisted sender so they learn Bee's
// number (Spectrum's shared pool assigns it on first contact).
if (process.argv.includes('--greet')) {
  const im = imessage(app)
  const greeted = new Set<string>()
  for (const [address, userId] of userMap) {
    // Skip bare national-format duplicates; greet each user once.
    const isEmail = address.includes('@')
    if (greeted.has(userId) || (!isEmail && !address.startsWith('+'))) continue
    try {
      const dm = await im.space.create(await im.user(address))
      await dm.send(text("Bee here 🐝 Text me anytime — I'm connected to your BeeGreat goals."))
      greeted.add(userId)
      console.log(`imessage-bridge: greeted ${address}`)
    } catch (error) {
      captureBridgeFailure(error, 'greeting.send', userId)
      console.error(`imessage-bridge: greeting ${address} failed`, error)
    }
  }
}

for await (const [space, message] of app.messages) {
  // For iMessage the sender's cross-provider id is their address (phone/email).
  const address = message.sender?.id
  const userId = address ? userMap.get(normalizeAddress(address)) : undefined
  if (!userId) continue

  try {
    // Tapback 👀 so the sender knows Bee is on it (replies can take a while).
    await message.react('👀').catch(() => {})

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
      (incoming.images.length
        ? 'Please help me with the image I sent.'
        : '')
    if (!prompt) continue

    const context = await channelAction<ChannelContext>(userId, {
      action: 'context',
      source: 'imessage',
    })
    const command = prompt.trim().toLowerCase()
    if (NEW_CONVERSATION_COMMANDS.has(command)) {
      await channelAction(userId, {
        action: 'create_thread',
        source: 'imessage',
      })
      await space.send(
        text('New conversation started. What would you like to work on?'),
      )
      continue
    }

    await channelAction(userId, {
      action: 'title_thread',
      threadId: context.threadId,
      title: incoming.text || 'iMessage conversation',
    })

    let reply: BeeReply
    let celebrate = false
    if (
      isFirstFocusConfirmation(prompt) ||
      isFirstFocusCancellation(prompt)
    ) {
      const preview = await latestPreview(userId, context.threadId)
      if (preview) {
        if (isFirstFocusConfirmation(prompt)) {
          await channelAction(userId, {
            action: 'confirm_first_focus',
            ...firstFocusActionInput(preview),
          })
          reply = await askBee(
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
            userId,
            context.threadId,
            '[BeeGreat app event] The first-focus preview was cancelled. Nothing was created. Acknowledge the cancellation; do not create or mutate the plan.',
          )
        }
      } else {
        reply = await askBee(
          userId,
          context.threadId,
          prompt,
          incoming.images,
        )
      }
    } else if (
      isHighlightCompletion(prompt) &&
      context.activeHighlight
    ) {
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
        userId,
        context.threadId,
        `[BeeGreat app event] Highlight "${highlight.title}" was completed successfully. The verified award was ${completion.honeyAwarded} Honey and ${completion.scoreAwarded} Honeycomb Score. Acknowledge this completion and reward only; do not call a completion tool or create, update, or mutate any data again.`,
      )
      celebrate = completion.status === 'completed'
    } else {
      reply = await askBee(
        userId,
        context.threadId,
        prompt,
        incoming.images,
      )
    }

    await sendReply(space, reply, celebrate)
  } catch (error) {
    captureBridgeFailure(error, 'prompt.handle', userId)
    console.error('imessage-bridge: prompt failed', error)
    await space.send(text(promptFailureReply(error)))
  }
}
