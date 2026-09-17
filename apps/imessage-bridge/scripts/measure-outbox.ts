// Local wall-clock comparison. HTTP and Spectrum are fixture boundaries;
// this never connects to Convex, the worker, or a real iMessage recipient.
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { createAgentTransport } from '../src/agent-transport'
import { startTerminalDeliveryPolling } from '../src/outbox'

const root = resolve(import.meta.dir, '../../..')
const revision = Bun.spawn(['git', 'rev-parse', process.env.BASELINE_REVISION ?? 'HEAD'], { cwd: root, stdout: 'pipe' })
const baselineRevision = (await new Response(revision.stdout).text()).trim()
if (await revision.exited) throw new Error('Cannot resolve baseline revision')
const source = Bun.spawn(['git', 'show', `${baselineRevision}:apps/imessage-bridge/src/outbox.ts`], { cwd: root, stdout: 'pipe' })
const original = await new Response(source.stdout).text()
if (await source.exited) throw new Error('Cannot read baseline')
if (!original.includes('setInterval')) throw new Error('Baseline must be the fixed-interval implementation')
const directory = await mkdtemp(join(tmpdir(), 'beegreat-outbox-'))
const baselinePath = join(directory, 'baseline.ts')
await Bun.write(baselinePath, original.replace(/from '([^']+)'/g, (_match, specifier: string) => {
  return `from '${Bun.resolveSync(specifier, resolve(root, 'apps/imessage-bridge/src'))}'`
}))
const baseline = await import(baselinePath)
const started = performance.now()
const windowMs = 120_000
const events: { mode: string; action: string; elapsedMs: number }[] = []
const deliveries: { mode: string; latencyMs: number }[] = []
const pending = new Set<string>()
let enqueuedAt = 0
const realFetch = globalThis.fetch
const fixtureFetch: typeof fetch = Object.assign(async (input: string | URL | Request, init?: RequestInit) => {
  const url = new URL(input instanceof Request ? input.url : input)
  if (!url.hostname.endsWith('.example.test')) throw new Error('Fixture disallows external requests')
  const mode = url.hostname.split('.')[0]!
  const body = JSON.parse(String(init?.body))
  events.push({ mode, action: body.action, elapsedMs: Math.round(performance.now() - started) })
  if (body.action !== 'claim_delivery') return Response.json({ ok: true })
  if (!pending.delete(mode)) return Response.json(null)
  return Response.json({ deliveryId: mode, leaseId: body.leaseId, address: 'outbox-fixture@example.test',
    action: { summary: 'Non-financial delivery fixture', kind: 'execute_plan', status: 'expired' } })
}, { preconnect: realFetch.preconnect })
globalThis.fetch = fixtureFetch
function transport(mode: string) {
  return createAgentTransport({ agentUrl: `https://${mode}.example.test`, bridgeSecret: 'fixture-only' })
}
function openDm(mode: string) {
  return async (address: string) => {
    if (address !== 'outbox-fixture@example.test') throw new Error('Not a fixture recipient')
    return { send: async () => { deliveries.push({ mode, latencyMs: Math.round(performance.now() - enqueuedAt) }) } }
  }
}
const oldTimer = baseline.startTerminalDeliveryPolling(transport('before'), openDm('before'))
const updated = startTerminalDeliveryPolling(transport('after'), openDm('after'))
try {
  await Bun.sleep(windowMs)
  const idleCounts = Object.fromEntries(['before', 'after'].map(mode => [mode,
    events.filter(event => event.mode === mode && event.action === 'claim_delivery' && event.elapsedMs < windowMs).length,
  ]))
  enqueuedAt = performance.now()
  pending.add('before')
  pending.add('after')
  const deadline = enqueuedAt + 65_000
  while (deliveries.length < 2 && performance.now() < deadline) await Bun.sleep(50)
  if (deliveries.length !== 2) throw new Error('Fixture delivery timed out')
  const result = { at: new Date().toISOString(), baselineRevision, windowMs, idleCounts, deliveries, events,
    boundary: 'Real wall-clock bridge code; intercepted HTTP and Spectrum fixture. No production requests or billing measurement.' }
  const output = process.argv[2] ?? '/private/tmp/beegreat-outbox-measurement.json'
  await Bun.write(output, JSON.stringify(result, null, 2) + '\n')
  console.log(JSON.stringify({ output, windowMs, idleCounts, deliveries }))
} finally {
  clearInterval(oldTimer)
  await updated.stop()
  globalThis.fetch = realFetch
  await rm(directory, { recursive: true })
}
