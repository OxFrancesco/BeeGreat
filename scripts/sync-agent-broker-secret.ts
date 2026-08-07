import { chmod, rename, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const REQUIRED_WORKER_KEYS = [
  { name: 'AGENT_CREDENTIAL_BROKER_SECRET', minimumLength: 32 },
  { name: 'OPENROUTER_API_KEY', minimumLength: 20 },
] as const
const repositoryRoot = join(import.meta.dir, '..')
const backendRoot = join(repositoryRoot, 'packages', 'backend')
const agentEnvPath = join(repositoryRoot, 'packages', 'agent', '.dev.vars')

async function deployedValue(
  key: string,
  minimumLength: number,
): Promise<string> {
  const process = Bun.spawn(
    ['bunx', 'convex', 'env', 'get', key],
    {
      cwd: backendRoot,
      env: globalThis.process.env,
      stdin: 'ignore',
      stdout: 'pipe',
      stderr: 'pipe',
    },
  )
  const stdout = new Response(process.stdout).text()
  const stderr = new Response(process.stderr).text()
  const [exitCode, value] = await Promise.all([
    process.exited,
    stdout,
    stderr,
  ]).then(([code, output]) => [code, output.trim()] as const)

  if (exitCode !== 0) {
    throw new Error(
      `Convex does not expose ${key} for the active deployment. Configure it before running Bee.`,
    )
  }
  if (value.length < minimumLength || /[\r\n]/.test(value)) {
    throw new Error(`${key} on the active Convex deployment is invalid.`)
  }
  return value
}

function withDeploymentValues(
  contents: string,
  values: ReadonlyMap<string, string>,
): string {
  const retainedLines = contents
    .split(/\r?\n/)
    .filter((line) => {
      const separator = line.indexOf('=')
      return separator < 0 || !values.has(line.slice(0, separator))
    })
  while (retainedLines.at(-1) === '') retainedLines.pop()
  const synchronizedLines = Array.from(
    values,
    ([key, value]) => `${key}=${value}`,
  )
  return `${retainedLines.join('\n')}\n${synchronizedLines.join('\n')}\n`
}

async function syncWorkerEnvironment(): Promise<void> {
  const entries = await Promise.all(
    REQUIRED_WORKER_KEYS.map(async ({ name, minimumLength }) => {
      return [name, await deployedValue(name, minimumLength)] as const
    }),
  )
  const values = new Map(entries)
  const file = Bun.file(agentEnvPath)
  const contents = (await file.exists()) ? await file.text() : ''
  const next = withDeploymentValues(contents, values)
  const temporaryPath = `${agentEnvPath}.${process.pid}.${crypto.randomUUID()}.tmp`

  try {
    await writeFile(temporaryPath, next, {
      encoding: 'utf8',
      flag: 'wx',
      mode: 0o600,
    })
    await chmod(temporaryPath, 0o600)
    await rename(temporaryPath, agentEnvPath)
    await chmod(agentEnvPath, 0o600)
  } finally {
    await rm(temporaryPath, { force: true })
  }

  console.log('Synced required Convex credentials for the local Bee worker.')
}

await syncWorkerEnvironment()
