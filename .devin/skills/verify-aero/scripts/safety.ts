import { closeSync, lstatSync, openSync, realpathSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, relative, resolve } from 'node:path'

function canonicalPath(path: string): string {
  const absolute = resolve(path)
  // lstat keeps dangling symlinks from being mistaken for a missing directory.
  try {
    lstatSync(absolute)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    const parent = dirname(absolute)
    if (parent === absolute) throw error
    return join(canonicalPath(parent), relative(parent, absolute))
  }
  return realpathSync(absolute)
}

export function assertIsolatedHome(home: string, realWallet = join(homedir(), '.config', 'sugar-ts')): void {
  const protectedPath = canonicalPath(realWallet)
  for (const path of [home, ...['wallet', 'cache', 'indices', 'alm.json', 'runs', 'passphrase', 'run.lock'].map((name) => join(home, name))]) {
    const candidate = canonicalPath(path)
    const inside = relative(protectedPath, candidate)
    const contains = relative(candidate, protectedPath)
    if (inside === '' || (!inside.startsWith('../') && inside !== '..') || contains === '' || (!contains.startsWith('../') && contains !== '..')) {
      throw new Error('verify-aero: verification state overlaps the real wallet directory; choose an isolated AERO_VERIFY_HOME')
    }
  }
}

export function acquireRunLock(path: string): void {
  let descriptor: number
  try {
    descriptor = openSync(path, 'wx', 0o600)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
      throw new Error('run.lock already exists; verify no runner or CLI child remains and reconcile executions before manually removing a stale lock')
    }
    throw error
  }
  try {
    writeFileSync(descriptor, JSON.stringify({ pid: process.pid, at: Date.now() }))
  } finally {
    closeSync(descriptor)
  }
}

if (import.meta.main) {
  const home = process.argv[2]
  if (!home) throw new Error('verification home is required')
  assertIsolatedHome(home)
}
