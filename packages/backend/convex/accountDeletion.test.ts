import { convexTest } from 'convex-test'
import { expect, test, vi } from 'vitest'
import { api, internal } from './_generated/api'
import schema from './schema'
import { modules } from './test.setup'

const ACTIVATION_TOKEN = 'account-deletion-test-capability-00000001'

function authenticated(
  t: ReturnType<typeof convexTest>,
  subject: string,
  issuer = 'https://issuer.example.test',
) {
  return t.withIdentity({
    subject,
    tokenIdentifier: `${issuer}|${subject}`,
  })
}

async function prepareAndActivate(
  t: ReturnType<typeof convexTest>,
  owner: ReturnType<typeof authenticated>,
  activationToken = ACTIVATION_TOKEN,
) {
  const prepared = await owner.mutation(api.accountDeletion.prepare, {
    confirmation: 'DELETE',
    activationToken,
  })
  await t.mutation(api.accountDeletion.activate, {
    jobId: prepared.jobId,
    activationToken,
  })
  return prepared
}

async function finishDeletion(t: ReturnType<typeof convexTest>) {
  // The eraser deliberately schedules one bounded mutation per table/batch.
  // A heavily populated fixture can exceed convex-test's hidden default of
  // 100 iterations without being recursive or unbounded.
  // SAFETY: convex-test's runtime implementation accepts an optional second
  // `maxIterations` argument (defaulting to 100) that its published type
  // signature omits.
  await (
    t.finishAllScheduledFunctions as (
      advanceTimers: () => void,
      maxIterations: number,
    ) => Promise<void>
  )(vi.runAllTimers, 1_000)
}

test('account erasure requires authentication', async () => {
  const t = convexTest(schema, modules)
  await expect(
    t.mutation(api.accountDeletion.prepare, {
      confirmation: 'DELETE',
      activationToken: ACTIVATION_TOKEN,
    }),
  ).rejects.toThrow('Authentication required')
})

test('preparing and cancelling deletion never erases an active account', async () => {
  const t = convexTest(schema, modules)
  const subject = 'prepare_owner'
  const owner = authenticated(t, subject)
  await t.run(async (ctx) => {
    await ctx.db.insert('goals', {
      userId: subject,
      title: 'Keep me',
      status: 'active',
    })
  })

  const prepared = await owner.mutation(api.accountDeletion.prepare, {
    confirmation: 'DELETE',
    activationToken: ACTIVATION_TOKEN,
  })
  await expect(
    t.mutation(api.accountDeletion.activate, {
      jobId: prepared.jobId,
      activationToken: 'account-deletion-test-capability-99999999',
    }),
  ).rejects.toThrow('Invalid account-deletion capability')
  expect(await t.run((ctx) => ctx.db.query('goals').collect())).toHaveLength(1)

  await expect(
    owner.mutation(api.accountDeletion.cancel, {
      jobId: prepared.jobId,
      activationToken: ACTIVATION_TOKEN,
    }),
  ).resolves.toEqual({ status: 'cancelled' })
  expect(
    await t.run((ctx) => ctx.db.query('accountDeletionJobs').collect()),
  ).toHaveLength(0)
  expect(await t.run((ctx) => ctx.db.query('goals').collect())).toHaveLength(1)
})

test('Apple revocation preflight is bound to the authenticated deletion job', async () => {
  const t = convexTest(schema, modules)
  const subject = 'apple_preflight_owner'
  const ownerKey = `https://issuer.example.test|${subject}`
  const owner = authenticated(t, subject)
  const prepared = await owner.mutation(api.accountDeletion.prepare, {
    confirmation: 'DELETE',
    activationToken: ACTIVATION_TOKEN,
  })

  await expect(
    t.query(internal.accountDeletion.authorizeAppleRevocation, {
      jobId: prepared.jobId,
      activationToken: ACTIVATION_TOKEN,
      ownerKey: 'https://issuer.example.test|different_owner',
      userId: subject,
    }),
  ).rejects.toThrow('Invalid account-deletion capability')

  await expect(
    t.query(internal.accountDeletion.authorizeAppleRevocation, {
      jobId: prepared.jobId,
      activationToken: ACTIVATION_TOKEN,
      ownerKey,
      userId: subject,
    }),
  ).resolves.toEqual({ userId: subject })

  await t.mutation(internal.accountDeletion.completeAppleRevocation, {
    jobId: prepared.jobId,
    activationToken: ACTIVATION_TOKEN,
    ownerKey,
    userId: subject,
    status: 'revoked',
  })
  const completed = await t.run((ctx) =>
    ctx.db.get('accountDeletionJobs', prepared.jobId),
  )
  expect(completed).toMatchObject({
    appleRevocationStatus: 'revoked',
    appleRevocationCompletedAt: expect.any(Number),
  })
  expect(JSON.stringify(completed)).not.toContain('apple-token')

  const rotatedToken = 'account-deletion-test-capability-00000002'
  await owner.mutation(api.accountDeletion.prepare, {
    confirmation: 'DELETE',
    activationToken: rotatedToken,
  })
  const rotated = await t.run((ctx) =>
    ctx.db.get('accountDeletionJobs', prepared.jobId),
  )
  expect(rotated?.appleRevocationStatus).toBeUndefined()
  expect(rotated?.appleRevocationCompletedAt).toBeUndefined()
})

test('signed Clerk deletion webhook idempotently activates a prepared job', async () => {
  vi.useFakeTimers()
  try {
    const t = convexTest(schema, modules)
    const subject = 'webhook_owner'
    const owner = authenticated(t, subject)
    await t.run(async (ctx) => {
      await ctx.db.insert('goals', {
        userId: subject,
        title: 'Delete me',
        status: 'active',
      })
    })
    await owner.mutation(api.accountDeletion.prepare, {
      confirmation: 'DELETE',
      activationToken: ACTIVATION_TOKEN,
    })
    await t.mutation(internal.accountDeletion.activateFromClerkWebhook, {
      userId: subject,
    })
    await t.mutation(internal.accountDeletion.activateFromClerkWebhook, {
      userId: subject,
    })
    await finishDeletion(t)

    expect(await t.run((ctx) => ctx.db.query('goals').collect())).toHaveLength(
      0,
    )
    const jobs = await t.run((ctx) =>
      ctx.db.query('accountDeletionJobs').collect(),
    )
    expect(jobs).toHaveLength(1)
    expect(jobs[0]?.status).toBe('tombstoned')
  } finally {
    vi.useRealTimers()
  }
}, 30_000)

test('account erasure includes independent journal entries', async () => {
  vi.useFakeTimers()
  try {
    const t = convexTest(schema, modules)
    const subject = 'journal_deletion_owner'
    const ownerKey = `https://issuer.example.test|${subject}`
    const owner = authenticated(t, subject)
    await t.run(async (ctx) => {
      await ctx.db.insert('journalEntries', {
        ownerKey,
        userId: subject,
        localDate: '2026-07-19',
        timeZone: 'Europe/Rome',
        occurredAt: Date.UTC(2026, 6, 19, 12),
        title: 'Private memory',
        body: 'Remove this with my account.',
        tags: ['private'],
        searchText: 'Private memory Remove this with my account. private',
        isPinned: false,
        isFavorite: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })
    })

    await prepareAndActivate(t, owner)
    await finishDeletion(t)

    expect(
      await t.run((ctx) => ctx.db.query('journalEntries').collect()),
    ).toHaveLength(0)
  } finally {
    vi.useRealTimers()
  }
}, 30_000)

test('account erasure removes Bee Site metadata and deployment history', async () => {
  vi.useFakeTimers()
  try {
    const t = convexTest(schema, modules)
    const subject = 'site_deletion_owner'
    const owner = authenticated(t, subject)
    await t.run(async (ctx) => {
      const now = Date.now()
      const siteId = await ctx.db.insert('beeSites', {
        userId: subject,
        slug: 'private-studio',
        title: 'Private studio',
        status: 'draft',
        pageCount: 0,
        createdAt: now,
        updatedAt: now,
      })
      await ctx.db.insert('beeSiteDeployments', {
        userId: subject,
        siteId,
        version: 'privateversion01',
        kind: 'preview',
        status: 'ready',
        manifestKey: `users/${subject}/sites/${siteId}/deployments/privateversion01/`,
        pageCount: 1,
        fileCount: 2,
        totalBytes: 100,
        createdAt: now,
        completedAt: now,
      })
      await ctx.db.insert('beeSiteUsage', {
        userId: subject,
        monthKey: '2026-08',
        generationCount: 1,
        publishCount: 0,
        updatedAt: now,
      })
    })

    await prepareAndActivate(t, owner)
    await finishDeletion(t)

    expect(await t.run((ctx) => ctx.db.query('beeSites').collect())).toEqual([])
    expect(
      await t.run((ctx) => ctx.db.query('beeSiteDeployments').collect()),
    ).toEqual([])
    expect(await t.run((ctx) => ctx.db.query('beeSiteUsage').collect())).toEqual([])
  } finally {
    vi.useRealTimers()
  }
}, 30_000)

test('watchdog expires an unconfirmed intent without deleting user data', async () => {
  const t = convexTest(schema, modules)
  const subject = 'expired_intent_owner'
  const owner = authenticated(t, subject)
  await t.run(async (ctx) => {
    await ctx.db.insert('goals', {
      userId: subject,
      title: 'Still active',
      status: 'active',
    })
  })
  const prepared = await owner.mutation(api.accountDeletion.prepare, {
    confirmation: 'DELETE',
    activationToken: ACTIVATION_TOKEN,
  })
  await t.run((ctx) =>
    ctx.db.patch('accountDeletionJobs', prepared.jobId, {
      expiresAt: Date.now() - 1,
    }),
  )
  await t.mutation(internal.accountDeletion.watchdog, {})

  expect(
    await t.run((ctx) => ctx.db.query('accountDeletionJobs').collect()),
  ).toHaveLength(0)
  expect(await t.run((ctx) => ctx.db.query('goals').collect())).toHaveLength(1)
})

test('watchdog resumes a stalled deletion cursor created before two-phase rollout', async () => {
  vi.useFakeTimers()
  try {
    const t = convexTest(schema, modules)
    const subject = 'legacy_deletion_owner'
    await t.run(async (ctx) => {
      await ctx.db.insert('goals', {
        userId: subject,
        title: 'Legacy deletion',
        status: 'active',
      })
      await ctx.db.insert('accountDeletionJobs', {
        ownerKey: `https://issuer.example.test|${subject}`,
        userId: subject,
        stageIndex: 0,
        deletedDocuments: 0,
        passDeletedDocuments: 0,
        createdAt: Date.now() - 60 * 60 * 1_000,
        updatedAt: Date.now() - 60 * 60 * 1_000,
      })
    })

    await t.mutation(internal.accountDeletion.watchdog, {})
    await finishDeletion(t)

    expect(await t.run((ctx) => ctx.db.query('goals').collect())).toHaveLength(
      0,
    )
    const job = await t.run((ctx) =>
      ctx.db.query('accountDeletionJobs').unique(),
    )
    expect(job?.status).toBe('tombstoned')
  } finally {
    vi.useRealTimers()
  }
}, 30_000)

test('tombstone safety sweep removes data written after the first purge', async () => {
  vi.useFakeTimers()
  try {
    const t = convexTest(schema, modules)
    const subject = 'late_write_owner'
    const owner = authenticated(t, subject)
    await prepareAndActivate(t, owner)
    await finishDeletion(t)

    await t.run(async (ctx) => {
      await ctx.db.insert('goals', {
        userId: subject,
        title: 'Late write',
        status: 'active',
      })
      const job = await ctx.db.query('accountDeletionJobs').unique()
      if (!job) throw new Error('Expected deletion tombstone')
      await ctx.db.patch('accountDeletionJobs', job._id, {
        nextSweepAt: Date.now() - 1,
        updatedAt: Date.now() - 1,
      })
    })
    await t.mutation(internal.accountDeletion.watchdog, {})
    await finishDeletion(t)

    expect(await t.run((ctx) => ctx.db.query('goals').collect())).toHaveLength(
      0,
    )
    const job = await t.run((ctx) =>
      ctx.db.query('accountDeletionJobs').unique(),
    )
    expect(job?.status).toBe('tombstoned')
  } finally {
    vi.useRealTimers()
  }
}, 30_000)

test('watchdog expires a tombstone on time even when its next sweep is later', async () => {
  const t = convexTest(schema, modules)
  await t.run(async (ctx) => {
    const now = Date.now()
    await ctx.db.insert('accountDeletionJobs', {
      ownerKey: 'https://issuer.example.test|expired_tombstone_owner',
      userId: 'expired_tombstone_owner',
      status: 'tombstoned',
      stageIndex: 0,
      deletedDocuments: 1,
      passDeletedDocuments: 0,
      tombstonedAt: now - 31 * 24 * 60 * 60 * 1_000,
      nextSweepAt: now + 6 * 60 * 60 * 1_000,
      expiresAt: now - 1,
      createdAt: now - 31 * 24 * 60 * 60 * 1_000,
      updatedAt: now - 6 * 60 * 60 * 1_000,
    })
  })

  await t.mutation(internal.accountDeletion.watchdog, {})

  expect(
    await t.run((ctx) => ctx.db.query('accountDeletionJobs').collect()),
  ).toEqual([])
})

test('account erasure removes RevenueCat subscription state under the single-issuer contract', async () => {
  vi.useFakeTimers()
  try {
    const t = convexTest(schema, modules)
    const subject = 'revenuecat_owner'
    const owner = authenticated(t, subject)

    await t.run(async (ctx) => {
      for (let index = 0; index < 25; index += 1) {
        await ctx.db.insert('subscriptionEntitlements', {
          userId: subject,
          entitlementId: `pro:${index}`,
          productId: 'com.beegreat.app.pro.monthly',
          environment: index % 2 === 0 ? 'PRODUCTION' : 'SANDBOX',
          active: true,
          expiresAt: 10_000 + index,
          latestEventId: `event:${index}`,
          latestEventType: 'RENEWAL',
          latestEventTimestampMs: 1_000 + index,
          updatedAt: 2_000 + index,
        })
      }
      await ctx.db.insert('subscriptionEntitlements', {
        userId: 'different_clerk_subject',
        entitlementId: 'pro',
        productId: 'com.beegreat.app.pro.monthly',
        environment: 'PRODUCTION',
        active: true,
        expiresAt: 10_000,
        latestEventId: 'other:event',
        latestEventType: 'RENEWAL',
        latestEventTimestampMs: 1_000,
        updatedAt: 2_000,
      })
      await ctx.db.insert('subscriptionStatusChecks', {
        userId: subject,
        checkedAt: 2_000,
        active: true,
        productId: 'com.beegreat.app.pro.monthly',
        environment: 'PRODUCTION',
        expiresAt: 10_000,
      })
      await ctx.db.insert('subscriptionStatusChecks', {
        userId: 'different_clerk_subject',
        checkedAt: 2_000,
        active: true,
        productId: 'com.beegreat.app.pro.monthly',
        environment: 'PRODUCTION',
        expiresAt: 10_000,
      })
    })

    // Production accepts tokens from one fixed Clerk issuer, and RevenueCat
    // receives only that Clerk subject as App User ID. The deletion contract
    // therefore treats all rows for this subject as belonging to this account.
    await prepareAndActivate(t, owner)
    await finishDeletion(t)

    const remaining = await t.run(async (ctx) => ({
      entitlements: await ctx.db.query('subscriptionEntitlements').collect(),
      statusChecks: await ctx.db.query('subscriptionStatusChecks').collect(),
    }))
    expect(remaining.entitlements.map((row) => row.userId)).toEqual([
      'different_clerk_subject',
    ])
    expect(remaining.statusChecks.map((row) => row.userId)).toEqual([
      'different_clerk_subject',
    ])
  } finally {
    vi.useRealTimers()
  }
}, 30_000)

test('account erasure removes NFC actions and execution snapshots', async () => {
  vi.useFakeTimers()
  try {
    const t = convexTest(schema, modules)
    const subject = 'nfc_deletion_owner'
    const otherSubject = 'nfc_deletion_other'
    const owner = authenticated(t, subject)
    const other = authenticated(t, otherSubject)

    const createAndExecute = async (
      identity: ReturnType<typeof authenticated>,
      label: string,
    ) => {
      const action = await identity.mutation(api.nfcActions.create, {
        label,
        definition: { type: 'hydration', amountMl: 250 },
      })
      await identity.mutation(api.nfcActions.execute, {
        publicId: new URL(action.tagUrl).pathname.split('/').at(-1)!,
        localDate: '2026-07-20',
        timeZone: 'Europe/Rome',
      })
    }

    await createAndExecute(owner, 'Owned bottle')
    await createAndExecute(other, 'Other bottle')
    await prepareAndActivate(t, owner)
    await finishDeletion(t)

    const remaining = await t.run(async (ctx) => ({
      actions: await ctx.db.query('nfcActions').collect(),
      executions: await ctx.db.query('nfcActionExecutions').collect(),
    }))
    expect(remaining.actions.map((row) => row.userId)).toEqual([otherSubject])
    expect(remaining.executions.map((row) => row.userId)).toEqual([
      otherSubject,
    ])
  } finally {
    vi.useRealTimers()
  }
}, 30_000)

test('account erasure removes public profiles, links, and handle aliases', async () => {
  vi.useFakeTimers()
  try {
    const t = convexTest(schema, modules)
    const subject = 'public_profile_owner'
    const owner = authenticated(t, subject)

    await owner.mutation(api.publicProfiles.ensureMine, {
      displayName: 'Delete This Bee',
      suggestedHandle: 'old-bee-handle',
    })
    const profile = await owner.mutation(api.publicProfiles.saveMine, {
      handle: 'new-bee-handle',
      displayName: 'Delete This Bee',
      bio: 'This profile should be fully erased.',
      published: true,
      links: [
        {
          provider: 'website',
          label: 'My site',
          url: 'https://example.test/profile',
        },
      ],
    })

    expect(
      await t.query(api.publicProfiles.byHandle, { handle: 'old-bee-handle' }),
    ).toEqual(profile)

    await prepareAndActivate(t, owner)
    await finishDeletion(t)

    const remaining = await t.run(async (ctx) => ({
      profiles: await ctx.db.query('publicProfiles').collect(),
      links: await ctx.db.query('publicProfileLinks').collect(),
      aliases: await ctx.db.query('publicProfileAliases').collect(),
    }))
    expect(remaining).toEqual({ profiles: [], links: [], aliases: [] })
    expect(
      await t.query(api.publicProfiles.byHandle, { handle: 'old-bee-handle' }),
    ).toBeNull()
    expect(
      await t.query(api.publicProfiles.byHandle, { handle: 'new-bee-handle' }),
    ).toBeNull()
  } finally {
    vi.useRealTimers()
  }
}, 30_000)

test('account erasure removes every subject-keyed integration row and preserves globals', async () => {
  vi.useFakeTimers()
  try {
    const t = convexTest(schema, modules)
    const subject = 'integration_owner'
    const otherSubject = 'integration_other'
    const owner = authenticated(t, subject)

    await t.run(async (ctx) => {
      const accounts = [
        { userId: subject, prefix: 'owner', provider: 'github' as const },
        {
          userId: otherSubject,
          prefix: 'other',
          provider: 'linear' as const,
        },
      ]
      for (const account of accounts) {
        await ctx.db.insert('chatgptAuthSessions', {
          userId: account.userId,
          status: 'starting',
          expiresAt: 10_000,
          attemptCount: 0,
          updatedAt: 1_000,
        })
        await ctx.db.insert('chatgptCredentials', {
          userId: account.userId,
          status: 'needs_reauth',
          updatedAt: 1_000,
        })
        await ctx.db.insert('chatgptGatePreferences', {
          userId: account.userId,
          skippedAt: 900,
          updatedAt: 1_000,
        })
        await ctx.db.insert('googleHealthAuthSessions', {
          userId: account.userId,
          stateHash: `${account.prefix}:google-state`,
          status: 'pending',
          expiresAt: 10_000,
          updatedAt: 1_000,
        })
        await ctx.db.insert('googleHealthCredentials', {
          userId: account.userId,
          status: 'needs_reauth',
          scopes: [],
          updatedAt: 1_000,
        })
        await ctx.db.insert('beennectorAuthSessions', {
          userId: account.userId,
          provider: account.provider,
          stateHash: `${account.prefix}:beennector-state`,
          status: 'pending',
          expiresAt: 10_000,
          updatedAt: 1_000,
        })
        await ctx.db.insert('beennectorCredentials', {
          userId: account.userId,
          provider: account.provider,
          status: 'needs_reauth',
          scopes: [],
          externalAccountId: `${account.prefix}:external-account`,
          updatedAt: 1_000,
        })
        await ctx.db.insert('beennectorDeliveries', {
          userId: account.userId,
          provider: account.provider,
          deliveryId: `${account.prefix}:delivery`,
          receivedAt: 1_000,
          expiresAt: 10_000,
        })
        await ctx.db.insert('powerups', {
          userId: account.userId,
          powerupId: 'google-health',
          enabled: true,
        })
        await ctx.db.insert('wallets', {
          userId: account.userId,
          chain: 'base',
          address: `${account.prefix}:wallet`,
        })
      }

      await ctx.db.insert('posts', {
        id: 'global-post',
        title: 'Global',
        body: 'Not user-owned',
      })
      await ctx.db.insert('revenueCatWebhookEvents', {
        eventId: 'global-revenuecat-receipt',
        type: 'RENEWAL',
        eventTimestampMs: 1_000,
        receivedAt: 1_000,
        outcome: 'applied',
      })
    })

    await prepareAndActivate(t, owner)
    await finishDeletion(t)

    const remaining = await t.run(async (ctx) => ({
      chatgptAuthSessions: await ctx.db.query('chatgptAuthSessions').collect(),
      chatgptCredentials: await ctx.db.query('chatgptCredentials').collect(),
      chatgptGatePreferences: await ctx.db
        .query('chatgptGatePreferences')
        .collect(),
      googleHealthAuthSessions: await ctx.db
        .query('googleHealthAuthSessions')
        .collect(),
      googleHealthCredentials: await ctx.db
        .query('googleHealthCredentials')
        .collect(),
      beennectorAuthSessions: await ctx.db
        .query('beennectorAuthSessions')
        .collect(),
      beennectorCredentials: await ctx.db
        .query('beennectorCredentials')
        .collect(),
      beennectorDeliveries: await ctx.db
        .query('beennectorDeliveries')
        .collect(),
      powerups: await ctx.db.query('powerups').collect(),
      wallets: await ctx.db.query('wallets').collect(),
      posts: await ctx.db.query('posts').collect(),
      revenueCatWebhookEvents: await ctx.db
        .query('revenueCatWebhookEvents')
        .collect(),
    }))
    expect({
      chatgptAuthSessions: remaining.chatgptAuthSessions.map(
        (row) => row.userId,
      ),
      chatgptCredentials: remaining.chatgptCredentials.map((row) => row.userId),
      chatgptGatePreferences: remaining.chatgptGatePreferences.map(
        (row) => row.userId,
      ),
      googleHealthAuthSessions: remaining.googleHealthAuthSessions.map(
        (row) => row.userId,
      ),
      googleHealthCredentials: remaining.googleHealthCredentials.map(
        (row) => row.userId,
      ),
      beennectorAuthSessions: remaining.beennectorAuthSessions.map(
        (row) => row.userId,
      ),
      beennectorCredentials: remaining.beennectorCredentials.map(
        (row) => row.userId,
      ),
      beennectorDeliveries: remaining.beennectorDeliveries.map(
        (row) => row.userId,
      ),
      powerups: remaining.powerups.map((row) => row.userId),
      wallets: remaining.wallets.map((row) => row.userId),
    }).toEqual({
      chatgptAuthSessions: [otherSubject],
      chatgptCredentials: [otherSubject],
      chatgptGatePreferences: [otherSubject],
      googleHealthAuthSessions: [otherSubject],
      googleHealthCredentials: [otherSubject],
      beennectorAuthSessions: [otherSubject],
      beennectorCredentials: [otherSubject],
      beennectorDeliveries: [otherSubject],
      powerups: [otherSubject],
      wallets: [otherSubject],
    })
    expect(remaining.posts.map((row) => row.id)).toEqual(['global-post'])
    expect(remaining.revenueCatWebhookEvents.map((row) => row.eventId)).toEqual(
      ['global-revenuecat-receipt'],
    )
  } finally {
    vi.useRealTimers()
  }
}, 30_000)

test('account erasure resumes in bounded batches and preserves another Clerk subject', async () => {
  vi.useFakeTimers()
  try {
    const t = convexTest(schema, modules)
    const subject = 'delete_owner'
    const otherSubject = 'delete_other'
    const ownerKey = `https://issuer.example.test|${subject}`
    const otherOwnerKey = `https://issuer.example.test|${otherSubject}`
    const owner = authenticated(t, subject)

    await t.run(async (ctx) => {
      for (let index = 0; index < 205; index += 1) {
        await ctx.db.insert('chatPreferences', {
          ownerKey,
          userId: subject,
          activeThreadId: index,
          updatedAt: index,
        })
      }
      await ctx.db.insert('chatPreferences', {
        ownerKey: otherOwnerKey,
        userId: otherSubject,
        activeThreadId: 999,
        updatedAt: 999,
      })

      const ownedGoalId = await ctx.db.insert('goals', {
        userId: subject,
        title: 'Owned goal',
        status: 'active',
      })
      const otherGoalId = await ctx.db.insert('goals', {
        userId: otherSubject,
        title: 'Other account goal',
        status: 'active',
      })
      await ctx.db.insert('golieBees', {
        ownerKey,
        userId: subject,
        goalId: ownedGoalId,
        variant: 'mvp-default',
        status: 'active',
      })
      await ctx.db.insert('golieBees', {
        ownerKey: otherOwnerKey,
        userId: otherSubject,
        goalId: otherGoalId,
        variant: 'mvp-default',
        status: 'active',
      })

      await ctx.db.insert('projects', {
        userId: subject,
        goalId: ownedGoalId,
        title: 'Owned project',
        status: 'active',
      })
      await ctx.db.insert('projects', {
        userId: otherSubject,
        goalId: otherGoalId,
        title: 'Other account project',
        status: 'active',
      })

      for (let index = 0; index < 205; index += 1) {
        await ctx.db.insert('tasks', {
          userId: subject,
          goalId: ownedGoalId,
          title: `Owned task ${index}`,
          status: 'todo',
        })
      }
      await ctx.db.insert('tasks', {
        userId: otherSubject,
        goalId: otherGoalId,
        title: 'Other account task',
        status: 'todo',
      })

      await ctx.db.insert('powerups', {
        userId: subject,
        powerupId: 'google-health',
        enabled: true,
      })
      await ctx.db.insert('powerups', {
        userId: otherSubject,
        powerupId: 'google-health',
        enabled: true,
      })
    })

    const first = await owner.mutation(api.accountDeletion.prepare, {
      confirmation: 'DELETE',
      activationToken: ACTIVATION_TOKEN,
    })
    expect(first.status).toBe('awaiting_identity_deletion')
    const second = await owner.mutation(api.accountDeletion.prepare, {
      confirmation: 'DELETE',
      activationToken: ACTIVATION_TOKEN,
    })
    expect(second).toEqual(first)
    await expect(
      t.mutation(api.accountDeletion.activate, {
        jobId: first.jobId,
        activationToken: ACTIVATION_TOKEN,
      }),
    ).resolves.toEqual({ status: 'scheduled' })

    const activeJobs = await t.run((ctx) =>
      ctx.db.query('accountDeletionJobs').collect(),
    )
    expect(activeJobs).toHaveLength(1)

    await finishDeletion(t)

    const remaining = await t.run(async (ctx) => ({
      chatPreferences: await ctx.db.query('chatPreferences').collect(),
      goals: await ctx.db.query('goals').collect(),
      golieBees: await ctx.db.query('golieBees').collect(),
      projects: await ctx.db.query('projects').collect(),
      tasks: await ctx.db.query('tasks').collect(),
      powerups: await ctx.db.query('powerups').collect(),
      jobs: await ctx.db.query('accountDeletionJobs').collect(),
    }))
    expect(remaining.chatPreferences.map((row) => row.ownerKey)).toEqual([
      otherOwnerKey,
    ])
    expect(remaining.goals.map((row) => row.title)).toEqual([
      'Other account goal',
    ])
    expect(remaining.golieBees.map((row) => row.ownerKey)).toEqual([
      otherOwnerKey,
    ])
    expect(remaining.projects.map((row) => row.userId)).toEqual([otherSubject])
    expect(remaining.tasks.map((row) => row.userId)).toEqual([otherSubject])
    expect(remaining.powerups).toHaveLength(1)
    expect(remaining.powerups[0]?.userId).toBe(otherSubject)
    expect(remaining.jobs).toHaveLength(1)
    expect(remaining.jobs[0]?.status).toBe('tombstoned')
  } finally {
    vi.useRealTimers()
  }
}, 30_000)
