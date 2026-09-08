import { expect, test } from 'bun:test'
import { startOAuthCallback } from './callback-server'

test('an unrelated local request cannot terminate an ongoing login', async () => {
  const callback = startOAuthCallback('expected-state')
  try {
    expect((await fetch(`${callback.redirectUri}?state=wrong&code=wrong`)).status).toBe(400)
    expect((await fetch(`${callback.redirectUri}?state=expected-state&code=valid`)).status).toBe(200)
    await expect(callback.result).resolves.toMatchObject({ code: 'valid' })
  } finally { callback.cancel() }
})
