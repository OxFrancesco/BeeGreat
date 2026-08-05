import { describe, expect, test } from 'bun:test'
import { imagineSubagent, imagineTools } from '../src/shared/imagine-subagent.ts'

describe('Imagine subagent', () => {
  test('is a built-in media specialist with the complete FAL toolset', () => {
    const definition = imagineSubagent('https://bee.convex.cloud', {
      brokerSecret: 'broker-secret',
    })

    expect(definition.name).toBe('imagine')
    expect(definition.description).toContain('Built-in FAL media studio')
    // The delegate mounts its tools during its render; the same factory feeds it.
    expect(
      imagineTools('https://bee.convex.cloud', {
        brokerSecret: 'broker-secret',
      }).map((tool) => tool.name),
    ).toEqual(['generate_image', 'edit_image', 'generate_video', 'edit_video'])
  })
})
