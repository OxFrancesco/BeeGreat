import { afterEach, expect, test } from 'bun:test'
import { Hono } from 'hono'
import { authGate } from '../src/middleware/auth'
import type { AppEnvironment } from '../src/app-env'
import { channelSecret } from '../src/shared/beennectors/channel'

const secretNames = ['GITHUB_WEBHOOK_SECRET', 'LINEAR_WEBHOOK_SECRET', 'NOTION_VERIFICATION_TOKEN'] as const
const original = secretNames.map(name => process.env[name])
afterEach(() => secretNames.forEach((name, i) => { if (original[i] === undefined) delete process.env[name]; else process.env[name] = original[i] }))

test('unconfigured webhook routes fail before provider signature handling', async () => {
  for (const name of secretNames) delete process.env[name]
  const app = new Hono<AppEnvironment>()
  app.use('*', authGate)
  app.post('/channels/:provider/webhook', c => c.json({ reachedProvider: true }))
  for (const provider of ['github', 'linear', 'notion']) {
    const response = await app.request(`/channels/${provider}/webhook`, { method: 'POST' }, {})
    expect(response.status).toBe(503)
    expect(await response.text()).not.toContain('reachedProvider')
  }
  expect(channelSecret('GITHUB_WEBHOOK_SECRET')).not.toBe('unconfigured-github_webhook_secret')
  expect(channelSecret('GITHUB_WEBHOOK_SECRET')).not.toBe(channelSecret('GITHUB_WEBHOOK_SECRET'))
  process.env.GITHUB_WEBHOOK_SECRET = 'configured-test-secret'
  expect((await app.request('/channels/github/webhook', { method: 'POST' }, {})).status).toBe(200)
})
