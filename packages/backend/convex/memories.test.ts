import { convexTest } from 'convex-test'
import { getConvexSize } from 'convex/values'
import { expect, test, vi } from 'vitest'
import { api } from './_generated/api'
import schema from './schema'
import { modules } from './test.setup'

const { capture, correct, inspect, remove, retrieve } = api.memories

const MAX_MEMORY_VALUE_BYTES = 16 * 1024
const MAX_PROVENANCE_BYTES = 4 * 1024

function noteValueAtEncodedSize(size: number, prefix = '') {
  const base = { kind: 'note' as const, text: prefix }
  const paddingLength = size - getConvexSize(base)
  if (paddingLength < 0) throw new Error('Synthetic note prefix exceeds size')
  const value = { ...base, text: `${prefix}${'x'.repeat(paddingLength)}` }
  expect(getConvexSize(value)).toBe(size)
  return value
}

function provenanceAtEncodedSize(size: number) {
  const base = { origin: 'manual' as const, source: '' }
  const paddingLength = size - getConvexSize(base)
  if (paddingLength < 1) throw new Error('Synthetic provenance size is too low')
  const provenance = { ...base, source: 'x'.repeat(paddingLength) }
  expect(getConvexSize(provenance)).toBe(size)
  return provenance
}

const syntheticBookmark = {
  value: {
    kind: 'bookmark' as const,
    title: 'Convex indexing field guide',
    url: 'https://example.test/convex-indexes',
    summary: 'A synthetic guide to bounded indexed queries.',
  },
  provenance: {
    origin: 'import' as const,
    source: 'synthetic-evaluation-set',
    externalId: 'bookmark-indexes-001',
  },
}

test('authenticated capture is inspectable only by its owner', async () => {
  const t = convexTest(schema, modules)
  const owner = t.withIdentity({
    subject: 'fixture-owner',
    tokenIdentifier: 'https://issuer.example.test|fixture-owner',
  })
  const otherOwner = t.withIdentity({
    subject: 'fixture-other',
    tokenIdentifier: 'https://issuer.example.test|fixture-other',
  })

  await expect(t.mutation(capture, syntheticBookmark)).rejects.toThrow(
    'Authentication required',
  )
  await expect(
    owner.mutation(capture, {
      ...syntheticBookmark,
      provenance: {
        origin: 'conversation',
        source: 'synthetic-invalid-provenance',
      },
    }),
  ).rejects.toThrow('Bookmark provenance must be manual or import')

  const memoryId = await owner.mutation(capture, syntheticBookmark)
  const captured = await owner.query(inspect, { memoryId })

  expect(captured).toMatchObject({
    memoryId,
    value: syntheticBookmark.value,
    provenance: syntheticBookmark.provenance,
    retention: { policy: 'keep-until-deleted' },
    currentRevision: 1,
    revisions: [
      {
        revision: 1,
        value: syntheticBookmark.value,
        reason: 'captured',
      },
    ],
    sources: [],
  })
  expect(await otherOwner.query(inspect, { memoryId })).toBeNull()
})

test('retrieval ranks bounded owner memories and inspection exposes derived provenance', async () => {
  const t = convexTest(schema, modules)
  const owner = t.withIdentity({
    tokenIdentifier: 'https://issuer.example.test|retrieval-owner',
  })
  const otherOwner = t.withIdentity({
    tokenIdentifier: 'https://issuer.example.test|retrieval-other',
  })
  const provenance = {
    origin: 'import' as const,
    source: 'synthetic-evaluation-set',
  }

  const bookmarkId = await owner.mutation(capture, {
    value: {
      kind: 'bookmark',
      title: 'Deterministic retrieval patterns',
      url: 'https://example.test/retrieval-patterns',
      summary: 'A bounded local search reference for prototypes.',
    },
    provenance,
  })
  const noteId = await owner.mutation(capture, {
    value: {
      kind: 'note',
      title: 'Local retrieval evaluation',
      text: 'Synthetic fixtures make deterministic ranking measurable.',
    },
    provenance,
  })
  const conversationId = await owner.mutation(capture, {
    value: {
      kind: 'conversation',
      title: 'Unrelated garden planning',
      transcript: 'Discussed basil, soil, and a watering schedule.',
    },
    provenance: {
      origin: 'conversation',
      source: 'synthetic-conversation',
    },
  })
  const foreignMemoryId = await otherOwner.mutation(capture, {
    value: {
      kind: 'note',
      title: 'Deterministic local retrieval',
      text: 'This exact phrase belongs to a different synthetic owner.',
    },
    provenance,
  })
  const derivedMemoryId = await owner.mutation(capture, {
    value: {
      kind: 'derived-memory',
      memoryType: 'preference',
      text: 'Prefer deterministic local retrieval for the first prototype.',
    },
    provenance: {
      origin: 'derived',
      source: 'local-rule-v1',
    },
    sources: [
      { memoryId: noteId, relationship: 'supports' },
      { memoryId: bookmarkId, relationship: 'summarizes' },
    ],
  })

  const results = await owner.query(retrieve, {
    query: 'deterministic local retrieval',
    limit: 3,
  })
  const derived = await owner.query(inspect, { memoryId: derivedMemoryId })
  const conversation = await owner.query(inspect, { memoryId: conversationId })

  expect(results[0]).toMatchObject({
    memoryId: derivedMemoryId,
    value: {
      kind: 'derived-memory',
      text: 'Prefer deterministic local retrieval for the first prototype.',
    },
  })
  expect(results).toHaveLength(3)
  expect(results.every((result) => result.score > 0)).toBe(true)
  expect(results.map((result) => result.memoryId)).not.toContain(
    foreignMemoryId,
  )
  expect(derived?.sources).toEqual([
    { memoryId: noteId, kind: 'note', relationship: 'supports' },
    { memoryId: bookmarkId, kind: 'bookmark', relationship: 'summarizes' },
  ])
  expect(conversation?.retention).toMatchObject({ policy: 'expire-at' })
})

test('retrieval bounds its window at the maximum accepted encoded payload', async () => {
  const t = convexTest(schema, modules)
  const owner = t.withIdentity({
    tokenIdentifier: 'https://issuer.example.test|bounded-retrieval-owner',
  })
  const provenance = provenanceAtEncodedSize(MAX_PROVENANCE_BYTES)
  const oldestMemoryId = await owner.mutation(capture, {
    value: noteValueAtEncodedSize(
      MAX_MEMORY_VALUE_BYTES,
      'oldest only signal ',
    ),
    provenance,
  })

  for (let candidate = 1; candidate <= 64; candidate += 1) {
    await owner.mutation(capture, {
      value: noteValueAtEncodedSize(
        MAX_MEMORY_VALUE_BYTES,
        `bounded window fixture ${candidate.toString().padStart(2, '0')} `,
      ),
      provenance,
    })
  }

  const outsideWindowResults = await owner.query(retrieve, {
    query: 'oldest only signal',
  })
  expect(outsideWindowResults.map((result) => result.memoryId)).not.toContain(
    oldestMemoryId,
  )
  const results = await owner.query(retrieve, {
    query: 'bounded window fixture',
    limit: 20,
  })
  expect(results).toHaveLength(20)
  expect(results.map((result) => result.memoryId)).not.toContain(oldestMemoryId)
  expect(
    results.every(
      (result) => getConvexSize(result.value) === MAX_MEMORY_VALUE_BYTES,
    ),
  ).toBe(true)
})

test('retrieval phrase scoring matches exact token sequences, not substrings', async () => {
  const t = convexTest(schema, modules)
  const owner = t.withIdentity({
    tokenIdentifier: 'https://issuer.example.test|token-sequence-owner',
  })
  const cartMemoryId = await owner.mutation(capture, {
    value: {
      kind: 'note',
      title: 'Cart',
      text: 'Synthetic shopping fixture.',
    },
    provenance: { origin: 'manual' },
  })
  const artMemoryId = await owner.mutation(capture, {
    value: {
      kind: 'note',
      title: 'Art',
      text: 'Synthetic gallery fixture.',
    },
    provenance: { origin: 'manual' },
  })

  const results = await owner.query(retrieve, { query: 'art' })
  expect(results.map((result) => result.memoryId)).toEqual([artMemoryId])
  expect(results.map((result) => result.memoryId)).not.toContain(cartMemoryId)
})

test('correction advances canonical state and preserves immutable revision history', async () => {
  const t = convexTest(schema, modules)
  const owner = t.withIdentity({
    tokenIdentifier: 'https://issuer.example.test|editor',
  })
  const otherOwner = t.withIdentity({
    tokenIdentifier: 'https://issuer.example.test|other-editor',
  })
  const original = {
    value: {
      kind: 'note' as const,
      title: 'Synthetic meeting note',
      text: 'The prototype uses an external vector service.',
    },
    provenance: {
      origin: 'manual' as const,
      source: 'synthetic-correction-fixture',
      externalId: 'correction-note-001',
    },
  }
  const correctedValue = {
    kind: 'note' as const,
    title: 'Synthetic meeting note',
    text: 'The prototype uses bounded local retrieval without embeddings.',
  }
  const memoryId = await owner.mutation(capture, original)

  await expect(
    otherOwner.mutation(correct, {
      memoryId,
      value: correctedValue,
      reason: 'Should not cross owner boundaries',
    }),
  ).rejects.toThrow('Memory not found')

  const result = await owner.mutation(correct, {
    memoryId,
    value: correctedValue,
    reason: 'Correct the retrieval architecture',
  })
  const inspected = await owner.query(inspect, { memoryId })

  expect(result).toEqual({ memoryId, currentRevision: 2 })
  expect(inspected).toMatchObject({
    value: correctedValue,
    provenance: original.provenance,
    currentRevision: 2,
    revisions: [
      { revision: 1, value: original.value, reason: 'captured' },
      {
        revision: 2,
        value: correctedValue,
        reason: 'Correct the retrieval architecture',
      },
    ],
  })
})

test('encoded payload limits keep maximum revision history hard-deletable', async () => {
  const t = convexTest(schema, modules)
  const owner = t.withIdentity({
    tokenIdentifier: 'https://issuer.example.test|payload-owner',
  })
  const oversizedOwner = t.withIdentity({
    tokenIdentifier: 'x'.repeat(1_025),
  })

  await expect(
    owner.mutation(capture, {
      value: noteValueAtEncodedSize(MAX_MEMORY_VALUE_BYTES + 1),
      provenance: { origin: 'manual' },
    }),
  ).rejects.toThrow('Memory value exceeds the 16384-byte encoded limit')
  await expect(
    owner.mutation(capture, {
      value: { kind: 'note', text: '€'.repeat(5_500) },
      provenance: { origin: 'manual' },
    }),
  ).rejects.toThrow('Memory value exceeds the 16384-byte encoded limit')
  await expect(
    owner.mutation(capture, {
      value: { kind: 'note', text: 'Synthetic provenance boundary.' },
      provenance: provenanceAtEncodedSize(MAX_PROVENANCE_BYTES + 1),
    }),
  ).rejects.toThrow('Memory provenance exceeds the 4096-byte encoded limit')
  await expect(
    oversizedOwner.mutation(capture, {
      value: { kind: 'note', text: 'Synthetic owner-key boundary.' },
      provenance: { origin: 'manual' },
    }),
  ).rejects.toThrow('Authenticated owner key exceeds its encoded limit')

  const memoryId = await owner.mutation(capture, {
    value: noteValueAtEncodedSize(MAX_MEMORY_VALUE_BYTES, 'r01:'),
    provenance: provenanceAtEncodedSize(MAX_PROVENANCE_BYTES),
  })
  await expect(
    owner.mutation(correct, {
      memoryId,
      value: noteValueAtEncodedSize(MAX_MEMORY_VALUE_BYTES, 'bad:'),
      reason: '€'.repeat(400),
    }),
  ).rejects.toThrow('Correction reason exceeds its encoded limit')

  for (let revision = 2; revision <= 50; revision += 1) {
    await owner.mutation(correct, {
      memoryId,
      value: noteValueAtEncodedSize(
        MAX_MEMORY_VALUE_BYTES,
        `r${revision.toString().padStart(2, '0')}:`,
      ),
      reason: `Synthetic revision ${revision}`,
    })
  }

  const inspected = await owner.query(inspect, { memoryId })
  expect(inspected?.currentRevision).toBe(50)
  expect(inspected?.revisions).toHaveLength(50)
  expect(await owner.mutation(remove, { memoryId })).toEqual({
    removed: true,
    purgedMemories: 1,
    purgedRevisions: 50,
    purgedSourceLinks: 0,
  })
})

test('capture caps source fan-out at the maximum publicly deletable graph', async () => {
  const t = convexTest(schema, modules)
  const owner = t.withIdentity({
    tokenIdentifier: 'https://issuer.example.test|fanout-owner',
  })
  const sourceIds = []
  for (let source = 1; source <= 20; source += 1) {
    sourceIds.push(
      await owner.mutation(capture, {
        value: {
          kind: 'note',
          text: `Synthetic fan-out source ${source}.`,
        },
        provenance: { origin: 'manual' },
      }),
    )
  }
  const sources = sourceIds.map((memoryId, index) => ({
    memoryId,
    relationship: index === 0 ? ('supports' as const) : ('summarizes' as const),
  }))
  const derivedIds = []
  for (let dependent = 1; dependent <= 8; dependent += 1) {
    derivedIds.push(
      await owner.mutation(capture, {
        value: {
          kind: 'derived-memory',
          memoryType: 'summary',
          text: `Synthetic bounded dependent ${dependent}.`,
        },
        provenance: { origin: 'derived' },
        sources,
      }),
    )
  }

  await expect(
    owner.mutation(capture, {
      value: {
        kind: 'derived-memory',
        memoryType: 'summary',
        text: 'Synthetic adversarial ninth dependent.',
      },
      provenance: { origin: 'derived' },
      sources,
    }),
  ).rejects.toThrow('A source may support at most 8 derived memories')

  expect(await owner.mutation(remove, { memoryId: sourceIds[0] })).toEqual({
    removed: true,
    purgedMemories: 9,
    purgedRevisions: 9,
    purgedSourceLinks: 160,
  })
  for (const derivedId of derivedIds) {
    expect(await owner.query(inspect, { memoryId: derivedId })).toBeNull()
  }
  expect(await owner.query(inspect, { memoryId: sourceIds[1] })).not.toBeNull()
})

test('owner deletion hard-purges history and source links with linked derived memory', async () => {
  const t = convexTest(schema, modules)
  const owner = t.withIdentity({
    tokenIdentifier: 'https://issuer.example.test|deleter',
  })
  const otherOwner = t.withIdentity({
    tokenIdentifier: 'https://issuer.example.test|other-deleter',
  })
  const provenance = {
    origin: 'manual' as const,
    source: 'synthetic-deletion-fixture',
  }
  const sourceMemoryId = await owner.mutation(capture, {
    value: {
      kind: 'note',
      title: 'Synthetic retention note',
      text: 'Keep obsolete prototype wording.',
    },
    provenance,
  })
  const remainingSourceId = await owner.mutation(capture, {
    value: {
      kind: 'bookmark',
      title: 'Remaining synthetic source',
      url: 'https://example.test/remaining-source',
    },
    provenance,
  })
  await owner.mutation(correct, {
    memoryId: sourceMemoryId,
    value: {
      kind: 'note',
      title: 'Synthetic retention note',
      text: 'Delete this corrected prototype wording.',
    },
    reason: 'Create history that deletion must purge',
  })
  const derivedMemoryId = await owner.mutation(capture, {
    value: {
      kind: 'derived-memory',
      memoryType: 'summary',
      text: 'A synthetic derived statement that must cascade with its deleted source.',
    },
    provenance: { origin: 'derived', source: 'local-rule-v1' },
    sources: [
      { memoryId: sourceMemoryId, relationship: 'supports' },
      { memoryId: remainingSourceId, relationship: 'summarizes' },
    ],
  })

  expect(
    await otherOwner.mutation(remove, { memoryId: sourceMemoryId }),
  ).toEqual({
    removed: false,
    purgedMemories: 0,
    purgedRevisions: 0,
    purgedSourceLinks: 0,
  })
  expect(
    await owner.query(inspect, { memoryId: sourceMemoryId }),
  ).not.toBeNull()

  expect(await owner.mutation(remove, { memoryId: sourceMemoryId })).toEqual({
    removed: true,
    purgedMemories: 2,
    purgedRevisions: 3,
    purgedSourceLinks: 2,
  })
  expect(await owner.query(inspect, { memoryId: sourceMemoryId })).toBeNull()
  expect(await owner.query(inspect, { memoryId: derivedMemoryId })).toBeNull()
  expect(
    await owner.query(inspect, { memoryId: remainingSourceId }),
  ).not.toBeNull()
  expect(
    await owner.query(retrieve, {
      query: 'corrected prototype wording',
      limit: 10,
    }),
  ).toEqual([])
  expect(await owner.mutation(remove, { memoryId: sourceMemoryId })).toEqual({
    removed: false,
    purgedMemories: 0,
    purgedRevisions: 0,
    purgedSourceLinks: 0,
  })
})

test('retention rejects non-finite timestamps and derived expiry caps to the earliest finite source', async () => {
  vi.useFakeTimers()
  try {
    const now = new Date('2026-07-10T09:00:00.000Z')
    vi.setSystemTime(now)
    const t = convexTest(schema, modules)
    const owner = t.withIdentity({
      tokenIdentifier: 'https://issuer.example.test|retention-owner',
    })

    for (const expiresAt of [
      Number.NaN,
      Number.POSITIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
    ]) {
      await expect(
        owner.mutation(capture, {
          value: {
            kind: 'note',
            text: 'Synthetic invalid retention fixture.',
          },
          provenance: { origin: 'manual' },
          retention: { policy: 'expire-at', expiresAt },
        }),
      ).rejects.toThrow('Memory expiry must be a finite future timestamp')
    }

    const laterExpiry = now.getTime() + 20_000
    const earliestExpiry = now.getTime() + 10_000
    const laterSourceId = await owner.mutation(capture, {
      value: { kind: 'note', text: 'Synthetic later-expiring source.' },
      provenance: { origin: 'manual' },
      retention: { policy: 'expire-at', expiresAt: laterExpiry },
    })
    const earliestSourceId = await owner.mutation(capture, {
      value: { kind: 'note', text: 'Synthetic earliest-expiring source.' },
      provenance: { origin: 'manual' },
      retention: { policy: 'expire-at', expiresAt: earliestExpiry },
    })
    const derivedMemoryId = await owner.mutation(capture, {
      value: {
        kind: 'derived-memory',
        memoryType: 'summary',
        text: 'Synthetic retention cap summary.',
      },
      provenance: { origin: 'derived' },
      retention: {
        policy: 'expire-at',
        expiresAt: now.getTime() + 30_000,
      },
      sources: [
        { memoryId: laterSourceId, relationship: 'supports' },
        { memoryId: earliestSourceId, relationship: 'summarizes' },
      ],
    })

    const inspected = await owner.query(inspect, {
      memoryId: derivedMemoryId,
    })
    expect(inspected?.retention).toEqual({
      policy: 'expire-at',
      expiresAt: earliestExpiry,
    })
    expect(
      inspected?.retention.policy === 'expire-at' &&
        Number.isFinite(inspected.retention.expiresAt),
    ).toBe(true)
  } finally {
    vi.useRealTimers()
  }
})

test('expired memory is hidden but remains hard-deletable by its owner', async () => {
  vi.useFakeTimers()
  try {
    const now = new Date('2026-07-10T09:00:00.000Z')
    vi.setSystemTime(now)
    const t = convexTest(schema, modules)
    const owner = t.withIdentity({
      tokenIdentifier: 'https://issuer.example.test|expiry-owner',
    })
    const memoryId = await owner.mutation(capture, {
      value: {
        kind: 'note',
        title: 'Synthetic expiring note',
        text: 'This fixture should disappear after its retention deadline.',
      },
      provenance: { origin: 'manual', source: 'synthetic-expiry-fixture' },
      retention: { policy: 'expire-at', expiresAt: now.getTime() + 1_000 },
    })

    vi.setSystemTime(new Date(now.getTime() + 2_000))

    expect(await owner.query(inspect, { memoryId })).toBeNull()
    expect(
      await owner.query(retrieve, { query: 'retention deadline' }),
    ).toEqual([])
    await expect(
      owner.mutation(correct, {
        memoryId,
        value: {
          kind: 'note',
          title: 'Synthetic expiring note',
          text: 'Expired content may not be corrected.',
        },
        reason: 'This must be rejected after expiry',
      }),
    ).rejects.toThrow('Memory not found')
    expect(await owner.mutation(remove, { memoryId })).toEqual({
      removed: true,
      purgedMemories: 1,
      purgedRevisions: 1,
      purgedSourceLinks: 0,
    })
  } finally {
    vi.useRealTimers()
  }
})
