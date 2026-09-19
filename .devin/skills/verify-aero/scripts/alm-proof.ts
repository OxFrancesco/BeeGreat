import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

export function journalContents(directory: string): string {
  if (!existsSync(directory)) return '[]'
  return JSON.stringify(readdirSync(directory).sort().map((name) => [
    name, createHash('sha256').update(readFileSync(join(directory, name))).digest('hex'),
  ]))
}

export function almPassProblem(output: string): string | undefined {
  const failure = output.split('\n').find((line) => /ALM pass blocked:|pass failed:|requires manual recovery|manual recovery required|no CL position found|no position found for this wallet/i.test(line))
  if (failure) return failure.trim()
  if (!output.includes('dry-run: printing and notifying only')) return 'Missing dry-run startup confirmation'
  return undefined
}

export function rangeIsConsistent(entry: Record<string, unknown>): boolean {
  const { range, tick, in_range: inRange } = entry
  if (!Array.isArray(range) || range.length !== 2 || typeof tick !== 'number' || !Number.isInteger(tick)) return false
  const [lower, upper] = range
  if (typeof lower !== 'number' || typeof upper !== 'number' || !Number.isInteger(lower) || !Number.isInteger(upper) || lower >= upper) return false
  return typeof inRange === 'boolean' && inRange === (lower <= tick && tick < upper)
}
