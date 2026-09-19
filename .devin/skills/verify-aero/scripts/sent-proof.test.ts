import { expect, test } from 'bun:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createFileJournalStore } from '../../../../packages/sugar/src/execution-journal'
import { createExecutionPlan } from '../../../../packages/sugar/src/send'
import { completedJournalForHashes } from './sent-proof'

test('sent output must match the completed send journal, independently of an earlier preview', () => {
  const directory = mkdtempSync(join(tmpdir(), 'sent-proof-'))
  const sender = '0x0000000000000000000000000000000000000001'
  const hash = '0x1111111111111111111111111111111111111111111111111111111111111111'
  const otherHash = '0x2222222222222222222222222222222222222222222222222222222222222222'
  const plan = createExecutionPlan({ chainId: 8453, sender, steps: [{ role: 'action', transaction: { from: sender, to: sender, data: '0x', value: 0n } }] })
  const store = createFileJournalStore(directory)
  const input = { directory, sender, chainId: 8453, hashes: [hash] }
  try {
    expect(completedJournalForHashes(input)).toBeUndefined()
    store.save({ plan, status: 'active', steps: [{ kind: 'confirmed', hash }] })
    expect(completedJournalForHashes(input)).toBeUndefined()
    store.save({ plan, status: 'complete', steps: [{ kind: 'confirmed', hash }] })
    expect(completedJournalForHashes(input)).toBe(plan.id)
    expect(completedJournalForHashes({ ...input, hashes: [otherHash] })).toBeUndefined()
    expect(completedJournalForHashes({ ...input, hashes: [hash, otherHash] })).toBeUndefined()
    expect(completedJournalForHashes({ ...input, hashes: [hash, hash] })).toBeUndefined()
    expect(completedJournalForHashes({ ...input, hashes: [] })).toBeUndefined()
    expect(completedJournalForHashes({ ...input, chainId: 10 })).toBeUndefined()
    expect(completedJournalForHashes({ ...input, sender: null })).toBeUndefined()
    expect(completedJournalForHashes({ ...input, sender: '0x0000000000000000000000000000000000000002' })).toBeUndefined()
    store.save({ plan, status: 'failed', steps: [{ kind: 'reverted', hash }] })
    expect(completedJournalForHashes(input)).toBeUndefined()
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})
