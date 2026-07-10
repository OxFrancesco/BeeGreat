import type { Doc } from './_generated/dataModel'

type Candidate = Pick<
  Doc<'memories'>,
  '_id' | 'value' | 'provenance' | 'retention' | 'currentRevision' | 'updatedAt'
>

function terms(value: string) {
  return (
    value
      .normalize('NFKD')
      .toLowerCase()
      .match(/[\p{L}\p{N}]+/gu)
      ?.filter(Boolean) ?? []
  )
}

function weightedFields(value: Doc<'memories'>['value']) {
  switch (value.kind) {
    case 'bookmark':
      return [
        { text: value.title, weight: 4 },
        { text: value.summary ?? '', weight: 2 },
        { text: value.url, weight: 1 },
      ]
    case 'note':
      return [
        { text: value.title ?? '', weight: 4 },
        { text: value.text, weight: 2 },
      ]
    case 'conversation':
      return [
        { text: value.title ?? '', weight: 3 },
        { text: value.transcript, weight: 1 },
      ]
    case 'derived-memory':
      return [
        { text: value.text, weight: 5 },
        { text: value.memoryType, weight: 1 },
      ]
  }
}

function includesTokenSequence(
  fieldTerms: Array<string>,
  queryTerms: Array<string>,
) {
  if (queryTerms.length === 0 || queryTerms.length > fieldTerms.length) {
    return false
  }
  for (
    let start = 0;
    start <= fieldTerms.length - queryTerms.length;
    start += 1
  ) {
    if (
      queryTerms.every((term, offset) => fieldTerms[start + offset] === term)
    ) {
      return true
    }
  }
  return false
}

function relevanceScore(query: string, value: Doc<'memories'>['value']) {
  const queryTerms = terms(query)
  if (queryTerms.length === 0) return 0
  const uniqueQueryTerms = [...new Set(queryTerms)]

  return weightedFields(value).reduce((score, field) => {
    const fieldTerms = terms(field.text)
    const fieldTermSet = new Set(fieldTerms)
    const termScore = uniqueQueryTerms.reduce(
      (sum, term) => sum + (fieldTermSet.has(term) ? field.weight : 0),
      0,
    )
    const phraseScore = includesTokenSequence(fieldTerms, queryTerms)
      ? field.weight * 4
      : 0
    return score + termScore + phraseScore
  }, 0)
}

/** Pure, deterministic v1 relevance seam over a bounded owner-scoped candidate window. */
export function rankMemoryCandidates(
  query: string,
  candidates: Array<Candidate>,
  limit: number,
) {
  return candidates
    .map((candidate) => ({
      candidate,
      score: relevanceScore(query, candidate.value),
    }))
    .filter(({ score }) => score > 0)
    .sort((left, right) => {
      if (left.score !== right.score) return right.score - left.score
      if (left.candidate.updatedAt !== right.candidate.updatedAt) {
        return right.candidate.updatedAt - left.candidate.updatedAt
      }
      if (left.candidate._id === right.candidate._id) return 0
      return left.candidate._id < right.candidate._id ? -1 : 1
    })
    .slice(0, limit)
}
