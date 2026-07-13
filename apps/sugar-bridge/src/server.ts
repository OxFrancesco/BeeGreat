import { timingSafeEqual } from 'node:crypto'
import {
  SUGAR_ACTIONS,
  buildSugarArgv,
  validateSugarRequest,
  type SugarAction,
} from '@beegreat/sugar'

const MAX_OUTPUT_BYTES = 900_000
const DEFAULT_TIMEOUT_MS = 120_000

type BridgeOptions = {
  executable: string
  secret: string
  timeoutMs: number
}

type Executor = (argv: string[], timeoutMs: number) => Promise<string>

function safeCliError(stderr: string, exitCode: number) {
  const sanitized = stderr
    .trim()
    .replace(/https?:\/\/\S+/gi, '[redacted URL]')
    .replace(/Bearer\s+\S+/gi, 'Bearer [redacted]')
  return sanitized.slice(-2_000) || `Sugar exited with status ${exitCode}`
}

function isAuthorized(header: string | null, expectedSecret: string) {
  const supplied = header?.startsWith('Bearer ') ? header.slice(7) : ''
  const actualBytes = Buffer.from(supplied)
  const expectedBytes = Buffer.from(expectedSecret)
  return (
    actualBytes.length === expectedBytes.length &&
    expectedBytes.length > 0 &&
    timingSafeEqual(actualBytes, expectedBytes)
  )
}

async function defaultExecutor(argv: string[], timeoutMs: number) {
  const child = Bun.spawn(argv, {
    stdout: 'pipe',
    stderr: 'pipe',
    env: process.env,
  })
  const timeout = setTimeout(() => child.kill(), timeoutMs)
  try {
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(child.stdout).arrayBuffer(),
      new Response(child.stderr).text(),
      child.exited,
    ])
    if (stdout.byteLength > MAX_OUTPUT_BYTES) {
      throw new Error(
        'Sugar output exceeded the bridge response limit; narrow the query',
      )
    }
    if (exitCode !== 0) {
      throw new Error(safeCliError(stderr, exitCode))
    }
    return new TextDecoder().decode(stdout).trim()
  } finally {
    clearTimeout(timeout)
  }
}

export function createSugarBridge(
  options: BridgeOptions,
  execute: Executor = defaultExecutor,
) {
  return async (request: Request) => {
    const url = new URL(request.url)
    if (request.method === 'GET' && url.pathname === '/health') {
      return Response.json({ ok: true, actions: SUGAR_ACTIONS })
    }
    if (request.method !== 'POST' || url.pathname !== '/v1/execute') {
      return Response.json({ error: 'Not found' }, { status: 404 })
    }
    if (!isAuthorized(request.headers.get('authorization'), options.secret)) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
      const body = (await request.json()) as {
        action?: unknown
        parameters?: unknown
      }
      if (
        typeof body.action !== 'string' ||
        !SUGAR_ACTIONS.includes(body.action as SugarAction)
      ) {
        throw new Error('Unsupported Sugar action')
      }
      const action = body.action as SugarAction
      const parameters = validateSugarRequest(action, body.parameters)
      const output = await execute(
        buildSugarArgv(options.executable, action, parameters),
        options.timeoutMs,
      )
      return Response.json({ output })
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Sugar request failed'
      return Response.json({ error: message }, { status: 400 })
    }
  }
}

export function optionsFromEnv(): BridgeOptions {
  const secret = process.env.SUGAR_BRIDGE_SECRET
  if (!secret) throw new Error('SUGAR_BRIDGE_SECRET is required')
  const timeoutMs = Number(process.env.SUGAR_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS)
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new Error('SUGAR_TIMEOUT_MS must be a positive number')
  }
  return {
    executable: process.env.SUGAR_EXECUTABLE ?? 'sugar',
    secret,
    timeoutMs,
  }
}
