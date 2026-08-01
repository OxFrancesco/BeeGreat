import { api } from '@beegreat/backend/convex/_generated/api'
import { ConvexHttpClient } from 'convex/browser'
import { env } from 'cloudflare:workers'

export type PublicProfile = NonNullable<
  Awaited<ReturnType<typeof getProfileByHandle>>
>

function client() {
  const convexUrl = env.CONVEX_URL?.trim()
  if (!convexUrl) throw new Error('CONVEX_URL is not configured')
  // ConvexHttpClient is stateful, so it is intentionally created per request.
  return new ConvexHttpClient(convexUrl)
}

export async function getProfileByHandle(handle: string) {
  return await client().query(api.publicProfiles.byHandle, { handle })
}

export async function getProfileByPublicId(publicId: string) {
  return await client().query(api.publicProfiles.byPublicId, { publicId })
}
