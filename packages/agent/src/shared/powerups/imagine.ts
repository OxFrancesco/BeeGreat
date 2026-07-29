import { defineAgentProfile, defineTool } from '@flue/runtime'
import * as v from 'valibot'
import type { PowerupDefinition } from './types.ts'

const INSTRUCTIONS = `You are the Imagine specialist inside BeeGreat, working for Bee
(the coordinator). You generate and edit images and videos through FAL. Your reply goes
back to Bee, not directly to the user.

- Run a generation only when Bee delegates an explicit user request to create or edit
  media. Every run is billable; never create speculative variants or silently retry a
  completed result.
- Preserve the user's subject, composition, style, text, aspect, and constraints in a
  compact but complete prompt. Do not add brands, people, or sensitive traits they did
  not request.
- generate_image and generate_video need only a prompt.
- edit_image and edit_video require a public HTTPS source URL. Never invent, shorten, or
  alter it. An attached image lets you understand the requested edit, but it is not a
  source URL; if no public URL was provided, state that one is required.
- Treat a returned URL as the only confirmed output. Never claim generation succeeded
  without it, and never expose the provider request id.
- Return an image as Markdown image syntax: ![Generated image](URL). Return a video as a
  Markdown link: [Watch the generated video](URL). Add one short sentence describing
  what was created or changed.`

const prompt = v.pipe(
  v.string(),
  v.minLength(1),
  v.maxLength(20_000),
  v.description('Complete visual prompt, including constraints that must be preserved'),
)

const sourceUrl = v.pipe(
  v.string(),
  v.minLength(1),
  v.maxLength(8_192),
  v.regex(/^https:\/\//i, 'Expected a public HTTPS media URL'),
  v.description('Public HTTPS URL for the source image or video'),
)

type ImagineResult = {
  kind: 'image' | 'video'
  url: string
}

export const imagine: PowerupDefinition = {
  id: 'imagine',

  profile(userId, convexUrl, runtime) {
    const convexSiteUrl = (() => {
      if (runtime.convexSiteUrl) return runtime.convexSiteUrl.replace(/\/$/, '')
      const url = new URL(convexUrl)
      if (!url.hostname.endsWith('.convex.cloud')) return null
      url.hostname = url.hostname.replace(/\.convex\.cloud$/, '.convex.site')
      return url.origin
    })()

    const request = async (
      input: Record<string, unknown>,
      signal?: AbortSignal,
    ): Promise<ImagineResult> => {
      if (!convexSiteUrl || !runtime.credentialBrokerSecret) {
        throw new Error('Imagine is not configured for the Bee worker.')
      }
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 9.5 * 60_000)
      const abort = () => controller.abort()
      signal?.addEventListener('abort', abort, { once: true })
      try {
        const response = await fetch(`${convexSiteUrl}/internal/fal-media`, {
          method: 'POST',
          headers: {
            authorization: `Bearer ${runtime.credentialBrokerSecret}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({ userId, ...input }),
          signal: controller.signal,
        })
        const body = (await response.json().catch(() => null)) as
          | {
              error?: unknown
              kind?: unknown
              url?: unknown
            }
          | null
        if (!response.ok) {
          throw new Error(
            typeof body?.error === 'string'
              ? body.error
              : 'Imagine request failed.',
          )
        }
        if (
          (body?.kind !== 'image' && body?.kind !== 'video') ||
          typeof body.url !== 'string'
        ) {
          throw new Error('Imagine returned an invalid media result.')
        }
        return { kind: body.kind, url: body.url }
      } finally {
        clearTimeout(timeout)
        signal?.removeEventListener('abort', abort)
      }
    }

    return defineAgentProfile({
      name: 'imagine',
      description:
        'FAL media studio: generate new images or videos from a prompt, and edit an image or video from a public HTTPS source URL.',
      instructions: INSTRUCTIONS,
      tools: [
        defineTool({
          name: 'generate_image',
          description:
            'Generate one image from an explicit user-approved visual prompt. This is a billable FAL request.',
          input: v.object({ prompt }),
          async run({ input, signal }) {
            return await request(
              { operation: 'generate_image', prompt: input.prompt },
              signal,
            )
          },
        }),
        defineTool({
          name: 'edit_image',
          description:
            'Edit one image at a public HTTPS URL according to the prompt. This is a billable FAL request.',
          input: v.object({ prompt, sourceUrl }),
          async run({ input, signal }) {
            return await request(
              {
                operation: 'edit_image',
                prompt: input.prompt,
                sourceUrl: input.sourceUrl,
              },
              signal,
            )
          },
        }),
        defineTool({
          name: 'generate_video',
          description:
            'Generate one video from an explicit user-approved visual prompt. This is a billable FAL request and may take several minutes.',
          input: v.object({ prompt }),
          async run({ input, signal }) {
            return await request(
              { operation: 'generate_video', prompt: input.prompt },
              signal,
            )
          },
        }),
        defineTool({
          name: 'edit_video',
          description:
            'Edit one video at a public HTTPS URL according to the prompt. This is a billable FAL request and may take several minutes.',
          input: v.object({ prompt, sourceUrl }),
          async run({ input, signal }) {
            return await request(
              {
                operation: 'edit_video',
                prompt: input.prompt,
                sourceUrl: input.sourceUrl,
              },
              signal,
            )
          },
        }),
      ],
    })
  },
}
