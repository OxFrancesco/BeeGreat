import { internal } from '../_generated/api'
import { httpAction } from '../_generated/server'
import { jsonResponse, requestDocumentId } from './middleware'

const MAX_PHOTO_BYTES = 10 * 1024 * 1024
const cors = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'POST, OPTIONS',
  'access-control-allow-headers': 'Authorization, Content-Type',
}

export const journalPhotoOptions = httpAction(async () => new Response(null, { status: 204, headers: cors }))

export const journalPhotoUpload = httpAction(async (ctx, request) => {
  let identity
  try { identity = await ctx.auth.getUserIdentity() } catch { identity = null }
  if (!identity) return jsonResponse({ error: 'Sign in to upload a journal photo.' }, 401, cors)
  const url = new URL(request.url)
  const entryId = requestDocumentId<'journalEntries'>(url.searchParams.get('entryId') ?? '')
  const mimeType = request.headers.get('content-type')?.split(';')[0] ?? ''
  if (!/^image\/[A-Za-z0-9.+-]+$/.test(mimeType) || mimeType.length > 100) return jsonResponse({ error: 'Choose an image file.' }, 400, cors)
  try {
    if (!(await ctx.runQuery(internal.journalEntries.authorizePhotoUpload, { ownerKey: identity.tokenIdentifier, entryId }))) return jsonResponse({ error: 'Entry unavailable or photo limit reached.' }, 403, cors)
  } catch { return jsonResponse({ error: 'Journal entry unavailable.' }, 400, cors) }
  const chunks: ArrayBuffer[] = []
  let size = 0
  const reader = request.body?.getReader()
  if (!reader) return jsonResponse({ error: 'Send photo bytes.' }, 400, cors)
  try {
    for (;;) {
      const next = await reader.read()
      if (next.done) break
      size += next.value.byteLength
      if (size > MAX_PHOTO_BYTES) {
        await reader.cancel()
        return jsonResponse({ error: 'Photos must be at most 10 MB.' }, 413, cors)
      }
      chunks.push(new Uint8Array(next.value).buffer)
    }
  } catch { return jsonResponse({ error: 'Photo upload was interrupted.' }, 400, cors) }
  finally { reader.releaseLock() }
  if (!size) return jsonResponse({ error: 'Send photo bytes.' }, 400, cors)
  const storageId = await ctx.storage.store(new Blob(chunks, { type: mimeType }))
  try {
    const photo = await ctx.runMutation(internal.journalEntries.addPhoto, {
      ownerKey: identity.tokenIdentifier, userId: identity.subject, entryId, storageId, mimeType,
      fileName: url.searchParams.get('fileName') ?? undefined,
      width: url.searchParams.has('width') ? Number(url.searchParams.get('width')) : undefined,
      height: url.searchParams.has('height') ? Number(url.searchParams.get('height')) : undefined,
    })
    return jsonResponse(photo, 200, cors)
  } catch {
    await ctx.storage.delete(storageId)
    return jsonResponse({ error: 'Photo could not be attached. Try again.' }, 400, cors)
  }
})
