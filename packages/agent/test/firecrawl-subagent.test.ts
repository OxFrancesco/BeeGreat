import { describe, expect, test } from 'bun:test'
import { defineTool, type McpConnectionDefinition } from '@flue/runtime'
import * as v from 'valibot'
import {
  FIRECRAWL_MCP_TIMEOUT_MS,
  FIRECRAWL_MCP_URL,
  createFirecrawlToolLoader,
  firecrawlSubagent,
} from '../src/shared/firecrawl-subagent.ts'

const scrapeTool = defineTool({
  name: 'mcp__firecrawl__firecrawl_scrape',
  description: 'Scrape one page',
  input: v.object({}),
  run: () => ({ output: { ok: true } }),
})

describe('Firecrawl crawler subagent', () => {
  test('is a built-in specialist for the complete live Firecrawl surface', () => {
    const definition = firecrawlSubagent([scrapeTool])

    expect(definition.name).toBe('crawler')
    expect(definition.description).toContain('recurring page-change monitors')
    expect(typeof definition.agent).toBe('function')
  })

  test('discovers tools once and reuses the live MCP connection', async () => {
    const definitions: McpConnectionDefinition[] = []
    const load = createFirecrawlToolLoader(async (definition) => {
      definitions.push(definition)
      return {
        name: 'firecrawl',
        tools: [scrapeTool],
        close: async () => {},
      }
    })

    await expect(load(undefined)).resolves.toEqual([])
    await expect(load(' fc-test ')).resolves.toEqual([scrapeTool])
    await expect(load('fc-test')).resolves.toEqual([scrapeTool])

    expect(definitions).toHaveLength(1)
    expect(definitions[0]).toMatchObject({
      name: 'firecrawl',
      url: FIRECRAWL_MCP_URL,
      auth: 'fc-test',
      timeoutMs: FIRECRAWL_MCP_TIMEOUT_MS,
      resetTimeoutOnProgress: true,
    })
  })

  test('retries discovery after a failed connection', async () => {
    let attempts = 0
    const load = createFirecrawlToolLoader(async () => {
      attempts += 1
      if (attempts === 1) throw new Error('temporary outage')
      return {
        name: 'firecrawl',
        tools: [scrapeTool],
        close: async () => {},
      }
    })

    await expect(load('fc-test')).rejects.toThrow('temporary outage')
    await expect(load('fc-test')).resolves.toEqual([scrapeTool])
    expect(attempts).toBe(2)
  })
})
