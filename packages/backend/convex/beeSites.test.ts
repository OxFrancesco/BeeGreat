import { convexTest } from 'convex-test'
import { expect, test } from 'vitest'
import { api, internal } from './_generated/api'
import schema from './schema'
import { modules } from './test.setup'

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

test('a signed-in free user can reserve one Bee Site slug', async () => {
  const t = convexTest(schema, modules)
  const owner = authenticated(t, 'sites_owner')

  const created = await owner.mutation(api.beeSites.create, {
    title: 'Oddo Studio',
    suggestedSlug: 'Oddo Studio',
  })

  expect(created).toMatchObject({
    title: 'Oddo Studio',
    slug: 'oddo-studio',
    status: 'draft',
    pageCount: 0,
    publicUrl: 'https://sites.buddytools.org/oddo-studio',
  })
  expect(created.limits).toEqual({
    tier: 'free',
    sites: 1,
    pagesPerSite: 5,
    generationsPerMonth: 15,
    publishesPerMonth: 20,
  })

  await expect(
    owner.mutation(api.beeSites.create, {
      title: 'Second site',
      suggestedSlug: 'second-site',
    }),
  ).rejects.toThrow('Free accounts can publish one Bee Site')
})

test('Bee Site slugs stay globally unique without exposing another owner', async () => {
  const t = convexTest(schema, modules)
  const first = authenticated(t, 'first_sites_owner')
  const second = authenticated(t, 'second_sites_owner')

  await first.mutation(api.beeSites.create, {
    title: 'Shared name',
    suggestedSlug: 'shared-name',
  })
  const created = await second.mutation(api.beeSites.create, {
    title: 'Shared name',
    suggestedSlug: 'shared-name',
  })

  expect(created.slug).toBe('shared-name-2')
  expect(await second.query(api.beeSites.listMine, {})).toMatchObject({
    sites: [{ slug: 'shared-name-2' }],
  })
})

test('a current Pro entitlement raises the site and page allowances', async () => {
  const t = convexTest(schema, modules)
  const userId = 'pro_sites_owner'
  const owner = authenticated(t, userId)
  const now = Date.now()
  await t.run(async (ctx) => {
    await ctx.db.insert('subscriptionEntitlements', {
      userId,
      entitlementId: 'pro',
      productId: 'com.beegreat.app.pro.monthly',
      environment: 'PRODUCTION',
      active: true,
      expiresAt: now + 30 * 24 * 60 * 60 * 1_000,
      latestEventId: 'pro-sites-test',
      latestEventType: 'INITIAL_PURCHASE',
      latestEventTimestampMs: now,
      updatedAt: now,
    })
  })

  for (let index = 1; index <= 5; index += 1) {
    const created = await owner.mutation(api.beeSites.create, {
      title: `Pro site ${index}`,
      suggestedSlug: `pro-site-${index}`,
    })
    expect(created.limits).toEqual({
      tier: 'pro',
      sites: 5,
      pagesPerSite: 25,
      generationsPerMonth: 100,
      publishesPerMonth: 200,
    })
  }

  await expect(
    owner.mutation(api.beeSites.create, {
      title: 'Sixth site',
      suggestedSlug: 'sixth-site',
    }),
  ).rejects.toThrow('Pro accounts can publish up to 5 Bee Sites')
})

test('only the owner can edit or unpublish a Bee Site', async () => {
  const t = convexTest(schema, modules)
  const owner = authenticated(t, 'editable_sites_owner')
  const stranger = authenticated(t, 'stranger_sites_owner')
  const created = await owner.mutation(api.beeSites.create, {
    title: 'Original title',
    suggestedSlug: 'original-site',
  })

  await expect(
    stranger.mutation(api.beeSites.save, {
      siteId: created.siteId,
      title: 'Stolen site',
      slug: 'stolen-site',
    }),
  ).rejects.toThrow("You can't manage another user's Bee Site")

  const saved = await owner.mutation(api.beeSites.save, {
    siteId: created.siteId,
    title: 'New title',
    description: 'A small public studio.',
    slug: 'new-site',
  })
  expect(saved).toMatchObject({
    title: 'New title',
    description: 'A small public studio.',
    slug: 'new-site',
  })

  await expect(
    owner.mutation(api.beeSites.unpublish, { siteId: created.siteId }),
  ).resolves.toMatchObject({ status: 'unpublished' })
})

test('the Astro Creator broker meters generations and validates deployment size', async () => {
  const t = convexTest(schema, modules)
  const userId = 'creator_sites_owner'

  let prepared: Awaited<
    ReturnType<
      typeof t.mutation<typeof internal.beeSites.prepareForAgent>
    >
  > | null = null
  for (let index = 0; index < 15; index += 1) {
    prepared = await t.mutation(internal.beeSites.prepareForAgent, {
      userId,
      title: 'Creator site',
      suggestedSlug: 'creator-site',
    })
  }
  expect(prepared).toMatchObject({
    slug: 'creator-site',
    generationRemaining: 0,
  })
  await expect(
    t.mutation(internal.beeSites.prepareForAgent, {
      userId,
      title: 'Creator site',
      suggestedSlug: 'creator-site',
    }),
  ).rejects.toThrow('Monthly Bee Site generation limit reached')

  await expect(
    t.mutation(internal.beeSites.beginDeployment, {
      userId,
      siteId: prepared!.siteId,
      version: 'too-many-pages',
      kind: 'production',
      pageCount: 6,
      fileCount: 12,
      totalBytes: 50_000,
    }),
  ).rejects.toThrow('Free Bee Sites can contain up to 5 pages')

  const previewVersion = 'a'.repeat(32)
  const preview = await t.mutation(internal.beeSites.beginDeployment, {
    userId,
    siteId: prepared!.siteId,
    version: previewVersion,
    kind: 'preview',
    pageCount: 2,
    fileCount: 4,
    totalBytes: 50_000,
  })
  const previewPrefix = `users/${userId}/sites/${prepared!.siteId}/deployments/${previewVersion}/`
  await t.mutation(internal.beeSites.completeDeployment, {
    userId,
    deploymentId: preview.deploymentId,
    manifestKey: previewPrefix,
  })
  await expect(
    t.query(api.beeSites.publicPreviewByVersion, { version: previewVersion }),
  ).resolves.toEqual({ assetPrefix: previewPrefix })
  await t.run((ctx) =>
    ctx.db.patch('beeSiteDeployments', preview.deploymentId, {
      expiresAt: Date.now() - 1,
    }),
  )
  await expect(
    t.query(api.beeSites.publicPreviewByVersion, { version: previewVersion }),
  ).resolves.toBeNull()
  await expect(
    t.query(api.beeSites.publicBySlug, { slug: 'creator-site' }),
  ).resolves.toBeNull()

  const deployment = await t.mutation(internal.beeSites.beginDeployment, {
    userId,
    siteId: prepared!.siteId,
    version: 'version-1',
    kind: 'production',
    pageCount: 2,
    fileCount: 4,
    totalBytes: 50_000,
  })
  await expect(
    t.mutation(internal.beeSites.completeDeployment, {
      userId,
      deploymentId: deployment.deploymentId,
      manifestKey: `users/${userId}/sites/${prepared!.siteId}/deployments/version-1/`,
    }),
  ).resolves.toMatchObject({
    status: 'published',
    pageCount: 2,
    publicUrl: 'https://sites.buddytools.org/creator-site',
  })
})
