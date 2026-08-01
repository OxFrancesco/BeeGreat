import { describe, expect, test } from 'bun:test'
import { siteCreationPrompt, siteEditPrompt } from './sites-page'

describe('Bee Sites prompts', () => {
  test('asks Astro Creator for a review preview without authorizing publish', () => {
    const prompt = siteCreationPrompt(
      'Oddo Studio',
      'A minimal portfolio for my product work.',
    )

    expect(prompt).toContain('Astro Creator')
    expect(prompt).toContain('Oddo Studio')
    expect(prompt).toContain('A minimal portfolio')
    expect(prompt).toContain('preview')
    expect(prompt).toContain('Do not publish')
  })

  test('names the exact existing site in an edit request', () => {
    expect(siteEditPrompt('Oddo Studio', 'Add a speaking page.')).toContain(
      'existing Bee Site named "Oddo Studio"',
    )
  })
})
