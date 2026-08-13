import { describe, expect, test } from 'bun:test'
import {
  PRIVATE_OPENROUTER_PROVIDER_ID,
  privateOpenRouterModels,
} from '../src/providers/private-openrouter.ts'

describe('private OpenRouter provider', () => {
  test('forces no collection and zero retention on every model', () => {
    const models = privateOpenRouterModels()
    expect(models.length).toBeGreaterThan(0)
    for (const model of models) {
      expect(model.provider).toBe(PRIVATE_OPENROUTER_PROVIDER_ID)
      expect(model.compat?.openRouterRouting).toMatchObject({
        data_collection: 'deny',
        zdr: true,
      })
    }
  })
})
