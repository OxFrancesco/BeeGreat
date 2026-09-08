import type { Doc } from './_generated/dataModel'
import type { MutationCtx } from './_generated/server'

export async function removeJournalStorage(ctx: MutationCtx, attachment: Doc<'journalAttachments'>) {
  if (attachment.uploadVerified) {
    await ctx.storage.delete(attachment.storageId)
    return
  }
  // Old clients supplied arbitrary storage IDs. Preserve the deletion request
  // for an operator to establish provenance before deleting somebody's file.
  await ctx.db.insert('journalStorageReviews', {
    ownerKey: attachment.ownerKey,
    storageId: attachment.storageId,
    attachmentId: attachment._id,
    requestedAt: Date.now(),
  })
}
