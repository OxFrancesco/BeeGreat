import { describe, expect, test } from 'bun:test'
import { createSitesWorker } from '../src/index.ts'

function bucket(entries: Record<string, string>) {
  return {
    async get(key: string) {
      const value = entries[key]
      if (value === undefined) return null
      return {
        body: value,
        httpMetadata: {
          contentType: key.endsWith('.html')
            ? 'text/html; charset=utf-8'
            : 'text/css; charset=utf-8',
        },
      }
    },
  }
}

describe('Bee Sites public worker', () => {
  test('serves the active production version and nested routes', async () => {
    const worker = createSitesWorker({
      resolveSite: async (slug) =>
        slug === 'studio'
          ? { assetPrefix: 'users/u/sites/s/deployments/v1/' }
          : null,
    })
    const env = {
      CONVEX_URL: 'https://bee.convex.cloud',
      BEE_SITES_BUCKET: bucket({
        'users/u/sites/s/deployments/v1/about/index.html': '<h1>About</h1>',
      }),
    }

    const response = await worker.fetch(
      new Request('https://sites.buddytools.org/studio/about'),
      env,
    )

    expect(response.status).toBe(200)
    expect(await response.text()).toBe('<h1>About</h1>')
    expect(response.headers.get('content-security-policy')).toContain(
      "script-src 'none'",
    )
  })

  test('serves unlisted previews through an active random deployment', async () => {
    let siteResolutions = 0
    let previewResolutions = 0
    const worker = createSitesWorker({
      resolveSite: async () => {
        siteResolutions += 1
        return null
      },
      resolvePreview: async (version) => {
        previewResolutions += 1
        return version === 'a'.repeat(32)
          ? { assetPrefix: 'users/u/sites/s/deployments/preview/' }
          : null
      },
    })
    const token = 'a'.repeat(32)
    const env = {
      CONVEX_URL: 'https://bee.convex.cloud',
      BEE_SITES_BUCKET: bucket({
        'users/u/sites/s/deployments/preview/index.html': '<h1>Preview</h1>',
      }),
    }

    const response = await worker.fetch(
      new Request(`https://sites.buddytools.org/preview/${token}`),
      env,
    )

    expect(response.status).toBe(200)
    expect(await response.text()).toBe('<h1>Preview</h1>')
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(response.headers.get('x-robots-tag')).toBe('noindex, nofollow')
    expect(siteResolutions).toBe(0)
    expect(previewResolutions).toBe(1)
  })

  test('fails closed for unpublished, missing, and traversal paths', async () => {
    const worker = createSitesWorker({ resolveSite: async () => null })
    const env = {
      CONVEX_URL: 'https://bee.convex.cloud',
      BEE_SITES_BUCKET: bucket({}),
    }

    const responses = await Promise.all([
      worker.fetch(new Request('https://sites.buddytools.org/gone'), env),
      worker.fetch(
        new Request('https://sites.buddytools.org/preview/not-a-token'),
        env,
      ),
      worker.fetch(
        new Request('https://sites.buddytools.org/studio/%2e%2e/secret'),
        env,
      ),
    ])

    expect(responses.map((response) => response.status)).toEqual([404, 404, 404])
  })
})
