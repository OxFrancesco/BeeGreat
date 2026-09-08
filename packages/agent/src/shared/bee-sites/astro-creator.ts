import {
  defineSubagent,
  defineTool,
  useTool,
  type JsonValue,
  type SubagentDefinition,
} from '@flue/runtime'
import type { ISandbox } from '@cloudflare/sandbox'
import * as v from 'valibot'
import { trustedCast } from '../trusted-cast.ts'

const serviceErrorSchema = v.object({ error: v.string() })

const SITES_ORIGIN = 'https://sites.buddytools.org'
const TEMPLATE_ROOT = '/opt/bee-sites-template'
const WORKSPACES_ROOT = '/workspace/bee-sites'
const MAX_TOOL_TEXT = 200_000
const MAX_LOG_TEXT = 20_000
const SAFE_ID = /^[A-Za-z0-9_-]+$/
const SAFE_PATH = /^[A-Za-z0-9._/@+-]+(?:\/[A-Za-z0-9._/@+-]+)*$/
const WRITABLE_FILE = /^(?:src\/(?:pages|components|layouts|styles)\/[A-Za-z0-9._/@+-]+\.(?:astro|css)|public\/[A-Za-z0-9._/@+-]+\.(?:css|svg|txt|json|xml|webmanifest))$/
const READABLE_FILE = /^(?:src\/[A-Za-z0-9._/@+-]+\.(?:astro|css)|public\/[A-Za-z0-9._/@+-]+\.(?:css|svg|txt|json|xml|webmanifest)|astro\.config\.mjs|package\.json|tsconfig\.json|AGENTS\.md)$/

const INSTRUCTIONS = `You are Astro Creator, BeeGreat's static-site specialist. You work
for Bee, the coordinator, and your compact result goes back to Bee rather than directly
to the user.

- Build only the static Astro site the user requested. Use the locked starter and the
  guarded tools. Each build runs in a disposable environment without external network
  access, other sites, secrets, or persistent build state.
- Start every creation or editing run with list_bee_sites, then call
  prepare_site_workspace for the exact site. Preparing a workspace consumes one monthly
  generation, so call it once per delegated run and never speculatively.
- Read before editing an existing site. Keep pages accessible, responsive, fast, and
  visually intentional. Use semantic HTML and CSS. Never add client scripts, analytics,
  remote scripts, forms that transmit data, authentication, payments, or server code.
- Use relative internal links and files in public for local assets. Remote HTTPS images
  are acceptable only when the user supplied or explicitly requested them.
- Run check_site after editing. Fix reported errors before offering a preview.
- preview_site and publish_site both create review previews. Give the user the returned
  reviewUrl to approve or cancel publication from their signed-in account. You cannot
  publish by calling a tool or interpreting a chat reply as approval.
- Report the preview or public URL and a short summary. Never expose internal site,
  deployment, or user ids.`

export interface BeeSitesBucket {
  put(
    key: string,
    value: ArrayBuffer | ArrayBufferView | string | ReadableStream,
    options?: {
      httpMetadata?: { contentType?: string; cacheControl?: string }
    },
    // R2 answers with the stored object's metadata; the creator ignores it.
  ): Promise<{ key: string } | null>
  get(key: string): Promise<
    | {
        body: ReadableStream<Uint8Array>
      }
    | null
  >
  list(options: {
    prefix: string
    limit?: number
  }): Promise<{ objects: Array<{ key: string }> }>
  delete(keys: string[]): Promise<void>
}

export interface AstroCreatorOptions {
  userId: string
  model: string
  convexUrl: string
  brokerSecret?: string
  createBuildSandbox: () => ISandbox & { destroy(): Promise<void> }
  bucket: BeeSitesBucket
}

type PreparedSite = {
  siteId: string
  slug: string
  title: string
  status: 'draft' | 'published' | 'unpublished' | 'suspended'
  publicUrl: string
  limits: {
    tier: 'free' | 'pro'
    sites: number
    pagesPerSite: number
    generationsPerMonth: number
    publishesPerMonth: number
  }
  generationRemaining: number
}

type AgentSite = {
  siteId: string
  slug: string
  title: string
  status: string
  pageCount: number
  publicUrl: string
}

type DeploymentStart = {
  deploymentId: string
  version: string
  slug: string
  publicUrl: string
}

function convexSiteUrl(convexUrl: string) {
  const url = new URL(convexUrl)
  if (url.hostname.endsWith('.convex.cloud')) {
    url.hostname = url.hostname.replace(/\.convex\.cloud$/, '.convex.site')
  }
  return url.origin
}

export async function callBeeSitesService<T>(
  convexUrl: string,
  brokerSecret: string | undefined,
  input: Record<string, JsonValue | undefined>,
  fetchImpl: typeof fetch = fetch,
  signal?: AbortSignal,
): Promise<T> {
  if (!brokerSecret?.trim()) {
    throw new Error('Bee Sites is not configured for the Bee worker.')
  }
  const response = await fetchImpl(
    `${convexSiteUrl(convexUrl)}/internal/bee-sites`,
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${brokerSecret}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(input),
      signal,
    },
  )
  const body = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(
      v.is(serviceErrorSchema, body)
        ? body.error
        : 'Bee Sites request failed.',
    )
  }
  if (!body) throw new Error('Bee Sites returned an invalid response.')
  return trustedCast<T>(body)
}

function safeRelativePath(path: string, mode: 'read' | 'write') {
  const normalized = path.trim().replace(/^\.\//, '')
  if (
    !normalized ||
    normalized.includes('..') ||
    normalized.startsWith('/') ||
    !SAFE_PATH.test(normalized) ||
    !(mode === 'read'
      ? READABLE_FILE.test(normalized)
      : WRITABLE_FILE.test(normalized))
  ) {
    throw new Error(
      mode === 'read'
        ? 'That file is outside the readable Astro workspace.'
        : 'Only static Astro, CSS, and approved public text assets can be edited.',
    )
  }
  return normalized
}

function workspaceFor(siteId: string) {
  if (!SAFE_ID.test(siteId)) throw new Error('Invalid Bee Site workspace.')
  return `${WORKSPACES_ROOT}/${siteId}`
}

function sourcePrefixFor(userId: string, siteId: string) {
  if (!SAFE_ID.test(siteId)) throw new Error('Invalid Bee Site workspace.')
  return `users/${userId}/sites/${siteId}/source/`
}

function truncate(value: string) {
  return value.length <= MAX_LOG_TEXT
    ? value
    : `${value.slice(0, MAX_LOG_TEXT)}\n… output truncated`
}

const CONTENT_TYPES = new Map<string, string>([
  ['css', 'text/css; charset=utf-8'],
  ['gif', 'image/gif'],
  ['html', 'text/html; charset=utf-8'],
  ['ico', 'image/x-icon'],
  ['jpeg', 'image/jpeg'],
  ['jpg', 'image/jpeg'],
  ['json', 'application/json; charset=utf-8'],
  ['png', 'image/png'],
  ['svg', 'image/svg+xml'],
  ['txt', 'text/plain; charset=utf-8'],
  ['webmanifest', 'application/manifest+json'],
  ['webp', 'image/webp'],
  ['woff', 'font/woff'],
  ['woff2', 'font/woff2'],
  ['xml', 'application/xml; charset=utf-8'],
])

function contentType(path: string) {
  const extension = path.split('.').pop()?.toLowerCase()
  return CONTENT_TYPES.get(extension ?? '') ?? 'application/octet-stream'
}

function decodeBase64(value: string) {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes
}

function newVersion() {
  return crypto.randomUUID().replaceAll('-', '')
}

/** The guarded site-workspace toolset the delegate mounts; exported for tests. */
export function astroCreatorTools(options: AstroCreatorOptions) {
  let activeSite: PreparedSite | null = null
  let sourceFiles = new Map<string, string>()
  let templateFiles = new Map<string, string>()

  const broker = <T>(
    operation: string,
    input: Record<string, JsonValue | undefined> = {},
    signal?: AbortSignal,
  ) =>
    callBeeSitesService<T>(
      options.convexUrl,
      options.brokerSecret,
      { userId: options.userId, operation, ...input },
      fetch,
      signal,
    )

  const requireActive = () => {
    if (!activeSite) {
      throw new Error('Prepare a Bee Site workspace before editing or building.')
    }
    return {
      site: activeSite,
      workspace: workspaceFor(activeSite.siteId),
    }
  }

  const validateSourceSize = (files: Map<string, string>) => {
    if (files.size > 1_000 || [...files.values()].some(content => content.length > MAX_TOOL_TEXT) || [...files.values()].reduce((sum, content) => sum + new TextEncoder().encode(content).length, 0) > 5_000_000) {
      throw new Error('Bee Site source exceeds the size limit.')
    }
  }

  const withFreshSandbox = async <T>(run: (sandbox: ReturnType<AstroCreatorOptions['createBuildSandbox']>) => Promise<T>) => {
    const sandbox = options.createBuildSandbox()
    try { return await run(sandbox) } finally { await sandbox.destroy() }
  }

  const loadSource = async (site: PreparedSite) => {
    const template = await withFreshSandbox(async sandbox => {
      const files = new Map<string, string>()
      const listed = await sandbox.exec("find src public -type f -print", { cwd: TEMPLATE_ROOT, timeout: 10_000 })
      if (!listed.success) throw new Error('Could not load the trusted Astro starter.')
      for (const path of [...listed.stdout.trim().split('\n').filter(Boolean), 'astro.config.mjs', 'package.json', 'tsconfig.json', 'AGENTS.md']) {
        safeRelativePath(path, 'read')
        const result = await sandbox.readFile(`${TEMPLATE_ROOT}/${path}`)
        if (!result.success) throw new Error(`Could not load ${path}.`)
        files.set(path, result.content)
      }
      return files
    })
    const files = new Map([...template].filter(([path]) => WRITABLE_FILE.test(path)))
    const prefix = sourcePrefixFor(options.userId, site.siteId)
    const snapshot = await options.bucket.list({ prefix, limit: 1_000 })
    for (const object of snapshot.objects) {
      const path = safeRelativePath(object.key.slice(prefix.length), 'write')
      const stored = await options.bucket.get(object.key)
      if (!stored) continue
      const content = await new Response(stored.body).text()
      files.set(path, content)
      validateSourceSize(files)
    }
    return { template, files }
  }

  const snapshotSource = async (site: PreparedSite, files: Map<string, string>) => {
    const prefix = sourcePrefixFor(options.userId, site.siteId)
    const previous = await options.bucket.list({ prefix, limit: 1_000 })
    for (const [path, content] of files) {
      await options.bucket.put(`${prefix}${path}`, content, { httpMetadata: { contentType: contentType(path), cacheControl: 'private, no-store' } })
    }
    const stale = previous.objects.map(({ key }) => key).filter(key => !files.has(key.slice(prefix.length)))
    if (stale.length) await options.bucket.delete(stale)
  }

  const build = async (site: PreparedSite, sources: Map<string, string>, includeOutput: boolean, signal?: AbortSignal) => withFreshSandbox(async sandbox => {
    const workspace = workspaceFor(site.siteId)
    const prepared = await sandbox.exec(`mkdir -p ${workspace} && cp -a ${TEMPLATE_ROOT}/. ${workspace}/`, { timeout: 30_000, signal })
    if (!prepared.success) throw new Error('Could not prepare a fresh Astro build.')
    for (const [path, content] of sources) {
      safeRelativePath(path, 'write')
      await sandbox.mkdir(`${workspace}/${path.slice(0, path.lastIndexOf('/'))}`, { recursive: true })
      const written = await sandbox.writeFile(`${workspace}/${path}`, content)
      if (!written.success) throw new Error(`Could not stage ${path}.`)
    }
    const result = await sandbox.exec(
      `chown -R bee-site-build:bee-site-build ${workspace} && runuser -u bee-site-build -- env -i PATH=/usr/local/bin:/usr/bin:/bin HOME=/tmp/bee-site-build ASTRO_TELEMETRY_DISABLED=1 sh -c 'bun run check && bun run build'`,
      { cwd: workspace, timeout: 120_000, signal },
    )
    // Stop background children before collecting bytes. The whole VM is discarded in finally.
    const stopped = await sandbox.exec('pkill -KILL -u bee-site-build; code=$?; test "$code" -eq 0 -o "$code" -eq 1', { timeout: 10_000 })
    if (!stopped.success) throw new Error('Could not stop Astro build processes.')
    const checked = { ok: result.success, exitCode: result.exitCode, stdout: truncate(result.stdout), stderr: truncate(result.stderr) }
    const files: Array<{ path: string; size: number; bytes: Uint8Array }> = []
    if (!checked.ok || !includeOutput) return { checked, files }
    const manifest = await sandbox.exec("find dist -type l -print | sed -n '1p'; find dist -type f -printf '%P\\t%s\\n' | sort", { cwd: workspace, timeout: 10_000, signal })
    if (!manifest.success) throw new Error('Could not inspect the built site.')
    let totalBytes = 0
    for (const line of manifest.stdout.trim().split('\n').filter(Boolean)) {
      const tab = line.lastIndexOf('\t')
      const path = tab > 0 ? line.slice(0, tab) : ''
      const size = Number(tab > 0 ? line.slice(tab + 1) : NaN)
      if (!path || !SAFE_PATH.test(path) || path.includes('..') || path.startsWith('/') || !Number.isSafeInteger(size) || size < 0) throw new Error('The Astro build produced an unsafe file manifest.')
      totalBytes += size
      if (files.length >= 1_000 || totalBytes > 50 * 1024 * 1024) throw new Error('The Astro build exceeds the output limit.')
      const result = await sandbox.readFile(`${workspace}/dist/${path}`, { encoding: 'base64' })
      if (!result.success) throw new Error(`Could not read ${path}.`)
      const bytes = decodeBase64(result.content)
      if (bytes.length !== size) throw new Error('The Astro output changed while being collected.')
      files.push({ path, size, bytes })
    }
    if (!files.length) throw new Error('The Astro build produced no files.')
    return { checked, files }
  })

  const check = async (signal?: AbortSignal) => {
    const { site } = requireActive()
    return (await build(site, new Map(sourceFiles), false, signal)).checked
  }

  const deploy = async (
    signal?: AbortSignal,
  ) => {
    const { site } = requireActive()
    const sources = new Map(sourceFiles)
    const { checked, files } = await build(site, sources, true, signal)
    if (!checked.ok) throw new Error(`Astro validation failed.\n${checked.stderr || checked.stdout}`)

    const pageCount = files.filter((file) => file.path.endsWith('.html')).length
    const totalBytes = files.reduce((sum, file) => sum + file.size, 0)
    const version = newVersion()
    const hex = (bytes: ArrayBuffer) => Array.from(new Uint8Array(bytes), value => value.toString(16).padStart(2, '0')).join('')
    const hashes = await Promise.all(files.map(async file => [file.path, hex(await crypto.subtle.digest('SHA-256', file.bytes))]))
    const contentDigest = hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(hashes))))
    let started: DeploymentStart | null = null
    try {
      started = await broker<DeploymentStart>(
        'begin_deployment',
        {
          siteId: site.siteId,
          version,
          kind: 'preview',
          pageCount,
          fileCount: files.length,
          totalBytes,
        },
        signal,
      )
      const assetPrefix = `users/${options.userId}/sites/${site.siteId}/deployments/${version}/`
      for (const file of files) {
        await options.bucket.put(
          `${assetPrefix}${file.path}`,
          file.bytes,
          {
            httpMetadata: {
              contentType: contentType(file.path),
              cacheControl: 'public, max-age=0, must-revalidate',
            },
          },
        )
      }
      await snapshotSource(site, sources)
      const completed = await broker<{ reviewUrl: string }>(
        'complete_deployment',
        { deploymentId: started.deploymentId, manifestKey: assetPrefix, contentDigest },
        signal,
      )
      return {
        kind: 'preview',
        url: `${SITES_ORIGIN}/preview/${version}/`,
        reviewUrl: completed.reviewUrl,
        pageCount,
        fileCount: files.length,
        totalBytes,
      }
    } catch (error) {
      if (started) {
        await broker(
          'fail_deployment',
          {
            deploymentId: started.deploymentId,
            error: error instanceof Error ? error.message : 'Deployment failed',
          },
        ).catch(() => undefined)
      }
      throw error
    }
  }

  const title = v.pipe(v.string(), v.minLength(1), v.maxLength(80))
  const siteId = v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(128)))
  const filePath = v.pipe(v.string(), v.minLength(1), v.maxLength(240))

  return [
    defineTool({
      name: 'list_bee_sites',
      description: 'List the signed-in user’s Bee Sites before choosing one.',
      input: v.object({}),
      async run({ signal }) {
        return { output: await broker<AgentSite[]>('list', {}, signal) }
      },
    }),
    defineTool({
      name: 'prepare_site_workspace',
      description:
        'Select or create one site and prepare its locked Astro workspace. This consumes one monthly generation.',
      input: v.object({
        siteId,
        title,
        suggestedSlug: v.optional(
          v.pipe(v.string(), v.minLength(2), v.maxLength(48)),
        ),
      }),
      async run({ data, signal }) {
        const site = await broker<PreparedSite>(
          'prepare',
          {
            siteId: data.siteId,
            title: data.title,
            suggestedSlug: data.suggestedSlug,
          },
          signal,
        )
        const loaded = await loadSource(site)
        templateFiles = loaded.template
        sourceFiles = loaded.files
        activeSite = site
        const { siteId: _siteId, ...publicSite } = activeSite
        return { output: publicSite }
      },
    }),
    defineTool({
      name: 'read_site_file',
      description: 'Read one approved text file from the selected Astro workspace.',
      input: v.object({ path: filePath }),
      async run({ data }) {
        requireActive()
        const path = safeRelativePath(data.path, 'read')
        const content = sourceFiles.get(path) ?? templateFiles.get(path)
        if (content === undefined) throw new Error(`Could not read ${path}.`)
        if (content.length > MAX_TOOL_TEXT) throw new Error(`${path} is too large to read through Astro Creator.`)
        return { output: { path, content } }
      },
    }),
    defineTool({
      name: 'write_site_file',
      description:
        'Write one approved static Astro, CSS, or public text asset in the selected workspace.',
      input: v.object({
        path: filePath,
        content: v.pipe(v.string(), v.maxLength(MAX_TOOL_TEXT)),
      }),
      async run({ data }) {
        requireActive()
        const path = safeRelativePath(data.path, 'write')
        const updated = new Map(sourceFiles).set(path, data.content)
        validateSourceSize(updated)
        sourceFiles = updated
        return { output: { path, saved: true } }
      },
    }),
    defineTool({
      name: 'check_site',
      description: 'Run Astro type checks and a production build for the selected site.',
      input: v.object({}),
      async run({ signal }) {
        return { output: await check(signal) }
      },
    }),
    defineTool({
      name: 'preview_site',
      description:
        'Build and upload an unlisted review preview. This does not change the public site.',
      input: v.object({}),
      async run({ signal }) {
        return { output: await deploy(signal) }
      },
    }),
    defineTool({
      name: 'publish_site',
      description:
        'Prepare an exact preview and return its signed-in publication review link. Only the user can publish from that page.',
      input: v.object({}),
      async run({ signal }) {
        return { output: await deploy(signal) }
      },
    }),
  ]
}

export function astroCreatorSubagent(
  options: AstroCreatorOptions,
): SubagentDefinition {
  const tools = astroCreatorTools(options)
  return defineSubagent({
    name: 'astro-creator',
    description:
      'Create, edit, preview, and explicitly publish fast static Astro pages as Bee Sites.',
    model: options.model,
    thinkingLevel: 'high',
    agent: () => {
      for (const tool of tools) useTool(tool)
      return INSTRUCTIONS
    },
  })
}
