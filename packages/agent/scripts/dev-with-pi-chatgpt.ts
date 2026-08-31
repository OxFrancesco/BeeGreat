import { chmod, mkdir, rename, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { openaiCodexProvider } from '@earendil-works/pi-ai/providers/openai-codex'
import type { JsonValue } from '@flue/runtime'
import lockfile from 'proper-lockfile'
import * as v from 'valibot'

import { jsonValueSchema } from '../src/shared/json.ts'

const PROVIDER = 'openai-codex'
const REFRESH_EARLY_MS = 5 * 60 * 1000
// Keep every local BeeGreat client on the worker's dedicated Vite port.
const AGENT_PORT = 3583
const AUTH_LOCK_STALE_MS = 30_000

/** Pi's own stored OAuth credential shape, as its refresh helper returns it. */
type PiOAuthCredential = Awaited<
  ReturnType<
    NonNullable<ReturnType<typeof openaiCodexProvider>['auth']['oauth']>['refresh']
  >
>

const oauthCredentialSchema = v.looseObject({
  type: v.literal('oauth'),
  access: v.string(),
  refresh: v.string(),
  expires: v.number(),
})

const authFileSchema = v.record(v.string(), jsonValueSchema)

type AuthFile = Record<string, JsonValue | PiOAuthCredential | undefined>

function piAuthPath(): string {
  const home = process.env.HOME
  if (!home) throw new Error('HOME is not set, so Pi credentials cannot be located.')
  const agentDir = process.env.PI_CODING_AGENT_DIR ?? join(home, '.pi', 'agent')
  return join(agentDir, 'auth.json')
}

async function readAuth(path: string): Promise<AuthFile> {
  const file = Bun.file(path)
  if (!(await file.exists())) {
    throw new Error(
      `Pi credentials were not found at ${path}. Run \`pi\`, use \`/login\`, and select OpenAI Codex first.`,
    )
  }

  const value = await file.json()
  if (!v.is(authFileSchema, value)) {
    throw new Error(`Pi's auth file is malformed: ${path}`)
  }
  return value
}

async function writeAuth(path: string, auth: AuthFile): Promise<void> {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 })
  const temporaryPath = `${path}.${process.pid}.${crypto.randomUUID()}.tmp`
  try {
    await writeFile(temporaryPath, `${JSON.stringify(auth, null, 2)}\n`, {
      encoding: 'utf8',
      flag: 'wx',
      mode: 0o600,
    })
    await chmod(temporaryPath, 0o600)
    await rename(temporaryPath, path)
    await chmod(path, 0o600)
  } finally {
    await rm(temporaryPath, { force: true })
  }
}

async function withPiAuthLock<T>(path: string, operation: () => Promise<T>): Promise<T> {
  let compromised: Error | undefined
  const release = await lockfile.lock(path, {
    retries: {
      retries: 10,
      factor: 2,
      minTimeout: 100,
      maxTimeout: 10_000,
      randomize: true,
    },
    stale: AUTH_LOCK_STALE_MS,
    onCompromised: (error) => {
      compromised = error
    },
  })
  try {
    if (compromised) throw compromised
    const result = await operation()
    if (compromised) throw compromised
    return result
  } finally {
    await release().catch(() => undefined)
  }
}

async function currentAccessToken(): Promise<string> {
  const path = piAuthPath()
  let auth = await readAuth(path)
  let credential = auth[PROVIDER]
  if (!v.is(oauthCredentialSchema, credential)) {
    throw new Error(`Pi is not logged into OpenAI Codex. Run \`pi\`, use \`/login\`, and select OpenAI Codex.`)
  }

  if (credential.expires > Date.now() + REFRESH_EARLY_MS) return credential.access

  return withPiAuthLock(path, async () => {
    // Pi may have refreshed the rotating token while this launcher waited.
    auth = await readAuth(path)
    credential = auth[PROVIDER]
    if (!v.is(oauthCredentialSchema, credential)) {
      throw new Error('Pi OpenAI Codex credentials disappeared while waiting for the auth lock.')
    }
    if (credential.expires > Date.now() + REFRESH_EARLY_MS) return credential.access

    console.log('Refreshing Pi ChatGPT subscription credentials…')
    // pi-ai 0.83 moved the refresh helper onto the provider's OAuth method.
    const codexOAuth = openaiCodexProvider().auth.oauth
    if (!codexOAuth) {
      throw new Error('pi-ai no longer exposes the OpenAI Codex OAuth method.')
    }
    const refreshed = await codexOAuth.refresh(credential)
    auth[PROVIDER] = refreshed
    await writeAuth(path, auth)
    return refreshed.access
  })
}

function assertAgentPortAvailable(): void {
  const result = Bun.spawnSync({
    cmd: ['lsof', '-nP', `-iTCP:${AGENT_PORT}`, '-sTCP:LISTEN'],
    stdout: 'pipe',
    stderr: 'pipe',
  })
  if (result.exitCode === 0 && result.stdout.length > 0) {
    throw new Error(
      `Port ${AGENT_PORT} already has a listener. Reuse or stop that BeeGreat agent before starting subscription mode.`,
    )
  }
}

async function main(): Promise<void> {
  assertAgentPortAvailable()
  const accessToken = await currentAccessToken()
  const packageRoot = dirname(dirname(import.meta.path))
  // Flue 2.0's Cloudflare dev runtime reads Worker env from .dev.vars, not
  // from the spawning process env: merge the subscription token in for this
  // run and restore the original file when the dev server exits.
  const devVarsPath = join(packageRoot, '.dev.vars')
  const devVarsFile = Bun.file(devVarsPath)
  const originalDevVars = (await devVarsFile.exists()) ? await devVarsFile.text() : ''
  const withoutToken = originalDevVars
    .split('\n')
    .filter((line) => !line.startsWith('OPENAI_CODEX_ACCESS_TOKEN='))
    .join('\n')
    .replace(/\n*$/, '\n')
  await writeFile(devVarsPath, `${withoutToken}OPENAI_CODEX_ACCESS_TOKEN=${accessToken}\n`)
  try {
    const child = Bun.spawn({
      cmd: ['bun', 'run', 'dev', '--port', String(AGENT_PORT)],
      cwd: packageRoot,
      env: process.env,
      stdin: 'inherit',
      stdout: 'inherit',
      stderr: 'inherit',
    })

    const forward = (signal: NodeJS.Signals) => child.kill(signal)
    process.once('SIGINT', () => forward('SIGINT'))
    process.once('SIGTERM', () => forward('SIGTERM'))
    process.exitCode = await child.exited
  } finally {
    await writeFile(devVarsPath, originalDevVars)
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
