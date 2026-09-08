import { expect, test } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createCredentialStore } from './credential-store'

test('credentials use the native secret store without subprocess arguments', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'bee-secrets-'))
  let value: string | null = null
  const store = createCredentialStore({
    account: 'test-owner', fallbackPath: join(directory, 'credentials.json'),
    secrets: {
      get: async () => value,
      set: async options => { value = options.value },
      delete: async () => { value = null; return true },
    },
  })
  try {
    const credential = { accessToken: 'fixture-access', refreshToken: 'fixture-refresh', expiresAt: 1000, userId: 'owner' }
    await store.save(credential)
    expect(await store.load()).toEqual(credential)
    await store.clear()
    expect(await store.load()).toBeUndefined()
  } finally { await rm(directory, { recursive: true, force: true }) }
})
