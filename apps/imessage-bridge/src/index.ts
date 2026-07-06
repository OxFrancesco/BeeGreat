import { createFlueClient, type FlueClient } from '@flue/sdk'
import { markdown, Spectrum, text } from 'spectrum-ts'
import { effect, imessage } from 'spectrum-ts/providers/imessage'

// Bridges iMessage (via Spectrum Cloud) to the BeeGreat Flue agent worker.
// Only senders in IMESSAGE_USER_MAP are answered; everyone else is ignored.

const BEE_AGENT_NAME = 'bee'
// Keeps iMessage on its own conversation thread; tools still key data by the
// bare user id (see packages/agent/src/agents/bee.ts).
const SESSION_SUFFIX = 'imessage'

const REQUIRED_ENV = ['PROJECT_ID', 'PROJECT_SECRET', 'AGENT_URL', 'BRIDGE_SECRET', 'IMESSAGE_USER_MAP']
const missing = REQUIRED_ENV.filter((name) => !process.env[name])
if (missing.length > 0) {
  console.warn(`imessage-bridge: not configured (missing ${missing.join(', ')}); see .env.example`)
  process.exit(0)
}

const AGENT_URL = process.env.AGENT_URL!
const BRIDGE_SECRET = process.env.BRIDGE_SECRET!

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
  process.exit(0)
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

/** Sends one prompt to Bee and resolves with the assistant's reply text. */
async function askBee(userId: string, body: string): Promise<string> {
  const client = clientFor(userId)
  const { result } = await client.agents.prompt(BEE_AGENT_NAME, `${userId}~${SESSION_SUFFIX}`, {
    message: body,
  })
  // Bee emits ```beeui fenced blocks for the app's generated UI; there's
  // nothing to render them with in Messages, so drop them.
  return result.text.replace(/```beeui[\s\S]*?```/g, '').replace(/\n{3,}/g, '\n\n').trim()
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
      console.error(`imessage-bridge: greeting ${address} failed`, error)
    }
  }
}

for await (const [space, message] of app.messages) {
  if (message.content.type !== 'text') continue

  // For iMessage the sender's cross-provider id is their address (phone/email).
  const address = message.sender?.id
  const userId = address ? userMap.get(normalizeAddress(address)) : undefined
  if (!userId) continue

  try {
    // Tapback 👀 so the sender knows Bee is on it (replies can take a while).
    await message.react('👀').catch(() => {})

    const reply = await askBee(userId, message.content.text)
    if (!reply) continue

    // Celebrate with confetti when the sender reports finishing something.
    const celebrate = /\b(done|finished|completed?|fatto|finito)\b/i.test(message.content.text)
    // markdown() renders as native iMessage styled text (bold, italic, ...).
    await space.send(
      celebrate ? effect(markdown(reply), imessage.effect.message.confetti) : markdown(reply),
    )
  } catch (error) {
    console.error('imessage-bridge: prompt failed', error)
    await space.send(text('Something went wrong reaching Bee. Try again in a moment.'))
  }
}
