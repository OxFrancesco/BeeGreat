import { chmod, mkdir, rename, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { parseEnv } from 'node:util'
import { refreshOpenAICodexToken } from '@earendil-works/pi-ai/oauth'
import lockfile from 'proper-lockfile'

const PROVIDER = 'openai-codex'
const REFRESH_EARLY_MS = 5 * 60 * 1000
// Flue 2.0 dev is `vite dev`; keep the spawned worker on Vite's default port.
const AGENT_PORT = 5173
const AUTH_LOCK_STALE_MS = 30_000

interface OAuthCredential {
  type: 'oauth'
  access: string
  refresh: string
  expires: number
  accountId?: string
}

type AuthFile = Record<string, OAuthCredential | Record<string, unknown>>

function piAuthPath(): string {
  const home = process.env.HOME
  if (!home) throw new Error('HOME is not set, so Pi credentials cannot be located.')
  const agentDir = process.env.PI_CODING_AGENT_DIR ?? join(home, '.pi', 'agent')
  return join(agentDir, 'auth.json')
}

function isOAuthCredential(value: unknown): value is OAuthCredential {
  if (typeof value !== 'object' || value === null) return false
  const credential = value as Partial<OAuthCredential>
  return (
    credential.type === 'oauth' &&
    typeof credential.access === 'string' &&
    typeof credential.refresh === 'string' &&
    typeof credential.expires === 'number'
  )
}

async function readAuth(path: string): Promise<AuthFile> {
  const file = Bun.file(path)
  if (!(await file.exists())) {
    throw new Error(
      `Pi credentials were not found at ${path}. Run \`pi\`, use \`/login\`, and select OpenAI Codex first.`,
    )
  }

  const value = (await file.json()) as unknown
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`Pi's auth file is malformed: ${path}`)
  }
  return value as AuthFile
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
  if (!isOAuthCredential(credential)) {
    throw new Error(
      `Pi is not logged into OpenAI Codex. Run \`pi\`, use \`/login\`, and select OpenAI Codex.`,
    )
  }

  if (credential.expires > Date.now() + REFRESH_EARLY_MS) return credential.access

  return withPiAuthLock(path, async () => {
    // Pi may have refreshed the rotating token while this launcher waited.
    auth = await readAuth(path)
    credential = auth[PROVIDER]
    if (!isOAuthCredential(credential)) {
      throw new Error('Pi OpenAI Codex credentials disappeared while waiting for the auth lock.')
    }
    if (credential.expires > Date.now() + REFRESH_EARLY_MS) return credential.access

    console.log('Refreshing Pi ChatGPT subscription credentials…')
    const refreshed = await refreshOpenAICodexToken(credential.refresh)
    auth[PROVIDER] = { type: 'oauth', ...refreshed }
    await writeAuth(path, auth)
    return refreshed.access
  })
}

async function localAgentEnvironment(packageRoot: string): Promise<Record<string, string>> {
  const file = Bun.file(join(packageRoot, '.dev.vars'))
  return (await file.exists()) ? parseEnv(await file.text()) : {}
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
  const localEnv = await localAgentEnvironment(packageRoot)
  const child = Bun.spawn({
    cmd: ['bun', 'run', 'dev', '--port', String(AGENT_PORT)],
    cwd: packageRoot,
    env: {
      ...localEnv,
      ...process.env,
      OPENAI_CODEX_ACCESS_TOKEN: accessToken,
    },
    stdin: 'inherit',
    stdout: 'inherit',
    stderr: 'inherit',
  })

  const forward = (signal: NodeJS.Signals) => child.kill(signal)
  process.once('SIGINT', () => forward('SIGINT'))
  process.once('SIGTERM', () => forward('SIGTERM'))
  process.exitCode = await child.exited
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
