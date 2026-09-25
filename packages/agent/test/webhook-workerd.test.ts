import { expect, test } from 'bun:test'
import { fileURLToPath } from 'node:url'

test('the Worker starts with optional webhooks unset and verifies configured signatures', async () => {
  const listener = Bun.listen({ hostname: '127.0.0.1', port: 0, socket: { data() {} } })
  const port = listener.port
  listener.stop(true)
  const wrangler = fileURLToPath(new URL('./bin/wrangler.js', import.meta.resolve('wrangler/package.json')))
  const child = Bun.spawn({
    cmd: ['node', wrangler, 'dev', '--config', 'test/fixtures/wrangler.webhook.jsonc', '--local', '--ip', '127.0.0.1', '--port', String(port), '--show-interactive-dev-session=false'],
    env: { ...process.env, WRANGLER_SEND_METRICS: 'false', WRANGLER_WRITE_LOGS: 'false', WRANGLER_REGISTRY_PATH: `/tmp/bee-webhook-test-${process.pid}` },
    stdout: 'pipe', stderr: 'pipe',
  })
  const logs = new Response(child.stdout).text(), errors = new Response(child.stderr).text()
  const origin = `http://127.0.0.1:${port}`
  try {
    let health: Response | undefined
    for (const deadline = Date.now() + 25000; Date.now() < deadline;) {
      try { health = await fetch(`${origin}/health`, { signal: AbortSignal.timeout(3000) }); break }
      catch { if (child.exitCode !== null) break; await Bun.sleep(100) }
    }
    if (!health) throw new Error('Worker did not start')
    expect(health.status).toBe(200)
    for (const provider of ['linear', 'notion']) {
      expect((await fetch(`${origin}/channels/${provider}/webhook`, { method: 'POST' })).status).toBe(503)
    }
    const body = JSON.stringify({ zen: 'Keep signatures exact.' })
    const headers = { 'content-type': 'application/json', 'x-github-event': 'ping', 'x-github-delivery': 'startup-test' }
    expect((await fetch(`${origin}/channels/github/webhook`, { method: 'POST', headers, body })).status).toBe(401)
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode('worker-test-secret'), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
    const signature = Buffer.from(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body))).toString('hex')
    expect((await fetch(`${origin}/channels/github/webhook`, { method: 'POST', headers: { ...headers, 'x-hub-signature-256': `sha256=${signature}` }, body })).status).toBe(200)
  } catch (cause) {
    child.kill(); await child.exited
    throw new Error(`${await logs}\n${await errors}`, { cause })
  } finally {
    if (child.exitCode === null) child.kill()
    await child.exited
  }
}, 40000)
