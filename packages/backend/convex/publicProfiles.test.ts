import { makeFunctionReference } from 'convex/server'
import { convexTest } from 'convex-test'
import { describe, expect, test } from 'vitest'
import schema from './schema'
import { modules } from './test.setup'

type Provider =
  | 'instagram'
  | 'linkedin'
  | 'x'
  | 'github'
  | 'youtube'
  | 'tiktok'
  | 'facebook'
  | 'website'
  | 'other'

type Profile = {
  handle: string
  displayName: string
  bio: string | null
  avatarUrl: string | null
  published: boolean
  profileUrl: string
  qrUrl: string
  links: { provider: Provider; label: string; url: string }[]
  updatedAt: number
}

const publicProfiles = {
  mine: makeFunctionReference<'query', Record<string, never>, Profile | null>(
    'publicProfiles:mine',
  ),
  ensureMine: makeFunctionReference<
    'mutation',
    { displayName: string; suggestedHandle?: string; avatarUrl?: string },
    Profile
  >('publicProfiles:ensureMine'),
  saveMine: makeFunctionReference<
    'mutation',
    {
      handle: string
      displayName: string
      bio?: string
      avatarUrl?: string
      published: boolean
      links: { provider: Provider; label: string; url: string }[]
    },
    Profile
  >('publicProfiles:saveMine'),
  byHandle: makeFunctionReference<
    'query',
    { handle: string },
    Profile | null
  >('publicProfiles:byHandle'),
  byPublicId: makeFunctionReference<
    'query',
    { publicId: string },
    Profile | null
  >('publicProfiles:byPublicId'),
}

function identity(subject: string, issuer = 'https://issuer.example.test') {
  return { subject, tokenIdentifier: `${issuer}|${subject}` }
}

function publicId(profile: Profile) {
  return profile.qrUrl.split('/').at(-1)!
}

describe('public profiles', () => {
  test('creates a private profile with a permanent QR destination', async () => {
    const t = convexTest(schema, modules)
    const owner = t.withIdentity(identity('profile-owner'))
    const created = await owner.mutation(publicProfiles.ensureMine, {
      displayName: 'Francesco Oddo',
      suggestedHandle: '@Francesco Oddo',
      avatarUrl: 'https://images.example.test/avatar.png',
    })

    expect(created).toMatchObject({
      handle: 'francesco-oddo',
      displayName: 'Francesco Oddo',
      published: false,
      profileUrl: 'https://bee.buddytools.org/@francesco-oddo',
      links: [],
    })
    expect(created.qrUrl).toMatch(
      /^https:\/\/bee\.buddytools\.org\/p\/[a-f0-9]{32}$/,
    )
    expect(await t.query(publicProfiles.byHandle, { handle: created.handle })).toBeNull()
    expect(
      await t.query(publicProfiles.byPublicId, { publicId: publicId(created) }),
    ).toBeNull()
    expect(await owner.query(publicProfiles.mine, {})).toEqual(created)
  })

  test('publishes only allowlisted fields and preserves the QR across edits', async () => {
    const t = convexTest(schema, modules)
    const owner = t.withIdentity(identity('published-owner'))
    const created = await owner.mutation(publicProfiles.ensureMine, {
      displayName: 'Maya Bee',
      suggestedHandle: 'maya',
    })
    const published = await owner.mutation(publicProfiles.saveMine, {
      handle: 'maya',
      displayName: 'Maya Bee',
      bio: 'Designer, maker, and beekeeper.',
      published: true,
      links: [
        {
          provider: 'github',
          label: 'GitHub',
          url: 'https://github.com/maya#profile',
        },
      ],
    })

    expect(published.qrUrl).toBe(created.qrUrl)
    expect(published.links).toEqual([
      { provider: 'github', label: 'GitHub', url: 'https://github.com/maya' },
    ])
    expect(await t.query(publicProfiles.byHandle, { handle: '@MAYA' })).toEqual(
      published,
    )
    expect(
      await t.query(publicProfiles.byPublicId, { publicId: publicId(created) }),
    ).toEqual(published)
    expect(JSON.stringify(published)).not.toContain('published-owner')
    expect(JSON.stringify(published)).not.toContain('issuer.example.test')
  })

  test('keeps previous handles working and prevents another user taking them', async () => {
    const t = convexTest(schema, modules)
    const owner = t.withIdentity(identity('rename-owner'))
    const other = t.withIdentity(identity('other-owner'))
    await owner.mutation(publicProfiles.ensureMine, {
      displayName: 'Renamed Bee',
      suggestedHandle: 'first-handle',
    })
    const renamed = await owner.mutation(publicProfiles.saveMine, {
      handle: 'new-handle',
      displayName: 'Renamed Bee',
      published: true,
      links: [],
    })

    expect(
      await t.query(publicProfiles.byHandle, { handle: 'first-handle' }),
    ).toEqual(renamed)
    await other.mutation(publicProfiles.ensureMine, {
      displayName: 'Other Bee',
      suggestedHandle: 'other-bee',
    })
    await expect(
      other.mutation(publicProfiles.saveMine, {
        handle: 'first-handle',
        displayName: 'Other Bee',
        published: true,
        links: [],
      }),
    ).rejects.toThrow('already taken')
  })

  test('allocates unique suggested handles and rejects unsafe links', async () => {
    const t = convexTest(schema, modules)
    const first = t.withIdentity(identity('first-owner'))
    const second = t.withIdentity(identity('second-owner'))
    const firstProfile = await first.mutation(publicProfiles.ensureMine, {
      displayName: 'Same Name',
      suggestedHandle: 'same-name',
    })
    const secondProfile = await second.mutation(publicProfiles.ensureMine, {
      displayName: 'Same Name',
      suggestedHandle: 'same-name',
    })

    expect(firstProfile.handle).toBe('same-name')
    expect(secondProfile.handle).toBe('same-name-2')
    await expect(
      first.mutation(publicProfiles.saveMine, {
        handle: firstProfile.handle,
        displayName: firstProfile.displayName,
        published: true,
        links: [
          { provider: 'website', label: 'Unsafe', url: 'javascript:alert(1)' },
        ],
      }),
    ).rejects.toThrow('valid HTTPS URL')
  })
})
