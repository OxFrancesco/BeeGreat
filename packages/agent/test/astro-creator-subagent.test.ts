import { describe, expect, test } from 'bun:test'
import {
  astroCreatorSubagent,
  astroCreatorTools,
  callBeeSitesService,
} from '../src/shared/bee-sites/astro-creator.ts'

describe('Astro Creator subagent', () => {
  test('uses Terra High and exposes only the guarded site workspace tools', () => {
    const options = {
      userId: 'user_creator',
      model: 'openrouter/openai/gpt-5.6-terra',
      convexUrl: 'https://bee.convex.cloud',
      brokerSecret: 'broker-secret',
      // SAFETY: this test only inspects tool/subagent metadata; the sandbox
      // double is never invoked.
      sandbox: {} as never,
      // SAFETY: this test only inspects tool/subagent metadata; the bucket
      // double is never invoked.
      bucket: {} as never,
    }
    const definition = astroCreatorSubagent(options)

    expect(definition.name).toBe('astro-creator')
    expect(definition.model).toBe('openrouter/openai/gpt-5.6-terra')
    expect(definition.thinkingLevel).toBe('high')
    // The delegate mounts its tools during its render; the same factory feeds it.
    expect(astroCreatorTools(options).map((tool) => tool.name)).toEqual([
      'list_bee_sites',
      'prepare_site_workspace',
      'read_site_file',
      'write_site_file',
      'check_site',
      'preview_site',
      'publish_site',
    ])
  })

  test('authenticates every control-plane request and surfaces its error', async () => {
    await expect(
      callBeeSitesService(
        'https://bee.convex.cloud',
        'broker-secret',
        { userId: 'user_creator', operation: 'list' },
        async (input, init) => {
          expect(String(input)).toBe(
            'https://bee.convex.site/internal/bee-sites',
          )
          expect(init?.headers).toEqual({
            authorization: 'Bearer broker-secret',
            'content-type': 'application/json',
          })
          return Response.json({ error: 'Monthly limit reached' }, { status: 400 })
        },
      ),
    ).rejects.toThrow('Monthly limit reached')
  })
})
