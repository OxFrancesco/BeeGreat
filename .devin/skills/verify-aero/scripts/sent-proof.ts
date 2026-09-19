import { createFileJournalStore } from '../../../../packages/sugar/src/execution-journal'

export function completedJournalForHashes(input: { directory: string; sender: string | null; chainId: number; hashes: string[] }): string | undefined {
  if (input.sender === null || input.hashes.length === 0 || new Set(input.hashes).size !== input.hashes.length) return undefined
  const matches = createFileJournalStore(input.directory).list().filter((journal) =>
    journal.status === 'complete'
    && journal.plan.chainId === input.chainId
    && journal.plan.sender.toLowerCase() === input.sender?.toLowerCase()
    && journal.plan.steps.length === input.hashes.length
    && journal.steps.length === input.hashes.length
    && journal.steps.every((step, index) => step.kind === 'confirmed' && step.hash === input.hashes[index]))
  return matches.length === 1 ? matches[0]?.plan.id : undefined
}
