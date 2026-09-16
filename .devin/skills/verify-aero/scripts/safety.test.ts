import { afterEach, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'
import { acquireRunLock, assertIsolatedHome } from './safety'

const roots: string[] = []
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'aero-safety-'))
  roots.push(root)
  const realWallet = join(root, 'real-wallet')
  const home = join(root, 'verify')
  mkdirSync(realWallet)
  mkdirSync(home)
  return { root, realWallet, home }
}
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

test('rejects a wallet symlink while allowing a fresh isolated home', () => {
  const { realWallet, home } = fixture()
  expect(() => assertIsolatedHome(home, realWallet)).not.toThrow()
  symlinkSync(realWallet, join(home, 'wallet'))
  expect(() => assertIsolatedHome(home, realWallet)).toThrow('overlaps')
})

test('rejects aliases through a parent and cleanup directories', () => {
  const { root, realWallet, home } = fixture()
  symlinkSync(realWallet, join(root, 'alias'))
  expect(() => assertIsolatedHome(join(root, 'alias', 'new'), realWallet)).toThrow('overlaps')
  symlinkSync(realWallet, join(home, 'cache'))
  expect(() => assertIsolatedHome(home, realWallet)).toThrow('overlaps')
})

test('rejects dangling wallet links instead of assuming isolation', () => {
  const { root, realWallet, home } = fixture()
  symlinkSync(join(root, 'missing'), join(home, 'wallet'))
  expect(() => assertIsolatedHome(home, realWallet)).toThrow()
})

test('preserves existing malformed and stale locks for explicit recovery', () => {
  const { home } = fixture()
  const path = join(home, 'run.lock')
  for (const contents of ['', '{bad', '{"pid":999999999}']) {
    writeFileSync(path, contents)
    expect(() => acquireRunLock(path)).toThrow('already exists')
    expect(readFileSync(path, 'utf8')).toBe(contents)
  }
})

test('only one concurrent process can acquire a wallet run lock', async () => {
  const { home } = fixture()
  const lock = join(home, 'run.lock')
  const module = join(import.meta.dir, 'safety.ts')
  const children = Array.from({ length: 8 }, () => Bun.spawn([
    process.execPath, '-e',
    `import { acquireRunLock } from ${JSON.stringify(module)}; try { acquireRunLock(process.argv[1]); } catch { process.exit(1); }`, lock,
  ], { stdout: 'pipe', stderr: 'pipe' }))
  const codes = await Promise.all(children.map((child) => child.exited))
  expect(codes.filter((code) => code === 0)).toHaveLength(1)
  expect(codes.filter((code) => code === 1)).toHaveLength(7)
})


test('shell environment refuses a real-wallet alias before invoking its caller', async () => {
  const { home } = fixture()
  symlinkSync(join(homedir(), '.config', 'sugar-ts'), join(home, 'wallet'))
  const child = Bun.spawn(['bash', '-e', '-c', 'source "$1"; echo unsafe-caller-ran', 'verify-test', join(import.meta.dir, 'env.sh')], {
    env: { ...process.env, AERO_VERIFY_HOME: home }, stdout: 'pipe', stderr: 'pipe',
  })
  const output = await new Response(child.stdout).text()
  await new Response(child.stderr).text()
  expect(await child.exited).not.toBe(0)
  expect(output).not.toContain('unsafe-caller-ran')
})


test('cleanup preserves active, malformed, and newly created empty locks', async () => {
  const { home } = fixture()
  const path = join(home, 'run.lock')
  mkdirSync(join(home, 'cache'))
  const marker = join(home, 'cache', 'keep')
  writeFileSync(marker, 'keep')
  for (const contents of [JSON.stringify({ pid: process.pid }), '', '{bad']) {
    writeFileSync(path, contents)
    const child = Bun.spawn(['bash', join(import.meta.dir, 'cleanup.sh')], {
      env: { ...process.env, AERO_VERIFY_HOME: home }, stdout: 'pipe', stderr: 'pipe',
    })
    await new Response(child.stdout).text()
    const error = await new Response(child.stderr).text()
    expect(await child.exited).not.toBe(0)
    expect(error).toContain('Cleanup refused')
    expect(readFileSync(path, 'utf8')).toBe(contents)
    expect(readFileSync(marker, 'utf8')).toBe('keep')
  }
  expect(() => process.kill(process.pid, 0)).not.toThrow()
})
