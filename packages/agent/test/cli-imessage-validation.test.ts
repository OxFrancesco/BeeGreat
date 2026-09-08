import { expect, test } from 'bun:test'
import { Hono } from 'hono'
import { registerCliRoutes } from '../src/routes/cli'
import type { AppEnvironment } from '../src/app-env'

test('invalid supplied address fails before broker while absence is an explicit valid operation', async () => {
  const app = new Hono<AppEnvironment>()
  app.use('*', async (c, next) => { c.set('authKind', 'clerk'); c.set('userId', 'user_fixture'); await next() })
  registerCliRoutes(app)
  for (const address of [null, 42, '', '  ', 'invalid']) {
    const response = await app.request('/cli/imessage', { method: 'POST', body: JSON.stringify({ action: 'disconnect', address }), headers: { 'content-type': 'application/json' } }, {})
    expect(response.status).toBe(400)
  }
  for (const input of [{ action: 'disconnect' }, { action: 'disconnect', address: '+15551234567' }]) {
    const response = await app.request('/cli/imessage', { method: 'POST', body: JSON.stringify(input), headers: { 'content-type': 'application/json' } }, {})
    expect(response.status).toBe(503)
  }
})
