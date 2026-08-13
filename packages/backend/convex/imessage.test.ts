import { convexTest } from 'convex-test'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { api, internal } from './_generated/api'
import {
  imessageAddressKind,
  isValidImessageAddress,
  maskImessageAddress,
  normalizeImessageAddress,
} from './imessageAddress'
import schema from './schema'
import { modules } from './test.setup'

const owner = {
  ownerKey: 'https://issuer.example.test|user_imessage',
  userId: 'user_imessage',
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(Date.parse('2026-10-01T12:00:00Z'))
})

afterEach(() => {
  vi.useRealTimers()
})

describe('iMessage addresses', () => {
  test('normalizes phone formatting and email case', () => {
    expect(normalizeImessageAddress(' +1 (555) 123-4567 ')).toBe('+15551234567')
    expect(normalizeImessageAddress('Someone@iCloud.com')).toBe(
      'someone@icloud.com',
    )
  })

  test('classifies and validates addresses', () => {
    expect(imessageAddressKind('+15551234567')).toBe('phone')
    expect(imessageAddressKind('someone@icloud.com')).toBe('email')
    expect(isValidImessageAddress('+15551234567')).toBe(true)
    expect(isValidImessageAddress('someone@icloud.com')).toBe(true)
    expect(isValidImessageAddress('not an address')).toBe(false)
    expect(isValidImessageAddress('@@')).toBe(false)
  })

  test('masks addresses without exposing them fully', () => {
    expect(maskImessageAddress('+15551234567')).toBe('+1•••4567')
    expect(maskImessageAddress('someone@icloud.com')).toBe(
      'so•••••@icloud.com',
    )
  })
})

describe('iMessage magic-link sessions', () => {
  test('links a pending session to the signed-in user and resolves the sender', async () => {
    const t = convexTest(schema, modules)

    await t.mutation(internal.imessage.createLinkSession, {
      address: '+1 (555) 123-4567',
      tokenHash: 'hash-1',
      expiresAt: Date.now() + 15 * 60 * 1000,
    })

    const linked = await t.mutation(internal.imessage.completeLinkSession, {
      tokenHash: 'hash-1',
      userId: owner.userId,
    })
    expect(linked).toMatchObject({ status: 'linked' })

    await expect(
      t.query(internal.imessage.resolveAddressForBridge, {
        address: '+15551234567',
      }),
    ).resolves.toEqual({ userId: owner.userId })

    const app = t.withIdentity({
      subject: owner.userId,
      tokenIdentifier: owner.ownerKey,
    })
    await expect(app.query(api.imessage.connections, {})).resolves.toEqual([
      {
        address: '+15551234567',
        addressKind: 'phone',
        connectedAt: Date.now(),
      },
    ])
  })

  test('a token is single-use and an expired session cannot link', async () => {
    const t = convexTest(schema, modules)

    await t.mutation(internal.imessage.createLinkSession, {
      address: 'someone@icloud.com',
      tokenHash: 'hash-2',
      expiresAt: Date.now() + 1000,
    })
    await expect(
      t.mutation(internal.imessage.completeLinkSession, {
        tokenHash: 'missing',
        userId: owner.userId,
      }),
    ).resolves.toEqual({ status: 'invalid' })

    vi.setSystemTime(Date.now() + 2000)
    await expect(
      t.mutation(internal.imessage.completeLinkSession, {
        tokenHash: 'hash-2',
        userId: owner.userId,
      }),
    ).resolves.toEqual({ status: 'expired' })

    // Even after time rewinds (clock skew), a settled session never links.
    vi.setSystemTime(Date.now() - 2000)
    await expect(
      t.mutation(internal.imessage.completeLinkSession, {
        tokenHash: 'hash-2',
        userId: owner.userId,
      }),
    ).resolves.toEqual({ status: 'invalid' })
  })

  test('re-linking an address moves it to the new account', async () => {
    const t = convexTest(schema, modules)

    await t.mutation(internal.imessage.createLinkSession, {
      address: '+15551234567',
      tokenHash: 'hash-3',
      expiresAt: Date.now() + 60_000,
    })
    await t.mutation(internal.imessage.completeLinkSession, {
      tokenHash: 'hash-3',
      userId: 'user_first',
    })

    await t.mutation(internal.imessage.createLinkSession, {
      address: '+15551234567',
      tokenHash: 'hash-4',
      expiresAt: Date.now() + 60_000,
    })
    await t.mutation(internal.imessage.completeLinkSession, {
      tokenHash: 'hash-4',
      userId: 'user_second',
    })

    await expect(
      t.query(internal.imessage.resolveAddressForBridge, {
        address: '+15551234567',
      }),
    ).resolves.toEqual({ userId: 'user_second' })
  })

  test('rate-limits link sessions per address', async () => {
    const t = convexTest(schema, modules)
    for (let attempt = 0; attempt < 5; attempt++) {
      await t.mutation(internal.imessage.createLinkSession, {
        address: '+15551234567',
        tokenHash: `hash-burst-${attempt}`,
        expiresAt: Date.now() + 60_000,
      })
      vi.setSystemTime(Date.now() + 1000)
    }
    await expect(
      t.mutation(internal.imessage.createLinkSession, {
        address: '+15551234567',
        tokenHash: 'hash-burst-overflow',
        expiresAt: Date.now() + 60_000,
      }),
    ).rejects.toThrow()

    // A different address is unaffected.
    await expect(
      t.mutation(internal.imessage.createLinkSession, {
        address: '+15559876543',
        tokenHash: 'hash-other',
        expiresAt: Date.now() + 60_000,
      }),
    ).resolves.toEqual({ created: true })
  })

  test('rejects invalid sender addresses', async () => {
    const t = convexTest(schema, modules)
    await expect(
      t.mutation(internal.imessage.createLinkSession, {
        address: 'not an address',
        tokenHash: 'hash-invalid',
        expiresAt: Date.now() + 60_000,
      }),
    ).rejects.toThrow()
  })
})

describe('iMessage reverse states', () => {
  async function linkAddress(
    t: ReturnType<typeof convexTest>,
    address: string,
    userId: string,
    tokenHash: string,
  ) {
    await t.mutation(internal.imessage.createLinkSession, {
      address,
      tokenHash,
      expiresAt: Date.now() + 60_000,
    })
    await t.mutation(internal.imessage.completeLinkSession, {
      tokenHash,
      userId,
    })
  }

  test('the signed-in user can disconnect only their own address', async () => {
    const t = convexTest(schema, modules)
    await linkAddress(t, '+15551234567', owner.userId, 'hash-own')
    await linkAddress(t, '+15559876543', 'user_other', 'hash-other')

    const app = t.withIdentity({
      subject: owner.userId,
      tokenIdentifier: owner.ownerKey,
    })
    await expect(
      app.mutation(api.imessage.disconnect, { address: '+15559876543' }),
    ).resolves.toEqual({ disconnected: false })
    await expect(
      app.mutation(api.imessage.disconnect, { address: '+15551234567' }),
    ).resolves.toEqual({ disconnected: true })
    await expect(app.query(api.imessage.connections, {})).resolves.toEqual([])
  })

  test('the bridge /unlink removes exactly the sending address', async () => {
    const t = convexTest(schema, modules)
    await linkAddress(t, 'someone@icloud.com', owner.userId, 'hash-email')

    await expect(
      t.mutation(internal.imessage.disconnectAddressForBridge, {
        address: 'Someone@iCloud.com',
      }),
    ).resolves.toEqual({ disconnected: true })
    await expect(
      t.query(internal.imessage.resolveAddressForBridge, {
        address: 'someone@icloud.com',
      }),
    ).resolves.toBeNull()
  })

  test('the CLI can list and disconnect every linked address', async () => {
    const t = convexTest(schema, modules)
    await linkAddress(t, '+15551234567', owner.userId, 'hash-cli-1')
    await linkAddress(t, 'someone@icloud.com', owner.userId, 'hash-cli-2')

    const status = await t.query(internal.imessage.connectionsForAgent, {
      userId: owner.userId,
    })
    expect(status).toHaveLength(2)

    await expect(
      t.mutation(internal.imessage.disconnectForAgent, {
        userId: owner.userId,
      }),
    ).resolves.toEqual({ disconnected: 2 })
    await expect(
      t.query(internal.imessage.connectionsForAgent, {
        userId: owner.userId,
      }),
    ).resolves.toEqual([])
  })
})
