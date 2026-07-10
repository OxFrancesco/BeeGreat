import { ConvexError, getConvexSize, v } from 'convex/values'
import { mutation, query } from './_generated/server'
import {
  memoryCorrectionResultValidator,
  memoryInspectionValidator,
  memoryProvenanceValidator,
  memoryRemovalResultValidator,
  memoryRetentionValidator,
  memoryRetrievalResultValidator,
  memorySourceInputValidator,
  memoryValueValidator,
} from './memoryValidators'
import { rankMemoryCandidates } from './memoryRelevance'
import type { Infer } from 'convex/values'
import type { Doc } from './_generated/dataModel'
import type { MutationCtx, QueryCtx } from './_generated/server'

const CONVERSATION_RETENTION_MS = 30 * 24 * 60 * 60 * 1_000
const MAX_MEMORY_VALUE_BYTES = 16 * 1024
const MAX_PROVENANCE_BYTES = 4 * 1024
const MAX_OWNER_KEY_BYTES = 1024
const MAX_CORRECTION_REASON_BYTES = 1024
const MAX_REVISIONS = 50
const MAX_SOURCES = 20
const MAX_TEXT_LENGTH = 50_000
const MAX_RETRIEVAL_CANDIDATES = 64
const MAX_RETRIEVAL_RESULTS = 20
const MAX_REASON_LENGTH = 500
const MAX_QUERY_LENGTH = 500
const MAX_DERIVED_DEPENDENTS = 8

type MemoryValue = Infer<typeof memoryValueValidator>
type MemoryProvenance = Infer<typeof memoryProvenanceValidator>
type MemoryRetention = Infer<typeof memoryRetentionValidator>

async function requireOwnerKey(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) {
    throw new ConvexError({
      code: 'UNAUTHENTICATED',
      message: 'Authentication required',
    })
  }
  if (getConvexSize(identity.tokenIdentifier) > MAX_OWNER_KEY_BYTES) {
    throw new ConvexError({
      code: 'INVALID_IDENTITY',
      message: 'Authenticated owner key exceeds its encoded limit',
    })
  }
  return identity.tokenIdentifier
}

function boundedMemoryValue(value: MemoryValue) {
  if (getConvexSize(value) > MAX_MEMORY_VALUE_BYTES) {
    throw new ConvexError({
      code: 'INVALID_MEMORY',
      message: `Memory value exceeds the ${MAX_MEMORY_VALUE_BYTES}-byte encoded limit`,
    })
  }
  return value
}

function requiredText(value: string, field: string) {
  const trimmed = value.trim()
  if (!trimmed) {
    throw new ConvexError({
      code: 'INVALID_MEMORY',
      message: `${field} is required`,
    })
  }
  if (trimmed.length > MAX_TEXT_LENGTH) {
    throw new ConvexError({
      code: 'INVALID_MEMORY',
      message: `${field} is too long`,
    })
  }
  return trimmed
}

function optionalText(value: string | undefined, field: string) {
  if (value === undefined) return undefined
  return requiredText(value, field)
}

function normalizeValue(value: MemoryValue): MemoryValue {
  switch (value.kind) {
    case 'bookmark': {
      const url = requiredText(value.url, 'Bookmark URL')
      let parsed: URL
      try {
        parsed = new URL(url)
      } catch {
        throw new ConvexError({
          code: 'INVALID_MEMORY',
          message: 'Bookmark URL is invalid',
        })
      }
      if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
        throw new ConvexError({
          code: 'INVALID_MEMORY',
          message: 'Bookmark URL must use http or https',
        })
      }
      return boundedMemoryValue({
        kind: value.kind,
        title: requiredText(value.title, 'Bookmark title'),
        url,
        summary: optionalText(value.summary, 'Bookmark summary'),
      })
    }
    case 'note':
      return boundedMemoryValue({
        kind: value.kind,
        title: optionalText(value.title, 'Note title'),
        text: requiredText(value.text, 'Note text'),
      })
    case 'conversation':
      return boundedMemoryValue({
        kind: value.kind,
        title: optionalText(value.title, 'Conversation title'),
        transcript: requiredText(value.transcript, 'Conversation transcript'),
      })
    case 'derived-memory':
      return boundedMemoryValue({
        kind: value.kind,
        memoryType: value.memoryType,
        text: requiredText(value.text, 'Derived memory text'),
      })
  }
}

function normalizeProvenance(provenance: MemoryProvenance): MemoryProvenance {
  if (provenance.origin === 'import' && !provenance.source?.trim()) {
    throw new ConvexError({
      code: 'INVALID_PROVENANCE',
      message: 'Imported memory provenance requires a source',
    })
  }
  const normalized = {
    origin: provenance.origin,
    source: optionalText(provenance.source, 'Provenance source'),
    externalId: optionalText(provenance.externalId, 'Provenance external ID'),
  }
  if (getConvexSize(normalized) > MAX_PROVENANCE_BYTES) {
    throw new ConvexError({
      code: 'INVALID_PROVENANCE',
      message: `Memory provenance exceeds the ${MAX_PROVENANCE_BYTES}-byte encoded limit`,
    })
  }
  return normalized
}

function normalizeRetention(
  value: MemoryValue,
  retention: MemoryRetention | undefined,
  now: number,
): MemoryRetention {
  if (!retention) {
    return value.kind === 'conversation'
      ? { policy: 'expire-at', expiresAt: now + CONVERSATION_RETENTION_MS }
      : { policy: 'keep-until-deleted' }
  }
  if (
    retention.policy === 'expire-at' &&
    (!Number.isFinite(retention.expiresAt) || retention.expiresAt <= now)
  ) {
    throw new ConvexError({
      code: 'INVALID_RETENTION',
      message: 'Memory expiry must be a finite future timestamp',
    })
  }
  return retention
}

function isExpired(memory: Doc<'memories'>, now: number) {
  return (
    memory.retention.policy === 'expire-at' && memory.retention.expiresAt <= now
  )
}

function capRetentionToSources(
  retention: MemoryRetention,
  sources: Array<Doc<'memories'>>,
): MemoryRetention {
  const sourceExpiries = sources.flatMap((source) =>
    source.retention.policy === 'expire-at' ? [source.retention.expiresAt] : [],
  )
  if (sourceExpiries.length === 0) return retention
  if (sourceExpiries.some((expiresAt) => !Number.isFinite(expiresAt))) {
    throw new ConvexError({
      code: 'INVALID_RETENTION',
      message: 'Memory source expiry must be finite',
    })
  }
  const earliestSourceExpiry = Math.min(...sourceExpiries)
  if (
    retention.policy === 'keep-until-deleted' ||
    retention.expiresAt > earliestSourceExpiry
  ) {
    return { policy: 'expire-at', expiresAt: earliestSourceExpiry }
  }
  return retention
}

type PurgeReceipt = {
  purgedMemories: number
  purgedRevisions: number
  purgedSourceLinks: number
}

const emptyPurgeReceipt = (): PurgeReceipt => ({
  purgedMemories: 0,
  purgedRevisions: 0,
  purgedSourceLinks: 0,
})

function addPurgeReceipts(
  left: PurgeReceipt,
  right: PurgeReceipt,
): PurgeReceipt {
  return {
    purgedMemories: left.purgedMemories + right.purgedMemories,
    purgedRevisions: left.purgedRevisions + right.purgedRevisions,
    purgedSourceLinks: left.purgedSourceLinks + right.purgedSourceLinks,
  }
}

async function purgeCanonicalMemory(
  ctx: MutationCtx,
  ownerKey: string,
  memory: Doc<'memories'>,
): Promise<PurgeReceipt> {
  const revisions = await ctx.db
    .query('memoryRevisions')
    .withIndex('by_owner_key_and_memory_id_and_revision', (q) =>
      q.eq('ownerKey', ownerKey).eq('memoryId', memory._id),
    )
    .take(MAX_REVISIONS + 1)
  if (revisions.length > MAX_REVISIONS) {
    throw new ConvexError({
      code: 'PURGE_LIMIT_EXCEEDED',
      message: 'Memory revision purge limit exceeded',
    })
  }

  const outgoingLinks = await ctx.db
    .query('memorySourceLinks')
    .withIndex('by_owner_key_and_derived_memory_id', (q) =>
      q.eq('ownerKey', ownerKey).eq('derivedMemoryId', memory._id),
    )
    .take(MAX_SOURCES + 1)
  if (outgoingLinks.length > MAX_SOURCES) {
    throw new ConvexError({
      code: 'PURGE_LIMIT_EXCEEDED',
      message: 'Memory source-link purge limit exceeded',
    })
  }

  const incomingLinks = await ctx.db
    .query('memorySourceLinks')
    .withIndex('by_owner_key_and_source_memory_id', (q) =>
      q.eq('ownerKey', ownerKey).eq('sourceMemoryId', memory._id),
    )
    .take(MAX_DERIVED_DEPENDENTS + 1)
  if (incomingLinks.length > MAX_DERIVED_DEPENDENTS) {
    throw new ConvexError({
      code: 'PURGE_LIMIT_EXCEEDED',
      message: 'Linked-memory purge limit exceeded',
    })
  }

  const linkIds = new Set(
    [...outgoingLinks, ...incomingLinks].map((link) => link._id),
  )
  await Promise.all(
    [...linkIds].map((linkId) => ctx.db.delete('memorySourceLinks', linkId)),
  )
  await Promise.all(
    revisions.map((revision) => ctx.db.delete('memoryRevisions', revision._id)),
  )
  await ctx.db.delete('memories', memory._id)

  return {
    purgedMemories: 1,
    purgedRevisions: revisions.length,
    purgedSourceLinks: linkIds.size,
  }
}

async function purgeMemoryWithDerivedDependents(
  ctx: MutationCtx,
  ownerKey: string,
  memory: Doc<'memories'>,
) {
  let receipt = emptyPurgeReceipt()
  if (memory.value.kind !== 'derived-memory') {
    const links = await ctx.db
      .query('memorySourceLinks')
      .withIndex('by_owner_key_and_source_memory_id', (q) =>
        q.eq('ownerKey', ownerKey).eq('sourceMemoryId', memory._id),
      )
      .take(MAX_DERIVED_DEPENDENTS + 1)
    if (links.length > MAX_DERIVED_DEPENDENTS) {
      throw new ConvexError({
        code: 'PURGE_LIMIT_EXCEEDED',
        message: 'Linked-memory purge limit exceeded',
      })
    }

    const derivedIds = [...new Set(links.map((link) => link.derivedMemoryId))]
    for (const derivedId of derivedIds) {
      const derived = await ctx.db.get('memories', derivedId)
      if (
        derived?.ownerKey === ownerKey &&
        derived.value.kind === 'derived-memory'
      ) {
        receipt = addPurgeReceipts(
          receipt,
          await purgeCanonicalMemory(ctx, ownerKey, derived),
        )
      }
    }
  }

  return addPurgeReceipts(
    receipt,
    await purgeCanonicalMemory(ctx, ownerKey, memory),
  )
}

export const capture = mutation({
  args: {
    value: memoryValueValidator,
    provenance: memoryProvenanceValidator,
    retention: v.optional(memoryRetentionValidator),
    sources: v.optional(v.array(memorySourceInputValidator)),
  },
  returns: v.id('memories'),
  handler: async (ctx, args) => {
    const ownerKey = await requireOwnerKey(ctx)
    const value = normalizeValue(args.value)
    const provenance = normalizeProvenance(args.provenance)
    const now = Date.now()
    let retention = normalizeRetention(value, args.retention, now)
    const sourceInputs = args.sources ?? []

    if (value.kind !== 'derived-memory' && sourceInputs.length > 0) {
      throw new ConvexError({
        code: 'INVALID_SOURCES',
        message: 'Only derived memories may have source links',
      })
    }
    if (value.kind === 'derived-memory' && provenance.origin !== 'derived') {
      throw new ConvexError({
        code: 'INVALID_PROVENANCE',
        message: 'Derived memories require derived provenance',
      })
    }
    if (value.kind !== 'derived-memory' && provenance.origin === 'derived') {
      throw new ConvexError({
        code: 'INVALID_PROVENANCE',
        message: 'Only derived memories may use derived provenance',
      })
    }
    if (
      (value.kind === 'bookmark' || value.kind === 'note') &&
      provenance.origin === 'conversation'
    ) {
      throw new ConvexError({
        code: 'INVALID_PROVENANCE',
        message: `${value.kind === 'bookmark' ? 'Bookmark' : 'Note'} provenance must be manual or import`,
      })
    }
    if (value.kind === 'derived-memory' && sourceInputs.length === 0) {
      throw new ConvexError({
        code: 'INVALID_SOURCES',
        message: 'Derived memories require at least one source',
      })
    }
    if (sourceInputs.length > MAX_SOURCES) {
      throw new ConvexError({
        code: 'INVALID_SOURCES',
        message: `A derived memory may reference at most ${MAX_SOURCES} sources`,
      })
    }
    if (
      new Set(sourceInputs.map((source) => source.memoryId)).size !==
      sourceInputs.length
    ) {
      throw new ConvexError({
        code: 'INVALID_SOURCES',
        message: 'Memory sources must be unique',
      })
    }

    const loadedSources = await Promise.all(
      sourceInputs.map((source) => ctx.db.get('memories', source.memoryId)),
    )
    const sourceMemories: Array<Doc<'memories'>> = []
    for (const source of loadedSources) {
      if (
        !source ||
        source.ownerKey !== ownerKey ||
        source.value.kind === 'derived-memory' ||
        isExpired(source, now)
      ) {
        throw new ConvexError({
          code: 'INVALID_SOURCES',
          message: 'Memory source not found',
        })
      }
      sourceMemories.push(source)
    }
    if (value.kind === 'derived-memory') {
      const sourceFanouts = await Promise.all(
        sourceMemories.map((source) =>
          ctx.db
            .query('memorySourceLinks')
            .withIndex('by_owner_key_and_source_memory_id', (q) =>
              q.eq('ownerKey', ownerKey).eq('sourceMemoryId', source._id),
            )
            .take(MAX_DERIVED_DEPENDENTS),
        ),
      )
      if (
        sourceFanouts.some(
          (linkedMemories) => linkedMemories.length >= MAX_DERIVED_DEPENDENTS,
        )
      ) {
        throw new ConvexError({
          code: 'SOURCE_FANOUT_LIMIT_REACHED',
          message: `A source may support at most ${MAX_DERIVED_DEPENDENTS} derived memories`,
        })
      }
      retention = capRetentionToSources(retention, sourceMemories)
    }

    const memoryId = await ctx.db.insert('memories', {
      ownerKey,
      value,
      provenance,
      retention,
      currentRevision: 1,
      createdAt: now,
      updatedAt: now,
    })
    await ctx.db.insert('memoryRevisions', {
      ownerKey,
      memoryId,
      revision: 1,
      value,
      reason: 'captured',
      createdAt: now,
    })
    await Promise.all(
      sourceInputs.map((source) =>
        ctx.db.insert('memorySourceLinks', {
          ownerKey,
          derivedMemoryId: memoryId,
          sourceMemoryId: source.memoryId,
          relationship: source.relationship,
          createdAt: now,
        }),
      ),
    )
    return memoryId
  },
})

export const inspect = query({
  args: { memoryId: v.id('memories') },
  returns: v.union(memoryInspectionValidator, v.null()),
  handler: async (ctx, { memoryId }) => {
    const ownerKey = await requireOwnerKey(ctx)
    const memory = await ctx.db.get('memories', memoryId)
    if (
      !memory ||
      memory.ownerKey !== ownerKey ||
      isExpired(memory, Date.now())
    ) {
      return null
    }

    const revisions = await ctx.db
      .query('memoryRevisions')
      .withIndex('by_owner_key_and_memory_id_and_revision', (q) =>
        q.eq('ownerKey', ownerKey).eq('memoryId', memoryId),
      )
      .order('asc')
      .take(MAX_REVISIONS)
    const links = await ctx.db
      .query('memorySourceLinks')
      .withIndex('by_owner_key_and_derived_memory_id', (q) =>
        q.eq('ownerKey', ownerKey).eq('derivedMemoryId', memoryId),
      )
      .take(MAX_SOURCES)
    const sources = (
      await Promise.all(
        links.map(async (link) => {
          const source = await ctx.db.get('memories', link.sourceMemoryId)
          if (!source || source.ownerKey !== ownerKey) return null
          return {
            memoryId: source._id,
            kind: source.value.kind,
            relationship: link.relationship,
          }
        }),
      )
    ).filter((source) => source !== null)

    return {
      memoryId: memory._id,
      value: memory.value,
      provenance: memory.provenance,
      retention: memory.retention,
      currentRevision: memory.currentRevision,
      createdAt: memory.createdAt,
      updatedAt: memory.updatedAt,
      revisions: revisions.map((revision) => ({
        revision: revision.revision,
        value: revision.value,
        reason: revision.reason,
        createdAt: revision.createdAt,
      })),
      sources,
    }
  },
})

export const correct = mutation({
  args: {
    memoryId: v.id('memories'),
    value: memoryValueValidator,
    reason: v.string(),
  },
  returns: memoryCorrectionResultValidator,
  handler: async (ctx, args) => {
    const ownerKey = await requireOwnerKey(ctx)
    const memory = await ctx.db.get('memories', args.memoryId)
    if (
      !memory ||
      memory.ownerKey !== ownerKey ||
      isExpired(memory, Date.now())
    ) {
      throw new ConvexError({
        code: 'MEMORY_NOT_FOUND',
        message: 'Memory not found',
      })
    }
    if (memory.value.kind !== args.value.kind) {
      throw new ConvexError({
        code: 'MEMORY_KIND_MISMATCH',
        message: 'A correction cannot change the memory kind',
      })
    }

    const value = normalizeValue(args.value)
    const reason = requiredText(args.reason, 'Correction reason')
    if (getConvexSize(reason) > MAX_CORRECTION_REASON_BYTES) {
      throw new ConvexError({
        code: 'INVALID_CORRECTION',
        message: 'Correction reason exceeds its encoded limit',
      })
    }
    if (reason.length > MAX_REASON_LENGTH) {
      throw new ConvexError({
        code: 'INVALID_CORRECTION',
        message: `Correction reason may not exceed ${MAX_REASON_LENGTH} characters`,
      })
    }
    if (JSON.stringify(value) === JSON.stringify(memory.value)) {
      return { memoryId: memory._id, currentRevision: memory.currentRevision }
    }
    if (memory.currentRevision >= MAX_REVISIONS) {
      throw new ConvexError({
        code: 'REVISION_LIMIT_REACHED',
        message: `A memory may have at most ${MAX_REVISIONS} revisions in this prototype`,
      })
    }

    const currentRevision = memory.currentRevision + 1
    const now = Date.now()
    await ctx.db.insert('memoryRevisions', {
      ownerKey,
      memoryId: memory._id,
      revision: currentRevision,
      value,
      reason,
      createdAt: now,
    })
    await ctx.db.patch('memories', memory._id, {
      value,
      currentRevision,
      updatedAt: now,
    })
    return { memoryId: memory._id, currentRevision }
  },
})

export const remove = mutation({
  args: { memoryId: v.id('memories') },
  returns: memoryRemovalResultValidator,
  handler: async (ctx, { memoryId }) => {
    const ownerKey = await requireOwnerKey(ctx)
    const memory = await ctx.db.get('memories', memoryId)
    if (!memory || memory.ownerKey !== ownerKey) {
      return { removed: false, ...emptyPurgeReceipt() }
    }

    const receipt = await purgeMemoryWithDerivedDependents(
      ctx,
      ownerKey,
      memory,
    )
    return { removed: true, ...receipt }
  },
})

export const retrieve = query({
  args: {
    query: v.string(),
    limit: v.optional(v.number()),
  },
  returns: v.array(memoryRetrievalResultValidator),
  handler: async (ctx, args) => {
    const ownerKey = await requireOwnerKey(ctx)
    const search = requiredText(args.query, 'Retrieval query')
    if (search.length > MAX_QUERY_LENGTH) {
      throw new ConvexError({
        code: 'INVALID_QUERY',
        message: `Retrieval query may not exceed ${MAX_QUERY_LENGTH} characters`,
      })
    }
    const limit = args.limit ?? 10
    if (
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > MAX_RETRIEVAL_RESULTS
    ) {
      throw new ConvexError({
        code: 'INVALID_LIMIT',
        message: `Retrieval limit must be an integer from 1 to ${MAX_RETRIEVAL_RESULTS}`,
      })
    }

    const candidates = await ctx.db
      .query('memories')
      .withIndex('by_owner_key', (q) => q.eq('ownerKey', ownerKey))
      .order('desc')
      .take(MAX_RETRIEVAL_CANDIDATES)
    const now = Date.now()
    const retained = candidates.filter((memory) => !isExpired(memory, now))

    return rankMemoryCandidates(search, retained, limit).map(
      ({ candidate, score }) => ({
        memoryId: candidate._id,
        value: candidate.value,
        provenance: candidate.provenance,
        retention: candidate.retention,
        currentRevision: candidate.currentRevision,
        updatedAt: candidate.updatedAt,
        score,
      }),
    )
  },
})
