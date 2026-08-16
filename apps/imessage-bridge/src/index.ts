import * as Sentry from '@sentry/bun'
import { richlink, type Space, Spectrum, text } from 'spectrum-ts'
import { imessage } from 'spectrum-ts/providers/imessage'
import { promptFailureReply } from './agent-error'
import { createAgentTransport } from './agent-transport'
import { resolvePromptReply, type ChannelContext } from './confirmations'
import { promptFromContent } from './content'
import { syncDirectExchange } from './conversation'
import { captureBridgeFailure } from './failures'
import { createIdentityClient, normalizeAddress } from './identity'
import { startTerminalDeliveryPolling } from './outbox'
import { sendReply } from './reply'

// Bridges iMessage (via Spectrum Cloud) to the BeeGreat Flue agent worker.
// Senders linked in Convex are answered as their BeeGreat user; unknown
// senders get one magic link to sign in or sign up and link this address.

const NEW_CONVERSATION_COMMANDS = new Set(['/clear', '/new'])
const UNLINK_COMMANDS = new Set(['/unlink', '/disconnect'])

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

const identity = createIdentityClient({
  agentUrl: AGENT_URL,
  bridgeSecret: BRIDGE_SECRET,
})

const transport = createAgentTransport({
  agentUrl: AGENT_URL,
  bridgeSecret: BRIDGE_SECRET,
})

const app = await Spectrum({
  projectId: process.env.PROJECT_ID!,
  projectSecret: process.env.PROJECT_SECRET!,
  providers: [imessage.config()],
})

startTerminalDeliveryPolling(transport, async (address) => {
  const im = imessage(app)
  return await im.space.create(await im.user(address))
})

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
      transport,
      userId,
      message.content as Parameters<typeof promptFromContent>[2],
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

    const context = await transport.channelAction<ChannelContext>(userId, {
      action: 'context',
      source: 'imessage',
      sourceAddress: senderAddress,
    })
    if (NEW_CONVERSATION_COMMANDS.has(command)) {
      await transport.channelAction(userId, {
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
    void transport
      .channelAction(userId, {
        action: 'title_thread',
        threadId: context.threadId,
        title: incoming.text || 'iMessage conversation',
      })
      .catch(() => {})

    const { reply, celebrate, directWeb3Reply } = await resolvePromptReply({
      transport,
      space,
      userId,
      context,
      prompt,
      images: incoming.images,
    })

    await sendReply(transport, space, reply, userId, celebrate)
    if (directWeb3Reply) {
      await syncDirectExchange(
        transport,
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
