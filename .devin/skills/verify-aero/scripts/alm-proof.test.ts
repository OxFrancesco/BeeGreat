import { expect, test } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { almPassProblem, journalContents, rangeIsConsistent } from './alm-proof'

const startup = 'aero serve — self-hosted ALM (dry-run: printing and notifying only)'

test('exit-zero ALM diagnostics cannot count as a successful pass', () => {
  for (const line of [
    'ALM pass blocked: state locked',
    '[0x123] pass failed: RPC unavailable',
    'ALM cycle 42 requires manual recovery; run aero alm recover --id 42.',
    'manual recovery required',
    '[0x123] no CL position found for 0x456; waiting',
    'no position found for this wallet',
  ]) expect(almPassProblem(`${startup}\n${line}`)).toBe(line)
  expect(almPassProblem('')).toBeDefined()
  expect(almPassProblem('EXECUTE mode: will sign and broadcast')).toBeDefined()
  expect(almPassProblem(startup)).toBeUndefined()
  expect(almPassProblem(`${startup}\n[pool] DRY-RUN would rebalance: out of range`)).toBeUndefined()
})

test('range proof accepts market movement and enforces the exclusive upper bound', () => {
  for (const [tick, in_range] of [[-11, false], [-10, true], [0, true], [10, false]]) {
    expect(rangeIsConsistent({ range: [-10, 10], tick, in_range })).toBe(true)
    expect(rangeIsConsistent({ range: [-10, 10], tick, in_range: !in_range })).toBe(false)
  }
  for (const range of [[], [10, -10], [0, 0], ['-10', 10], [NaN, 10]]) {
    expect(rangeIsConsistent({ range, tick: 0, in_range: true })).toBe(false)
  }
})

test('journal proof detects same-name content changes and added or removed files', () => {
  const directory = mkdtempSync(join(tmpdir(), 'alm-proof-'))
  try {
    const empty = journalContents(directory)
    const file = join(directory, 'execution.json')
    writeFileSync(file, '{"status":"active"}')
    const active = journalContents(directory)
    expect(active).not.toBe(empty)
    expect(journalContents(directory)).toBe(active)
    writeFileSync(file, '{"status":"failed"}')
    expect(journalContents(directory)).not.toBe(active)
    rmSync(file)
    expect(journalContents(directory)).toBe(empty)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})
