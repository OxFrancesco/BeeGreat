import { describe, expect, test } from 'bun:test'
import { imagineSubagent } from '../src/shared/imagine-subagent.ts'

describe('Imagine subagent', () => {
  test('is a built-in media specialist with the complete FAL toolset', () => {
    const profile = imagineSubagent('https://bee.convex.cloud', {
      brokerSecret: 'broker-secret',
    })

    expect(profile.name).toBe('imagine')
    expect(profile.description).toContain('Built-in FAL media studio')
    expect(profile.tools?.map((tool) => tool.name)).toEqual([
      'generate_image',
      'edit_image',
      'generate_video',
      'edit_video',
    ])
  })
})
