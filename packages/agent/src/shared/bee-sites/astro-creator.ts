import {
  defineSubagent,
  defineTool,
  useTool,
  type SubagentDefinition,
} from '@flue/runtime'
import type { ISandbox } from '@cloudflare/sandbox'
import * as v from 'valibot'

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
  guarded tools; you do not have a general shell, network tool, secrets, or arbitrary
  package installation.
- Start every creation or editing run with list_bee_sites, then call
  prepare_site_workspace for the exact site. Preparing a workspace consumes one monthly
  generation, so call it once per delegated run and never speculatively.
- Read before editing an existing site. Keep pages accessible, responsive, fast, and
  visually intentional. Use semantic HTML and CSS. Never add client scripts, analytics,
  remote scripts, forms that transmit data, authentication, payments, or server code.
- Use relative internal links and files in public for local assets. Remote HTTPS images
  are acceptable only when the user supplied or explicitly requested them.
- Run check_site after editing. Fix reported errors before offering a preview.
- preview_site is safe for review. publish_site changes the live public site and counts
  against the user's publish allowance: call it only when Bee states that the user
  explicitly asked to publish or confirmed the preview. Never publish merely because a
  build succeeds.
- Report the preview or public URL and a short summary. Never expose internal site,
  deployment, or user ids.`

export interface BeeSitesBucket {
  put(
    key: string,
    value: ArrayBuffer | ArrayBufferView | string | ReadableStream,
    options?: {
      httpMetadata?: { contentType?: string; cacheControl?: string }
    },
  ): Promise<unknown>
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
  sandbox: ISandbox
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
  input: Record<string, unknown>,
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
  const body = (await response.json().catch(() => null)) as
    | ({ error?: unknown } & T)
    | null
  if (!response.ok) {
    throw new Error(
      typeof body?.error === 'string'
        ? body.error
        : 'Bee Sites request failed.',
    )
  }
  if (!body) throw new Error('Bee Sites returned an invalid response.')
  return body
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

function contentType(path: string) {
  const extension = path.split('.').pop()?.toLowerCase()
  return (
    {
      css: 'text/css; charset=utf-8',
      gif: 'image/gif',
      html: 'text/html; charset=utf-8',
      ico: 'image/x-icon',
      jpeg: 'image/jpeg',
      jpg: 'image/jpeg',
      json: 'application/json; charset=utf-8',
      png: 'image/png',
      svg: 'image/svg+xml',
      txt: 'text/plain; charset=utf-8',
      webmanifest: 'application/manifest+json',
      webp: 'image/webp',
      woff: 'font/woff',
      woff2: 'font/woff2',
      xml: 'application/xml; charset=utf-8',
    } as Record<string, string>
  )[extension ?? ''] ?? 'application/octet-stream'
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

  const broker = <T>(
    operation: string,
    input: Record<string, unknown> = {},
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

  const check = async (signal?: AbortSignal) => {
    const { workspace } = requireActive()
    const result = await options.sandbox.exec(
      'bun run check && bun run build',
      { cwd: workspace, timeout: 120_000, signal },
    )
    return {
      ok: result.success,
      exitCode: result.exitCode,
      stdout: truncate(result.stdout),
      stderr: truncate(result.stderr),
    }
  }

  const restoreSource = async (site: PreparedSite, workspace: string) => {
    const sourcePrefix = sourcePrefixFor(options.userId, site.siteId)
    const snapshot = await options.bucket.list({
      prefix: sourcePrefix,
      limit: 1_000,
    })
    for (const object of snapshot.objects) {
      const relativePath = object.key.slice(sourcePrefix.length)
      const path = safeRelativePath(relativePath, 'write')
      const stored = await options.bucket.get(object.key)
      if (!stored) continue
      const parent = path.slice(0, path.lastIndexOf('/'))
      if (parent) {
        await options.sandbox.mkdir(`${workspace}/${parent}`, {
          recursive: true,
        })
      }
      const result = await options.sandbox.writeFile(
        `${workspace}/${path}`,
        stored.body,
      )
      if (!result.success) {
        throw new Error(`Could not restore ${path} into Astro Creator.`)
      }
    }
  }

  const snapshotSource = async (
    site: PreparedSite,
    workspace: string,
    signal?: AbortSignal,
  ) => {
    const sourcePrefix = sourcePrefixFor(options.userId, site.siteId)
    const previous = await options.bucket.list({
      prefix: sourcePrefix,
      limit: 1_000,
    })
    const listed = await options.sandbox.exec(
      "find src public -type f -printf '%p\\t%s\\n' | sort",
      { cwd: workspace, timeout: 10_000, signal },
    )
    if (!listed.success) {
      throw new Error(`Could not snapshot the Astro source: ${listed.stderr}`)
    }
    const currentKeys = new Set<string>()
    for (const line of listed.stdout.trim().split('\n').filter(Boolean)) {
      const tab = line.lastIndexOf('\t')
      const path = safeRelativePath(
        tab > 0 ? line.slice(0, tab) : '',
        'write',
      )
      const result = await options.sandbox.readFile(`${workspace}/${path}`, {
        encoding: 'base64',
      })
      if (!result.success) throw new Error(`Could not snapshot ${path}.`)
      const key = `${sourcePrefix}${path}`
      currentKeys.add(key)
      await options.bucket.put(
        key,
        decodeBase64(result.content),
        {
          httpMetadata: {
            contentType: contentType(path),
            cacheControl: 'private, no-store',
          },
        },
      )
    }
    const staleKeys = previous.objects
      .map((object) => object.key)
      .filter((key) => !currentKeys.has(key))
    if (staleKeys.length) await options.bucket.delete(staleKeys)
  }

  const deploy = async (
    kind: 'preview' | 'production',
    signal?: AbortSignal,
  ) => {
    const { site, workspace } = requireActive()
    const checked = await check(signal)
    if (!checked.ok) {
      throw new Error(
        `Astro validation failed.\n${checked.stderr || checked.stdout}`,
      )
    }

    const manifestResult = await options.sandbox.exec(
      "find dist -type l -print | sed -n '1p'; find dist -type f -printf '%P\\t%s\\n' | sort",
      { cwd: workspace, timeout: 10_000, signal },
    )
    if (!manifestResult.success) {
      throw new Error(`Could not inspect the built site: ${manifestResult.stderr}`)
    }
    const lines = manifestResult.stdout.trim().split('\n').filter(Boolean)
    if (lines[0]?.startsWith('dist/') && !lines[0].includes('\t')) {
      throw new Error('Built sites cannot contain symbolic links.')
    }
    const files = lines.map((line) => {
      const tab = line.lastIndexOf('\t')
      const path = tab > 0 ? line.slice(0, tab) : ''
      const size = Number(tab > 0 ? line.slice(tab + 1) : Number.NaN)
      if (
        !path ||
        path.includes('..') ||
        path.startsWith('/') ||
        !Number.isSafeInteger(size) ||
        size < 0
      ) {
        throw new Error('The Astro build produced an unsafe file manifest.')
      }
      return { path, size }
    })
    if (!files.length) throw new Error('The Astro build produced no files.')

    const pageCount = files.filter((file) => file.path.endsWith('.html')).length
    const totalBytes = files.reduce((sum, file) => sum + file.size, 0)
    const version = newVersion()
    let started: DeploymentStart | null = null
    try {
      started = await broker<DeploymentStart>(
        'begin_deployment',
        {
          siteId: site.siteId,
          version,
          kind,
          pageCount,
          fileCount: files.length,
          totalBytes,
        },
        signal,
      )
      const assetPrefix = `users/${options.userId}/sites/${site.siteId}/deployments/${version}/`
      for (const file of files) {
        const result = await options.sandbox.readFile(
          `${workspace}/dist/${file.path}`,
          { encoding: 'base64' },
        )
        if (!result.success) throw new Error(`Could not read ${file.path}.`)
        await options.bucket.put(
          `${assetPrefix}${file.path}`,
          decodeBase64(result.content),
          {
            httpMetadata: {
              contentType: contentType(file.path),
              cacheControl: file.path.endsWith('.html')
                ? 'public, max-age=60'
                : 'public, max-age=31536000, immutable',
            },
          },
        )
      }
      await snapshotSource(site, workspace, signal)
      await broker(
        'complete_deployment',
        { deploymentId: started.deploymentId, manifestKey: assetPrefix },
        signal,
      )
      return {
        kind,
        url:
          kind === 'preview'
            ? `${SITES_ORIGIN}/preview/${version}`
            : started.publicUrl,
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
        activeSite = await broker<PreparedSite>(
          'prepare',
          {
            siteId: data.siteId,
            title: data.title,
            suggestedSlug: data.suggestedSlug,
          },
          signal,
        )
        const workspace = workspaceFor(activeSite.siteId)
        const exists = await options.sandbox.exists(`${workspace}/package.json`)
        if (!exists.exists) {
          const result = await options.sandbox.exec(
            `mkdir -p ${workspace} && cp -a ${TEMPLATE_ROOT}/. ${workspace}/`,
            { timeout: 30_000, signal },
          )
          if (!result.success) {
            activeSite = null
            throw new Error(`Could not prepare the Astro workspace: ${result.stderr}`)
          }
          await restoreSource(activeSite, workspace)
        }
        const { siteId: _siteId, ...publicSite } = activeSite
        return { output: publicSite }
      },
    }),
    defineTool({
      name: 'read_site_file',
      description: 'Read one approved text file from the selected Astro workspace.',
      input: v.object({ path: filePath }),
      async run({ data }) {
        const { workspace } = requireActive()
        const path = safeRelativePath(data.path, 'read')
        const result = await options.sandbox.readFile(`${workspace}/${path}`)
        if (!result.success) throw new Error(`Could not read ${path}.`)
        if (result.content.length > MAX_TOOL_TEXT) {
          throw new Error(`${path} is too large to read through Astro Creator.`)
        }
        return { output: { path, content: result.content } }
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
        const { workspace } = requireActive()
        const path = safeRelativePath(data.path, 'write')
        const parent = path.slice(0, path.lastIndexOf('/'))
        if (parent) await options.sandbox.mkdir(`${workspace}/${parent}`, { recursive: true })
        const result = await options.sandbox.writeFile(
          `${workspace}/${path}`,
          data.content,
        )
        if (!result.success) throw new Error(`Could not write ${path}.`)
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
        return { output: await deploy('preview', signal) }
      },
    }),
    defineTool({
      name: 'publish_site',
      description:
        'Publish a checked site to its public address. Use only after explicit user approval.',
      input: v.object({}),
      async run({ signal }) {
        return { output: await deploy('production', signal) }
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
