import { v } from 'convex/values'

export const memoryKindValidator = v.union(
  v.literal('bookmark'),
  v.literal('note'),
  v.literal('conversation'),
  v.literal('derived-memory'),
)

export const memoryValueValidator = v.union(
  v.object({
    kind: v.literal('bookmark'),
    title: v.string(),
    url: v.string(),
    summary: v.optional(v.string()),
  }),
  v.object({
    kind: v.literal('note'),
    title: v.optional(v.string()),
    text: v.string(),
  }),
  v.object({
    kind: v.literal('conversation'),
    title: v.optional(v.string()),
    transcript: v.string(),
  }),
  v.object({
    kind: v.literal('derived-memory'),
    memoryType: v.union(
      v.literal('fact'),
      v.literal('preference'),
      v.literal('goal'),
      v.literal('summary'),
    ),
    text: v.string(),
  }),
)

export const memoryProvenanceValidator = v.object({
  origin: v.union(
    v.literal('manual'),
    v.literal('import'),
    v.literal('conversation'),
    v.literal('derived'),
  ),
  source: v.optional(v.string()),
  externalId: v.optional(v.string()),
})

export const memoryRetentionValidator = v.union(
  v.object({ policy: v.literal('keep-until-deleted') }),
  v.object({
    policy: v.literal('expire-at'),
    expiresAt: v.number(),
  }),
)

export const memorySourceInputValidator = v.object({
  memoryId: v.id('memories'),
  relationship: v.union(v.literal('supports'), v.literal('summarizes')),
})

export const memoryRevisionValidator = v.object({
  revision: v.number(),
  value: memoryValueValidator,
  reason: v.string(),
  createdAt: v.number(),
})

export const memorySourceInspectionValidator = v.object({
  memoryId: v.id('memories'),
  kind: memoryKindValidator,
  relationship: v.union(v.literal('supports'), v.literal('summarizes')),
})

export const memoryInspectionValidator = v.object({
  memoryId: v.id('memories'),
  value: memoryValueValidator,
  provenance: memoryProvenanceValidator,
  retention: memoryRetentionValidator,
  currentRevision: v.number(),
  createdAt: v.number(),
  updatedAt: v.number(),
  revisions: v.array(memoryRevisionValidator),
  sources: v.array(memorySourceInspectionValidator),
})

export const memoryRetrievalResultValidator = v.object({
  memoryId: v.id('memories'),
  value: memoryValueValidator,
  provenance: memoryProvenanceValidator,
  retention: memoryRetentionValidator,
  currentRevision: v.number(),
  updatedAt: v.number(),
  score: v.number(),
})

export const memoryCorrectionResultValidator = v.object({
  memoryId: v.id('memories'),
  currentRevision: v.number(),
})

export const memoryRemovalResultValidator = v.object({
  removed: v.boolean(),
  purgedMemories: v.number(),
  purgedRevisions: v.number(),
  purgedSourceLinks: v.number(),
})
