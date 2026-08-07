import { cp, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawn } from 'node:child_process'

const functionDir = new URL('../.vercel/output/functions/__server.func/', import.meta.url)

if (process.env.NITRO_PRESET !== 'vercel' && !process.env.VERCEL) {
  console.log('Skipping isolated Vercel artifact check outside a Vercel build.')
  process.exit(0)
}

const sandbox = await mkdtemp(join(tmpdir(), 'beegreat-vercel-artifact-'))
const isolatedFunctionDir = join(sandbox, '__server.func')

try {
  await cp(functionDir, isolatedFunctionDir, { recursive: true })

  const probe = [
    "const mod = await import('./__server.func/index.mjs')",
    "const response = await mod.default.fetch(new Request('http://localhost/'), {})",
    'if (response.status >= 500) {',
    "  console.error(`Vercel artifact returned ${response.status}: ${(await response.text()).slice(0, 500)}`)",
    '  process.exit(1)',
    '}',
    "console.log(`Vercel artifact responded with ${response.status}.`)",
  ].join(';')

  const child = spawn('node', ['--input-type=module', '--eval', probe], {
    cwd: sandbox,
    stdio: 'inherit',
  })

  const exitCode = await new Promise((resolve, reject) => {
    child.once('error', reject)
    child.once('exit', (code) => resolve(code ?? 1))
  })

  if (exitCode !== 0) {
    throw new Error(`Isolated Vercel artifact check failed with exit code ${exitCode}.`)
  }
} finally {
  await rm(sandbox, { recursive: true, force: true })
}
