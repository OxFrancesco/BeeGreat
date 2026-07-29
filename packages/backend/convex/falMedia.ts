import { v } from 'convex/values'
import { internal } from './_generated/api'
import { env, internalAction } from './_generated/server'
import type { ActionCtx } from './_generated/server'
import {
  createFalMediaClient,
  DEFAULT_FAL_MEDIA_MODELS,
  type FalMediaModels,
  type FalMediaOperation,
} from './falMediaClient'

const operationValidator = v.union(
  v.literal('generate_image'),
  v.literal('edit_image'),
  v.literal('generate_video'),
  v.literal('edit_video'),
)

const resultValidator = v.object({
  operation: operationValidator,
  kind: v.union(v.literal('image'), v.literal('video')),
  url: v.string(),
  requestId: v.string(),
})

async function requireImagine(ctx: ActionCtx, userId: string) {
  const enabled: boolean = await ctx.runQuery(internal.powerups.checkEnabled, {
    userId,
    powerupId: 'imagine',
  })
  if (!enabled) {
    throw new Error(
      'The Imagine power-up is not enabled. Turn it on from the profile screen first.',
    )
  }
}

function configuredClient() {
  const credentials = env.FAL_KEY?.trim()
  if (!credentials) {
    throw new Error(
      'Imagine is not configured. Set FAL_KEY in the Convex environment.',
    )
  }
  const models: Partial<FalMediaModels> = {
    generate_image:
      env.FAL_IMAGE_GENERATION_MODEL?.trim() ||
      DEFAULT_FAL_MEDIA_MODELS.generate_image,
    edit_image:
      env.FAL_IMAGE_EDIT_MODEL?.trim() ||
      DEFAULT_FAL_MEDIA_MODELS.edit_image,
    generate_video:
      env.FAL_VIDEO_GENERATION_MODEL?.trim() ||
      DEFAULT_FAL_MEDIA_MODELS.generate_video,
    edit_video:
      env.FAL_VIDEO_EDIT_MODEL?.trim() ||
      DEFAULT_FAL_MEDIA_MODELS.edit_video,
  }
  return createFalMediaClient({ credentials, models })
}

export const execute = internalAction({
  args: {
    userId: v.string(),
    operation: operationValidator,
    prompt: v.string(),
    sourceUrl: v.optional(v.string()),
  },
  returns: resultValidator,
  handler: async (ctx, input) => {
    await requireImagine(ctx, input.userId)
    return await configuredClient().generate({
      operation: input.operation as FalMediaOperation,
      prompt: input.prompt,
      sourceUrl: input.sourceUrl,
    })
  },
})
