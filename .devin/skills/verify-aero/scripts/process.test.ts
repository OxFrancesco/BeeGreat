import { expect, test } from 'bun:test'
import { runProcess } from './lib'

test('timeout kills descendants holding output pipes open', async () => {
  const result = await runProcess(['/bin/sh', '-c', 'sleep 30 & echo ready; wait'], { timeoutMs: 100 })
  expect(result.timedOut).toBe(true)
  expect(result.stdout).toContain('ready')
  expect(result.durationMs).toBeLessThan(3000)
  expect(result.exitCode).not.toBe(0)
}, 5000)

test('successful command preserves output and exit status', async () => {
  const result = await runProcess(['/bin/sh', '-c', 'echo result; echo diagnostic >&2'], { timeoutMs: 2000 })
  expect(result.timedOut).toBe(false)
  expect(result.exitCode).toBe(0)
  expect(result.stdout.trim()).toBe('result')
  expect(result.stderr.trim()).toBe('diagnostic')
})
