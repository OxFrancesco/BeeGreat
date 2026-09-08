import { afterEach, expect, test } from 'bun:test'
import { astroCreatorTools, type AstroCreatorOptions } from '../src/shared/bee-sites/astro-creator'

const originalFetch = globalThis.fetch
afterEach(() => { globalThis.fetch = originalFetch })
const indexSource = "---\nimport '../styles/site.css'\n---\n<h1>My site</h1>"
function fixture(failBuild = false) {
  const builtSources: string[] = []; const machines: Array<{ destroyed: boolean }> = []
  const objects = new Map<string, string>()
  const puts: Array<{ key: string; value: unknown }> = []
  globalThis.fetch = (async (_url: unknown, init?: RequestInit) => {
    const args = JSON.parse(String(init?.body))
    if (args.operation === 'prepare') return Response.json({ siteId: 'site-one', slug: 'my-site', title: 'My site', status: 'draft', publicUrl: 'https://sites.buddytools.org/my-site/', limits: { tier: 'free', sites: 1, pagesPerSite: 5, generationsPerMonth: 15, publishesPerMonth: 20 }, generationRemaining: 14 })
    if (args.operation === 'begin_deployment') { expect(args.kind).toBe('preview'); return Response.json({ deploymentId: 'deployment-one', version: args.version, slug: 'my-site', publicUrl: 'https://sites.buddytools.org/my-site/' }) }
    if (args.operation === 'complete_deployment') { expect(args.contentDigest).toMatch(/^[a-f0-9]{64}$/); return Response.json({ reviewUrl: 'https://beegreat.app/review?site=immutable-version' }) }
    return Response.json({})
  }) as typeof fetch
  const options: AstroCreatorOptions = {
    userId: 'user_site', model: 'test', convexUrl: 'https://example.convex.cloud', brokerSecret: 'broker-only-in-worker',
    createBuildSandbox: () => {
      const state = { destroyed: false }; machines.push(state)
      const files = new Map<string, string>(); let packageTampered = false
      return {
        destroy: async () => { state.destroyed = true },
        mkdir: async () => ({ success: true }),
        writeFile: async (path: string, content: string) => { files.set(path, content); return { success: true } },
        readFile: async (path: string, read?: { encoding?: string }) => {
          const content = path.endsWith('/dist/index.html') ? '<h1>Built</h1>' : path.endsWith('index.astro') ? files.get(path) ?? indexSource : path.endsWith('site.css') ? 'h1 { color: black }' : '{}'
          return { success: true, content: read?.encoding === 'base64' ? btoa(content) : content }
        },
        exec: async (command: string, execOptions?: { env?: unknown }) => {
          expect(execOptions?.env).toBeUndefined()
          if (command.startsWith('find src')) return { success: true, stdout: 'src/pages/index.astro\nsrc/styles/site.css\n', stderr: '', exitCode: 0 }
          if (command.startsWith('chown')) {
            expect(packageTampered).toBe(false); expect(command).toContain('runuser -u bee-site-build -- env -i')
            builtSources.push(files.get('/workspace/bee-sites/site-one/src/pages/index.astro')!)
            packageTampered = true
            files.set('/workspace/bee-sites/site-one/src/pages/index.astro', 'ATTACKER MODIFIED BUILD COPY')
            if (failBuild) throw new Error('build timed out')
          }
          if (command.startsWith('find dist')) return { success: true, stdout: `index.html\t${'<h1>Built</h1>'.length}\n`, stderr: '', exitCode: 0 }
          return { success: true, stdout: '', stderr: '', exitCode: 0 }
        },
      } as unknown as ReturnType<AstroCreatorOptions['createBuildSandbox']>
    },
    bucket: {
      list: async ({ prefix }) => ({ objects: [...objects.keys()].filter(key => key.startsWith(prefix)).map(key => ({ key })) }),
      get: async key => objects.has(key) ? { body: new Response(objects.get(key)!).body! } : null,
      put: async (key, value) => { puts.push({ key, value }); return { key } },
      delete: async () => {},
    },
  }
  const tools = astroCreatorTools(options)
  const call = async (name: string, data: Record<string, unknown> = {}) => tools.find(tool => tool.name === name)!.run!({ data } as never)
  return { call, machines, builtSources, puts, objects }
}

test('every build gets fresh trusted state and persists only Worker-owned source, including legacy restored Astro', async () => {
  const f = fixture()
  const legacySource = `${indexSource}\n<!-- restored legacy source -->`
  f.objects.set('users/user_site/sites/site-one/source/src/pages/index.astro', legacySource)
  await f.call('prepare_site_workspace', { title: 'My site' })
  await f.call('check_site')
  const preview = await f.call('preview_site')
  expect(f.builtSources).toEqual([legacySource, legacySource])
  expect(f.machines).toHaveLength(3); expect(f.machines.every(machine => machine.destroyed)).toBe(true)
  expect(f.puts.find(put => put.key.endsWith('/source/src/pages/index.astro'))?.value).toBe(legacySource)
  expect(preview).toMatchObject({ output: { kind: 'preview', reviewUrl: 'https://beegreat.app/review?site=immutable-version' } })
})

test('build timeout destroys the VM and does not write its source or output back', async () => {
  const f = fixture(true)
  await f.call('prepare_site_workspace', { title: 'My site' })
  await expect(f.call('preview_site')).rejects.toThrow('build timed out')
  expect(f.machines).toHaveLength(2); expect(f.machines.every(machine => machine.destroyed)).toBe(true)
  expect(f.puts).toHaveLength(0)
})

test('publish tool produces a review link and never invokes a production upload', async () => {
  const f = fixture()
  await f.call('prepare_site_workspace', { title: 'My site' })
  expect(await f.call('publish_site')).toMatchObject({ output: { kind: 'preview', reviewUrl: 'https://beegreat.app/review?site=immutable-version' } })
})
