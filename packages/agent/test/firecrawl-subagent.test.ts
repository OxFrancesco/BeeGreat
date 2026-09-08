import { describe, expect, spyOn, test } from 'bun:test'
import { defineTool, type ToolDefinition, type McpConnectionDefinition } from '@flue/runtime'
import * as v from 'valibot'
import {
  FIRECRAWL_MCP_TIMEOUT_MS,
  FIRECRAWL_MCP_URL,
  createFirecrawlToolLoader,
  meterFirecrawlTools,
  firecrawlSubagent,
} from '../src/shared/firecrawl-subagent.ts'

const scrapeTool = defineTool({
  name: 'mcp__firecrawl__firecrawl_scrape',
  description: 'Scrape one page',
  input: v.object({}),
  run: () => ({ output: { ok: true } }),
})

describe('Firecrawl crawler subagent', () => {
  test('is a built-in specialist for stateless public web research', () => {
    const definition = firecrawlSubagent([scrapeTool])

    expect(definition.name).toBe('crawler')
    expect(definition.description).toContain('within usage limits')
    expect(definition.agent).toBeInstanceOf(Function)
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


test('shared provider tools reject persisted-resource operations and unbounded arguments before admission', async () => {
  let providerCalls = 0
  const tools = meterFirecrawlTools([
    defineTool({ name: 'mcp__firecrawl__firecrawl_search', description: 'search', input: v.object({}), run: () => { providerCalls++; return { output: 'ok' } } }),
    defineTool({ name: 'mcp__firecrawl__firecrawl_crawl_status', description: 'status', input: v.object({}), run: () => ({ output: 'private resource' }) }),
  ], 'user_test', { convexSiteUrl: 'https://limits.test', brokerSecret: 'test-secret' })
  expect(tools.map(tool => tool.name)).toEqual(['mcp__firecrawl__firecrawl_search'])
  const fetchSpy = spyOn(globalThis, 'fetch').mockImplementation(async () => Response.json({ error: 'Daily limit' }, { status: 429 }))
  try {
    for (const data of [{ query: 'test', limit: 999 }, { query: 'test', crawlId: 'foreign' }]) {
      await expect(tools[0]!.run({ data } as Parameters<ToolDefinition['run']>[0])).rejects.toThrow()
    }
    expect(fetchSpy).not.toHaveBeenCalled()
    await expect(tools[0]!.run({ data: { query: 'test' } } as Parameters<ToolDefinition['run']>[0])).rejects.toThrow(/Daily limit/)
    expect(providerCalls).toBe(0)
  } finally { fetchSpy.mockRestore() }
})
